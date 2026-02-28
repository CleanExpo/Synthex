/**
 * Approval Requests API
 *
 * CRUD operations for content approval requests with Prisma persistence.
 * GET lists approval requests, POST creates new requests with workflow steps.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/approvals/route
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

const createApprovalSchema = z.object({
  contentId: z.string().min(1, 'Content ID required'),
  contentType: z.enum(['post', 'campaign', 'media', 'template']),
  title: z.string().min(1, 'Title required').max(200),
  description: z.string().max(2000).optional(),
  workflowId: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
  dueDate: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create default approval steps (2-step workflow)
 */
function createDefaultSteps(): ApprovalStep[] {
  const now = new Date().toISOString();
  return [
    {
      id: `step_${Date.now()}_0`,
      order: 0,
      type: 'review',
      name: 'Initial Review',
      status: 'pending',
      assignedTo: ['*'], // Anyone can approve
      comments: [],
      requiredApprovals: 1,
      currentApprovals: 0,
      isOptional: false,
      createdAt: now,
    },
    {
      id: `step_${Date.now()}_1`,
      order: 1,
      type: 'final_approval',
      name: 'Final Approval',
      status: 'pending',
      assignedTo: ['*'],
      comments: [],
      requiredApprovals: 1,
      currentApprovals: 0,
      isOptional: false,
      createdAt: now,
    },
  ];
}

/**
 * Create steps from workflow template
 */
function createStepsFromTemplate(
  templateSteps: Array<{
    order: number;
    type: string;
    name: string;
    assigneeRole?: string;
    requiredApprovals?: number;
    isOptional?: boolean;
  }>
): ApprovalStep[] {
  const now = new Date().toISOString();
  return templateSteps.map((step, index) => ({
    id: `step_${Date.now()}_${index}`,
    order: step.order ?? index,
    type: (step.type as ApprovalStep['type']) || 'review',
    name: step.name,
    status: 'pending' as const,
    assignedTo: ['*'], // Would resolve by role in full implementation
    comments: [],
    requiredApprovals: step.requiredApprovals ?? 1,
    currentApprovals: 0,
    isOptional: step.isOptional ?? false,
    createdAt: now,
  }));
}

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
 * Check if user is assigned to any step (for filtering)
 */
function isUserAssignedToAnyStep(steps: ApprovalStep[], userId: string): boolean {
  return steps.some(step =>
    step.assignedTo.includes(userId) || step.assignedTo.includes('*')
  );
}

// =============================================================================
// Route Handlers
// =============================================================================

/**
 * GET /api/approvals - List approval requests
 *
 * Query params:
 * - status: Filter by status
 * - assignedToMe: Filter to requests where user is assigned to a step
 * - submittedByMe: Filter to requests user submitted
 * - contentType: Filter by content type
 * - priority: Filter by priority
 * - limit: Number of results (default 50)
 * - offset: Pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const assignedToMe = searchParams.get('assignedToMe') === 'true';
    const submittedByMe = searchParams.get('submittedByMe') === 'true';
    const contentType = searchParams.get('contentType');
    const priority = searchParams.get('priority');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    // Build query filters
    const where: Record<string, unknown> = {};

    // Filter by organization OR user's own submissions
    if (user?.organizationId) {
      where.OR = [
        { organizationId: user.organizationId },
        { submittedBy: userId },
      ];
    } else {
      where.submittedBy = userId;
    }

    if (status && status !== 'all') {
      where.status = status;
    }
    if (submittedByMe) {
      where.submittedBy = userId;
    }
    if (contentType) {
      where.contentType = contentType;
    }
    if (priority) {
      where.priority = priority;
    }

    // Query with count
    const [approvals, total] = await Promise.all([
      prisma.approvalRequest.findMany({
        where,
        include: {
          submitter: {
            select: { name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.approvalRequest.count({ where }),
    ]);

    // Post-filter for assignedToMe (requires JSON parsing)
    let filteredApprovals = approvals;
    if (assignedToMe) {
      filteredApprovals = approvals.filter(approval =>
        isUserAssignedToAnyStep(approval.steps as unknown as ApprovalStep[], userId)
      );
    }

    return NextResponse.json({
      success: true,
      data: filteredApprovals.map(transformApprovalForResponse),
      total: assignedToMe ? filteredApprovals.length : total,
    });
  } catch (error: unknown) {
    console.error('List approvals error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to list approval requests') },
      { status: 500 }
    );
  }
}

/**
 * POST /api/approvals - Create approval request
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = createApprovalSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { contentId, contentType, title, description, workflowId, priority, dueDate, metadata } = validation.data;

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, name: true },
    });

    // Determine steps - from template or default
    let steps: ApprovalStep[];

    if (workflowId) {
      const template = await prisma.workflowTemplate.findUnique({
        where: { id: workflowId },
      });

      if (template && Array.isArray(template.steps)) {
        steps = createStepsFromTemplate(template.steps as Array<{
          order: number;
          type: string;
          name: string;
          assigneeRole?: string;
          requiredApprovals?: number;
          isOptional?: boolean;
        }>);
      } else {
        steps = createDefaultSteps();
      }
    } else {
      steps = createDefaultSteps();
    }

    // Create approval request and audit log atomically
    const approval = await prisma.$transaction(async (tx) => {
      const created = await tx.approvalRequest.create({
        data: {
          contentId,
          contentType,
          workflowId,
          submittedBy: userId,
          status: 'pending',
          priority,
          currentStep: 0,
          totalSteps: steps.length,
          steps: steps as unknown as Prisma.InputJsonValue,
          title,
          description,
          dueDate: dueDate ? new Date(dueDate) : null,
          metadata: metadata as Prisma.InputJsonValue,
          organizationId: user?.organizationId,
        },
        include: {
          submitter: {
            select: { name: true, email: true },
          },
        },
      });

      // Log creation within the same transaction
      await tx.auditLog.create({
        data: {
          action: 'approval_request_created',
          resource: 'approval_request',
          resourceId: created.id,
          userId,
          details: { contentId, contentType, title, priority, totalSteps: steps.length },
          severity: 'low',
          category: 'content',
          outcome: 'success',
        },
      });

      return created;
    });

    return NextResponse.json({
      success: true,
      message: 'Approval request created',
      data: transformApprovalForResponse(approval),
    });
  } catch (error: unknown) {
    console.error('Create approval error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to create approval request') },
      { status: 500 }
    );
  }
}
