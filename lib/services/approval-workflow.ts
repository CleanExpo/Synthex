/**
 * Approval Workflow Service
 *
 * @description Multi-step content approval workflows for marketing agencies
 *
 * Backed by Prisma: approval_requests (ApprovalRequest), workflow_templates
 * (WorkflowTemplate) and users. Requests are visible to the caller's
 * organisation and to their submitter.
 *
 * NOT PROVISIONED: client workspaces (clients, client_members) and
 * scheduled_posts have no Prisma model. Client-scoped calls throw
 * ApprovalWorkflowNotProvisionedError; the post-approval scheduling step is
 * recorded on the request as metadata.postApprovalAction {available:false}.
 */

import { Prisma } from '@prisma/client';
import type {
  ApprovalRequest as ApprovalRequestRow,
  WorkflowTemplate as WorkflowTemplateRow,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  FEATURE_NOT_PROVISIONED,
  tableUnavailable,
} from '@/lib/api/not-provisioned';
import { logger } from '@/lib/logger';

// Approval status
export type ApprovalStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'revision_requested'
  | 'auto_approved';

// Workflow step types
export type StepType =
  | 'review'
  | 'approval'
  | 'legal_check'
  | 'brand_check'
  | 'final_approval';

// Approval request
export interface ApprovalRequest {
  id: string;
  contentId: string;
  contentType: 'post' | 'campaign' | 'media' | 'template';
  clientId?: string;
  workflowId?: string;
  submittedBy: string;
  status: ApprovalStatus;
  currentStep: number;
  totalSteps: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  dueDate?: string;
  steps: ApprovalStep[];
  metadata: {
    title: string;
    description?: string;
    platforms?: string[];
    scheduledTime?: string;
    tags?: string[];
    /** Set when the post-approval action could not run (not provisioned). */
    postApprovalAction?: { available: false; reason: string };
  };
  createdAt: string;
  updatedAt: string;
}

// Approval step
export interface ApprovalStep {
  id: string;
  order: number;
  type: StepType;
  name: string;
  status: ApprovalStatus;
  assignedTo: string[];
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  comments: ApprovalComment[];
  requiredApprovals: number;
  currentApprovals: number;
  isOptional: boolean;
  autoApproveAfter?: number; // hours
  createdAt: string;
}

// Approval comment
export interface ApprovalComment {
  id: string;
  stepId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  type: 'comment' | 'revision_request' | 'approval' | 'rejection';
  attachments?: string[];
  createdAt: string;
}

// Workflow template
export interface WorkflowTemplate {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  steps: WorkflowStepTemplate[];
  isDefault: boolean;
  contentTypes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStepTemplate {
  order: number;
  type: StepType;
  name: string;
  assigneeRole: string;
  requiredApprovals: number;
  isOptional: boolean;
  autoApproveAfter?: number;
}

/** Thrown when an operation needs a table that is not provisioned. */
export class ApprovalWorkflowNotProvisionedError extends Error {
  readonly code = FEATURE_NOT_PROVISIONED;
  constructor(readonly table: string) {
    super(tableUnavailable(table).reason);
    this.name = 'ApprovalWorkflowNotProvisionedError';
  }
}

class ApprovalWorkflowService {
  // ==================== Approval Requests ====================

  /**
   * Create a new approval request
   */
  async createApprovalRequest(
    userId: string,
    data: {
      contentId: string;
      contentType: 'post' | 'campaign' | 'media' | 'template';
      clientId?: string;
      workflowId?: string;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      dueDate?: string;
      metadata: {
        title: string;
        description?: string;
        platforms?: string[];
        scheduledTime?: string;
        tags?: string[];
      };
    }
  ): Promise<ApprovalRequest> {
    try {
      // Client workspaces (and their default workflows) are not provisioned.
      if (data.clientId) {
        throw new ApprovalWorkflowNotProvisionedError('clients');
      }

      const organizationId = await this.getUserOrganizationId(userId);

      // Get workflow template (only one from the caller's organisation)
      let workflow: WorkflowTemplate | null = null;
      if (data.workflowId) {
        if (!organizationId) throw new Error('Workflow template not found');
        workflow = await this.getWorkflowTemplate(
          data.workflowId,
          organizationId
        );
        if (!workflow) throw new Error('Workflow template not found');
      }

      // Create steps from workflow or use default
      const steps = workflow
        ? await this.createStepsFromTemplate(workflow)
        : await this.createDefaultSteps(userId);

      const request = await prisma.approvalRequest.create({
        data: {
          contentId: data.contentId,
          contentType: data.contentType,
          workflowId: data.workflowId,
          submittedBy: userId,
          organizationId,
          status: 'pending',
          currentStep: 0,
          totalSteps: steps.length,
          priority: data.priority || 'normal',
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          steps: steps as unknown as Prisma.InputJsonValue,
          title: data.metadata.title,
          description: data.metadata.description,
          metadata: data.metadata as Prisma.InputJsonValue,
        },
      });

      // Notify first step assignees
      await this.notifyStepAssignees(steps[0], data.metadata.title);

      return this.mapDbToRequest(request);
    } catch (error: unknown) {
      logger.error('Failed to create approval request:', { error, userId });
      throw error;
    }
  }

  /**
   * Get approval requests
   */
  async getApprovalRequests(
    userId: string,
    options: {
      clientId?: string;
      status?: ApprovalStatus | 'all';
      assignedToMe?: boolean;
      submittedByMe?: boolean;
      contentType?: string;
      priority?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ requests: ApprovalRequest[]; total: number }> {
    try {
      if (options.clientId) {
        throw new ApprovalWorkflowNotProvisionedError('clients');
      }

      const where: Prisma.ApprovalRequestWhereInput = {
        AND: [await this.visibleTo(userId)],
      };

      if (options.status && options.status !== 'all') {
        where.status = options.status;
      }

      if (options.submittedByMe) {
        where.submittedBy = userId;
      }

      if (options.contentType) {
        where.contentType = options.contentType;
      }

      if (options.priority) {
        where.priority = options.priority;
      }

      const [data, count] = await Promise.all([
        prisma.approvalRequest.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: options.limit,
          skip: options.offset,
        }),
        prisma.approvalRequest.count({ where }),
      ]);

      let requests = data.map(row => this.mapDbToRequest(row));

      // Filter by assigned to me (needs post-processing due to JSON structure)
      if (options.assignedToMe) {
        requests = requests.filter(r => {
          const currentStep = r.steps[r.currentStep];
          return currentStep?.assignedTo.includes(userId);
        });
      }

      return {
        requests,
        total: count,
      };
    } catch (error: unknown) {
      logger.error('Failed to get approval requests:', { error, userId });
      throw error;
    }
  }

  /**
   * Get a specific approval request
   */
  async getApprovalRequest(
    requestId: string,
    userId: string
  ): Promise<ApprovalRequest | null> {
    try {
      const data = await prisma.approvalRequest.findFirst({
        where: { id: requestId, AND: [await this.visibleTo(userId)] },
      });

      if (!data) return null;

      return this.mapDbToRequest(data);
    } catch (error: unknown) {
      logger.error('Failed to get approval request:', { error, requestId });
      throw error;
    }
  }

  /**
   * Approve a step
   */
  async approveStep(
    requestId: string,
    userId: string,
    options: {
      comment?: string;
      stepIndex?: number;
    } = {}
  ): Promise<ApprovalRequest> {
    try {
      const request = await this.getApprovalRequest(requestId, userId);
      if (!request) {
        throw new Error('Approval request not found');
      }

      const stepIndex = options.stepIndex ?? request.currentStep;
      const step = request.steps[stepIndex];

      if (!step) {
        throw new Error('Step not found');
      }

      // Check if user can approve
      if (!step.assignedTo.includes(userId) && step.assignedTo[0] !== '*') {
        throw new Error('You are not assigned to this step');
      }
      // A wildcard step means "anyone", never the submitter approving themselves.
      if (step.assignedTo[0] === '*' && userId === request.submittedBy) {
        throw new Error('You cannot approve your own request');
      }

      // Add approval
      step.currentApprovals++;

      if (options.comment) {
        step.comments.push({
          id: `cmt_${Date.now()}`,
          stepId: step.id,
          userId,
          userName: await this.getUserName(userId),
          content: options.comment,
          type: 'approval',
          createdAt: new Date().toISOString(),
        });
      }

      // Check if step is complete
      if (step.currentApprovals >= step.requiredApprovals) {
        step.status = 'approved';
        step.approvedBy = userId;
        step.approvedAt = new Date().toISOString();

        // Move to next step or complete
        if (stepIndex >= request.steps.length - 1) {
          request.status = 'approved';
        } else {
          request.currentStep = stepIndex + 1;
          // Notify next step assignees
          await this.notifyStepAssignees(
            request.steps[request.currentStep],
            request.metadata.title
          );
        }
      }

      // If fully approved, record the post-approval action outcome
      if (request.status === 'approved') {
        this.handleApproved(request);
      }

      // Update in database
      const data = await prisma.approvalRequest.update({
        where: { id: request.id },
        data: {
          status: request.status,
          currentStep: request.currentStep,
          steps: request.steps as unknown as Prisma.InputJsonValue,
          metadata: request.metadata as Prisma.InputJsonValue,
        },
      });

      return this.mapDbToRequest(data);
    } catch (error: unknown) {
      logger.error('Failed to approve step:', { error, requestId });
      throw error;
    }
  }

  /**
   * Reject a step
   */
  async rejectStep(
    requestId: string,
    userId: string,
    reason: string,
    options: {
      stepIndex?: number;
    } = {}
  ): Promise<ApprovalRequest> {
    try {
      const request = await this.getApprovalRequest(requestId, userId);
      if (!request) {
        throw new Error('Approval request not found');
      }

      const stepIndex = options.stepIndex ?? request.currentStep;
      const step = request.steps[stepIndex];

      if (!step) {
        throw new Error('Step not found');
      }

      // Update step
      step.status = 'rejected';
      step.rejectedBy = userId;
      step.rejectedAt = new Date().toISOString();
      step.comments.push({
        id: `cmt_${Date.now()}`,
        stepId: step.id,
        userId,
        userName: await this.getUserName(userId),
        content: reason,
        type: 'rejection',
        createdAt: new Date().toISOString(),
      });

      request.status = 'rejected';

      // Update in database
      const data = await prisma.approvalRequest.update({
        where: { id: request.id },
        data: {
          status: 'rejected',
          steps: request.steps as unknown as Prisma.InputJsonValue,
        },
      });

      // Notify submitter
      await this.notifySubmitter(request, 'rejected', reason);

      return this.mapDbToRequest(data);
    } catch (error: unknown) {
      logger.error('Failed to reject step:', { error, requestId });
      throw error;
    }
  }

  /**
   * Request revision
   */
  async requestRevision(
    requestId: string,
    userId: string,
    feedback: string,
    options: {
      attachments?: string[];
    } = {}
  ): Promise<ApprovalRequest> {
    try {
      const request = await this.getApprovalRequest(requestId, userId);
      if (!request) {
        throw new Error('Approval request not found');
      }

      const step = request.steps[request.currentStep];
      step.status = 'revision_requested';
      step.comments.push({
        id: `cmt_${Date.now()}`,
        stepId: step.id,
        userId,
        userName: await this.getUserName(userId),
        content: feedback,
        type: 'revision_request',
        attachments: options.attachments,
        createdAt: new Date().toISOString(),
      });

      request.status = 'revision_requested';

      // Update in database
      const data = await prisma.approvalRequest.update({
        where: { id: request.id },
        data: {
          status: 'revision_requested',
          steps: request.steps as unknown as Prisma.InputJsonValue,
        },
      });

      // Notify submitter
      await this.notifySubmitter(request, 'revision_requested', feedback);

      return this.mapDbToRequest(data);
    } catch (error: unknown) {
      logger.error('Failed to request revision:', { error, requestId });
      throw error;
    }
  }

  /**
   * Resubmit after revision
   */
  async resubmit(
    requestId: string,
    userId: string,
    comment?: string
  ): Promise<ApprovalRequest> {
    try {
      const request = await this.getApprovalRequest(requestId, userId);
      if (!request) {
        throw new Error('Approval request not found');
      }

      if (request.submittedBy !== userId) {
        throw new Error('Only the submitter can resubmit');
      }

      // Reset current step
      const step = request.steps[request.currentStep];
      step.status = 'pending';
      step.currentApprovals = 0;

      if (comment) {
        step.comments.push({
          id: `cmt_${Date.now()}`,
          stepId: step.id,
          userId,
          userName: await this.getUserName(userId),
          content: comment,
          type: 'comment',
          createdAt: new Date().toISOString(),
        });
      }

      request.status = 'in_review';

      // Update in database
      const data = await prisma.approvalRequest.update({
        where: { id: request.id },
        data: {
          status: 'in_review',
          steps: request.steps as unknown as Prisma.InputJsonValue,
        },
      });

      // Notify step assignees
      await this.notifyStepAssignees(step, request.metadata.title);

      return this.mapDbToRequest(data);
    } catch (error: unknown) {
      logger.error('Failed to resubmit:', { error, requestId });
      throw error;
    }
  }

  /**
   * Add comment to step
   */
  async addComment(
    requestId: string,
    userId: string,
    content: string,
    options: {
      stepIndex?: number;
      attachments?: string[];
    } = {}
  ): Promise<ApprovalComment> {
    try {
      const request = await this.getApprovalRequest(requestId, userId);
      if (!request) {
        throw new Error('Approval request not found');
      }

      const stepIndex = options.stepIndex ?? request.currentStep;
      const step = request.steps[stepIndex];

      const comment: ApprovalComment = {
        id: `cmt_${Date.now()}`,
        stepId: step.id,
        userId,
        userName: await this.getUserName(userId),
        content,
        type: 'comment',
        attachments: options.attachments,
        createdAt: new Date().toISOString(),
      };

      step.comments.push(comment);

      // Update in database
      await prisma.approvalRequest.update({
        where: { id: request.id },
        data: { steps: request.steps as unknown as Prisma.InputJsonValue },
      });

      return comment;
    } catch (error: unknown) {
      logger.error('Failed to add comment:', { error, requestId });
      throw error;
    }
  }

  // ==================== Workflow Templates ====================

  /**
   * Get workflow templates
   */
  async getWorkflowTemplates(
    organizationId: string
  ): Promise<WorkflowTemplate[]> {
    try {
      const data = await prisma.workflowTemplate.findMany({
        where: { organizationId },
        orderBy: { name: 'asc' },
      });

      return data.map(row => this.mapDbToTemplate(row));
    } catch (error: unknown) {
      logger.error('Failed to get workflow templates:', {
        error,
        organizationId,
      });
      throw error;
    }
  }

  /**
   * Get a specific workflow template
   */
  async getWorkflowTemplate(
    templateId: string,
    organizationId?: string
  ): Promise<WorkflowTemplate | null> {
    try {
      const data = await prisma.workflowTemplate.findFirst({
        where: {
          id: templateId,
          ...(organizationId ? { organizationId } : {}),
        },
      });

      if (!data) return null;

      return this.mapDbToTemplate(data);
    } catch (error: unknown) {
      logger.error('Failed to get workflow template:', { error, templateId });
      throw error;
    }
  }

  /**
   * Create workflow template
   */
  async createWorkflowTemplate(
    organizationId: string,
    data: {
      name: string;
      description: string;
      steps: WorkflowStepTemplate[];
      isDefault?: boolean;
      contentTypes?: string[];
    }
  ): Promise<WorkflowTemplate> {
    try {
      const template = await prisma.workflowTemplate.create({
        data: {
          organizationId,
          name: data.name,
          description: data.description,
          steps: data.steps as unknown as Prisma.InputJsonValue,
          isDefault: data.isDefault || false,
          contentTypes: data.contentTypes || ['post'],
        },
      });

      return this.mapDbToTemplate(template);
    } catch (error: unknown) {
      logger.error('Failed to create workflow template:', {
        error,
        organizationId,
      });
      throw error;
    }
  }

  // ==================== Private Methods ====================

  /** Organisation of the caller, or null when they have none. */
  private async getUserOrganizationId(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    return user?.organizationId ?? null;
  }

  /** Requests the caller may see: their organisation's, or their own. */
  private async visibleTo(
    userId: string
  ): Promise<Prisma.ApprovalRequestWhereInput> {
    const organizationId = await this.getUserOrganizationId(userId);
    return organizationId
      ? { OR: [{ organizationId }, { submittedBy: userId }] }
      : { submittedBy: userId };
  }

  private async createStepsFromTemplate(
    template: WorkflowTemplate
  ): Promise<ApprovalStep[]> {
    const steps: ApprovalStep[] = [];

    for (const stepTemplate of template.steps) {
      // Get assignees by role
      const assignees = this.getAssigneesByRole(stepTemplate.assigneeRole);

      steps.push({
        id: `step_${Date.now()}_${stepTemplate.order}`,
        order: stepTemplate.order,
        type: stepTemplate.type,
        name: stepTemplate.name,
        status: 'pending',
        assignedTo: assignees,
        comments: [],
        requiredApprovals: stepTemplate.requiredApprovals,
        currentApprovals: 0,
        isOptional: stepTemplate.isOptional,
        autoApproveAfter: stepTemplate.autoApproveAfter,
        createdAt: new Date().toISOString(),
      });
    }

    return steps;
  }

  private async createDefaultSteps(
    submitterId: string
  ): Promise<ApprovalStep[]> {
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
        createdAt: new Date().toISOString(),
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
        createdAt: new Date().toISOString(),
      },
    ];
  }

  private getAssigneesByRole(_role: string): string[] {
    // Role-based assignment needs client_members (not provisioned); without a
    // client every role resolves to anyone, as before.
    return ['*'];
  }

  private async getUserName(userId: string): Promise<string> {
    const data = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    return data?.name || data?.email || 'Unknown User';
  }

  private async notifyStepAssignees(
    step: ApprovalStep,
    title: string
  ): Promise<void> {
    // Would integrate with notification system
    logger.info('Notifying step assignees', {
      stepId: step.id,
      assignees: step.assignedTo,
    });
  }

  private async notifySubmitter(
    request: ApprovalRequest,
    action: string,
    message: string
  ): Promise<void> {
    // Would integrate with notification system
    logger.info('Notifying submitter', {
      requestId: request.id,
      submitter: request.submittedBy,
      action,
    });
  }

  private handleApproved(request: ApprovalRequest): void {
    // Scheduling an approved post needs scheduled_posts (not provisioned):
    // record that on the request instead of silently skipping it.
    if (request.contentType === 'post') {
      request.metadata.postApprovalAction = tableUnavailable('scheduled_posts');
      logger.warn('Post-approval scheduling not run', {
        requestId: request.id,
        ...request.metadata.postApprovalAction,
      });
    }
  }

  private mapDbToRequest(data: ApprovalRequestRow): ApprovalRequest {
    return {
      id: data.id,
      contentId: data.contentId,
      contentType: data.contentType as ApprovalRequest['contentType'],
      workflowId: data.workflowId ?? undefined,
      submittedBy: data.submittedBy,
      status: data.status as ApprovalStatus,
      currentStep: data.currentStep,
      totalSteps: data.totalSteps,
      priority: data.priority as ApprovalRequest['priority'],
      dueDate: data.dueDate?.toISOString(),
      steps: (data.steps as unknown as ApprovalStep[] | null) || [],
      metadata: (data.metadata as unknown as
        | ApprovalRequest['metadata']
        | null) || {
        title: data.title,
        description: data.description ?? undefined,
      },
      createdAt: data.createdAt.toISOString(),
      updatedAt: data.updatedAt.toISOString(),
    };
  }

  private mapDbToTemplate(data: WorkflowTemplateRow): WorkflowTemplate {
    return {
      id: data.id,
      organizationId: data.organizationId,
      name: data.name,
      description: data.description ?? '',
      steps: (data.steps as unknown as WorkflowStepTemplate[] | null) || [],
      isDefault: data.isDefault,
      contentTypes: (data.contentTypes as unknown as string[] | null) || [],
      createdAt: data.createdAt.toISOString(),
      updatedAt: data.updatedAt.toISOString(),
    };
  }
}

// Export singleton
export const approvalWorkflow = new ApprovalWorkflowService();
