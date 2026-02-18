/**
 * Approval Request Detail API
 *
 * Single approval request operations: GET, PATCH (workflow actions), DELETE.
 * Handles approve, reject, request_revision, resubmit, and add_comment actions.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/approvals/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';
import { getUserIdFromCookies } from '@/lib/auth/jwt-utils';

// =============================================================================
// Types
// =============================================================================

interface ApprovalStep {
  id: string;
  order: number;
  type: 'review' | 'approval' | 'legal_check' | 'brand_check' | 'final_approval';
  name: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'revision_requested';
  assignedTo: string[];
  comments: ApprovalComment[];
  requiredApprovals: number;
  currentApprovals: number;
  isOptional: boolean;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

interface ApprovalComment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  type: 'comment' | 'revision_request' | 'approval' | 'rejection';
  attachments?: string[];
  createdAt: string;
}

// =============================================================================
// Schemas
// =============================================================================

const patchApprovalSchema = z.object({
  action: z.enum(['approve', 'reject', 'request_revision', 'resubmit', 'add_comment']),
  comment: z.string().max(2000).optional(),
  attachments: z.array(z.string()).optional(),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Transform approval request for API response
 */
function transformApprovalForResponse(approval: {
  id: string;
  contentId: string;
  contentType: string;
  workflowId: string | null;
  submittedBy: string;
  status: string;
  priority: string;
  currentStep: number;
  totalSteps: number;
  steps: unknown;
  title: string;
  description: string | null;
  dueDate: Date | null;
  metadata: unknown;
  organizationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  submitter?: { name: string | null; email: string } | null;
}) {
  return {
    id: approval.id,
    contentId: approval.contentId,
    contentType: approval.contentType,
    workflowId: approval.workflowId,
    submittedBy: approval.submittedBy,
    submitterName: approval.submitter?.name ?? null,
    submitterEmail: approval.submitter?.email ?? null,
    status: approval.status,
    priority: approval.priority,
    currentStep: approval.currentStep,
    totalSteps: approval.totalSteps,
    steps: approval.steps as ApprovalStep[],
    title: approval.title,
    description: approval.description,
    dueDate: approval.dueDate?.toISOString() ?? null,
    metadata: approval.metadata,
    organizationId: approval.organizationId,
    createdAt: approval.createdAt.toISOString(),
    updatedAt: approval.updatedAt.toISOString(),
  };
}

/**
 * Create TeamNotification for approval action
 */
async function createApprovalNotification(
  recipientId: string,
  requestId: string,
  organizationId: string | null,
  actorId: string,
  actorName: string,
  action: string,
  title: string
) {
  const actionVerbs: Record<string, string> = {
    approve: 'approved',
    reject: 'rejected',
    request_revision: 'requested revision on',
    resubmit: 'resubmitted',
    add_comment: 'commented on',
  };

  await prisma.teamNotification.create({
    data: {
      userId: recipientId,
      organizationId,
      type: 'approval_action',
      title: `Approval ${action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Updated'}`,
      message: `${actorName} ${actionVerbs[action] || action} "${title}"`,
      actionUrl: `/dashboard/approvals/${requestId}`,
      relatedUserId: actorId,
      relatedContentType: 'approval_request',
      relatedContentId: requestId,
    },
  });
}

/**
 * Check if user can access approval request
 */
function canAccessApproval(
  approval: { submittedBy: string; organizationId: string | null; steps: unknown },
  userId: string,
  userOrgId: string | null
): boolean {
  // Submitter can always access
  if (approval.submittedBy === userId) return true;

  // Same organization
  if (approval.organizationId && approval.organizationId === userOrgId) return true;

  // Assigned to a step
  const steps = approval.steps as ApprovalStep[];
  if (steps.some(step => step.assignedTo.includes(userId) || step.assignedTo.includes('*'))) {
    return true;
  }

  return false;
}

/**
 * Check if user can approve current step
 */
function canApproveStep(step: ApprovalStep, userId: string): boolean {
  return step.assignedTo.includes(userId) || step.assignedTo.includes('*');
}

// =============================================================================
// Route Handlers
// =============================================================================

/**
 * GET /api/approvals/[id] - Get single approval request
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    const approval = await prisma.approvalRequest.findUnique({
      where: { id },
      include: {
        submitter: {
          select: { name: true, email: true },
        },
      },
    });

    if (!approval) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Approval request not found' },
        { status: 404 }
      );
    }

    // Check access
    if (!canAccessApproval(approval, userId, user?.organizationId ?? null)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Access denied to this approval request' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: transformApprovalForResponse(approval),
    });
  } catch (error: unknown) {
    console.error('Get approval error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to get approval request') },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/approvals/[id] - Update approval request (workflow actions)
 *
 * Actions:
 * - approve: Approve current step, advance workflow
 * - reject: Reject request with reason
 * - request_revision: Request changes from submitter
 * - resubmit: Submitter resubmits after revision
 * - add_comment: Add comment to current step
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const body = await request.json();
    const validation = patchApprovalSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { action, comment, attachments } = validation.data;

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, name: true, email: true },
    });
    const userName = user?.name || user?.email || 'Unknown User';

    // Get approval request
    const approval = await prisma.approvalRequest.findUnique({
      where: { id },
      include: {
        submitter: {
          select: { name: true, email: true },
        },
      },
    });

    if (!approval) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Approval request not found' },
        { status: 404 }
      );
    }

    // Check access
    if (!canAccessApproval(approval, userId, user?.organizationId ?? null)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Access denied to this approval request' },
        { status: 403 }
      );
    }

    const steps = approval.steps as unknown as ApprovalStep[];
    const currentStep = steps[approval.currentStep];
    let newStatus = approval.status;
    let newCurrentStep = approval.currentStep;

    // Process action
    switch (action) {
      case 'approve': {
        // Verify user can approve
        if (!canApproveStep(currentStep, userId)) {
          return NextResponse.json(
            { error: 'Forbidden', message: 'You are not assigned to approve this step' },
            { status: 403 }
          );
        }

        // Increment approvals
        currentStep.currentApprovals++;

        // Add approval comment if provided
        if (comment) {
          currentStep.comments.push({
            id: `cmt_${Date.now()}`,
            userId,
            userName,
            content: comment,
            type: 'approval',
            attachments,
            createdAt: new Date().toISOString(),
          });
        }

        // Check if step is complete
        if (currentStep.currentApprovals >= currentStep.requiredApprovals) {
          currentStep.status = 'approved';
          currentStep.approvedBy = userId;
          currentStep.approvedAt = new Date().toISOString();

          // Advance to next step or complete
          if (approval.currentStep >= steps.length - 1) {
            newStatus = 'approved';
          } else {
            newCurrentStep = approval.currentStep + 1;
            newStatus = 'in_review';
          }
        }

        // Notify submitter
        await createApprovalNotification(
          approval.submittedBy,
          id,
          approval.organizationId,
          userId,
          userName,
          'approve',
          approval.title
        );

        // Notify next step assignees if advancing
        if (newCurrentStep > approval.currentStep && newCurrentStep < steps.length) {
          const nextStep = steps[newCurrentStep];
          for (const assigneeId of nextStep.assignedTo) {
            if (assigneeId !== '*' && assigneeId !== userId) {
              await createApprovalNotification(
                assigneeId,
                id,
                approval.organizationId,
                userId,
                userName,
                'approve',
                approval.title
              );
            }
          }
        }
        break;
      }

      case 'reject': {
        if (!comment) {
          return NextResponse.json(
            { error: 'Validation Error', message: 'Comment required for rejection' },
            { status: 400 }
          );
        }

        currentStep.status = 'rejected';
        currentStep.comments.push({
          id: `cmt_${Date.now()}`,
          userId,
          userName,
          content: comment,
          type: 'rejection',
          attachments,
          createdAt: new Date().toISOString(),
        });

        newStatus = 'rejected';

        // Notify submitter
        await createApprovalNotification(
          approval.submittedBy,
          id,
          approval.organizationId,
          userId,
          userName,
          'reject',
          approval.title
        );
        break;
      }

      case 'request_revision': {
        if (!comment) {
          return NextResponse.json(
            { error: 'Validation Error', message: 'Feedback required for revision request' },
            { status: 400 }
          );
        }

        currentStep.status = 'revision_requested';
        currentStep.comments.push({
          id: `cmt_${Date.now()}`,
          userId,
          userName,
          content: comment,
          type: 'revision_request',
          attachments,
          createdAt: new Date().toISOString(),
        });

        newStatus = 'revision_requested';

        // Notify submitter
        await createApprovalNotification(
          approval.submittedBy,
          id,
          approval.organizationId,
          userId,
          userName,
          'request_revision',
          approval.title
        );
        break;
      }

      case 'resubmit': {
        // Only submitter can resubmit
        if (approval.submittedBy !== userId) {
          return NextResponse.json(
            { error: 'Forbidden', message: 'Only the submitter can resubmit' },
            { status: 403 }
          );
        }

        // Reset current step
        currentStep.status = 'pending';
        currentStep.currentApprovals = 0;

        if (comment) {
          currentStep.comments.push({
            id: `cmt_${Date.now()}`,
            userId,
            userName,
            content: comment,
            type: 'comment',
            attachments,
            createdAt: new Date().toISOString(),
          });
        }

        newStatus = 'in_review';

        // Notify step assignees
        for (const assigneeId of currentStep.assignedTo) {
          if (assigneeId !== '*') {
            await createApprovalNotification(
              assigneeId,
              id,
              approval.organizationId,
              userId,
              userName,
              'resubmit',
              approval.title
            );
          }
        }
        break;
      }

      case 'add_comment': {
        if (!comment) {
          return NextResponse.json(
            { error: 'Validation Error', message: 'Comment content required' },
            { status: 400 }
          );
        }

        currentStep.comments.push({
          id: `cmt_${Date.now()}`,
          userId,
          userName,
          content: comment,
          type: 'comment',
          attachments,
          createdAt: new Date().toISOString(),
        });

        // Notify submitter if not the commenter
        if (approval.submittedBy !== userId) {
          await createApprovalNotification(
            approval.submittedBy,
            id,
            approval.organizationId,
            userId,
            userName,
            'add_comment',
            approval.title
          );
        }
        break;
      }
    }

    // Update approval request
    const updated = await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: newStatus,
        currentStep: newCurrentStep,
        steps: steps as unknown as Prisma.InputJsonValue,
      },
      include: {
        submitter: {
          select: { name: true, email: true },
        },
      },
    });

    // Log action
    await prisma.auditLog.create({
      data: {
        action: `approval_${action}`,
        resource: 'approval_request',
        resourceId: id,
        userId,
        details: { action, previousStatus: approval.status, newStatus, comment: comment?.substring(0, 100) },
        severity: action === 'reject' ? 'medium' : 'low',
        category: 'content',
        outcome: 'success',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Approval request ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'updated'}`,
      data: transformApprovalForResponse(updated),
    });
  } catch (error: unknown) {
    console.error('Update approval error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to update approval request') },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/approvals/[id] - Delete/cancel approval request
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const approval = await prisma.approvalRequest.findUnique({
      where: { id },
    });

    if (!approval) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Approval request not found' },
        { status: 404 }
      );
    }

    // Only submitter can delete
    if (approval.submittedBy !== userId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only the submitter can delete this approval request' },
        { status: 403 }
      );
    }

    await prisma.approvalRequest.delete({
      where: { id },
    });

    // Log deletion
    await prisma.auditLog.create({
      data: {
        action: 'approval_deleted',
        resource: 'approval_request',
        resourceId: id,
        userId,
        details: { title: approval.title, contentId: approval.contentId },
        severity: 'medium',
        category: 'content',
        outcome: 'success',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Approval request deleted',
    });
  } catch (error: unknown) {
    console.error('Delete approval error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to delete approval request') },
      { status: 500 }
    );
  }
}
