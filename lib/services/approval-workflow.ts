/**
 * Approval Workflow Service
 *
 * @description Multi-step content approval workflows for marketing agencies
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase URL (PUBLIC)
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (SECRET)
 *
 * FAILURE MODE: Returns error response with details
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Approval status
export type ApprovalStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'revision_requested' | 'auto_approved';

// Workflow step types
export type StepType = 'review' | 'approval' | 'legal_check' | 'brand_check' | 'final_approval';

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

class ApprovalWorkflowService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

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
      // Get workflow template
      let workflow: WorkflowTemplate | null = null;
      if (data.workflowId) {
        workflow = await this.getWorkflowTemplate(data.workflowId);
      } else if (data.clientId) {
        // Get client's default workflow
        workflow = await this.getDefaultWorkflow(data.clientId, data.contentType);
      }

      // Create steps from workflow or use default
      const steps = workflow
        ? await this.createStepsFromTemplate(workflow, data.clientId)
        : await this.createDefaultSteps(userId);

      const requestId = `apr_${Date.now()}`;

      const { data: request, error } = await this.supabase
        .from('approval_requests')
        .insert({
          id: requestId,
          content_id: data.contentId,
          content_type: data.contentType,
          client_id: data.clientId,
          workflow_id: data.workflowId,
          submitted_by: userId,
          status: 'pending',
          current_step: 0,
          total_steps: steps.length,
          priority: data.priority || 'normal',
          due_date: data.dueDate,
          steps,
          metadata: data.metadata,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

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
      let query = this.supabase
        .from('approval_requests')
        .select('*', { count: 'exact' });

      if (options.clientId) {
        query = query.eq('client_id', options.clientId);
      }

      if (options.status && options.status !== 'all') {
        query = query.eq('status', options.status);
      }

      if (options.submittedByMe) {
        query = query.eq('submitted_by', userId);
      }

      if (options.contentType) {
        query = query.eq('content_type', options.contentType);
      }

      if (options.priority) {
        query = query.eq('priority', options.priority);
      }

      query = query.order('created_at', { ascending: false });

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      let requests = (data || []).map(this.mapDbToRequest);

      // Filter by assigned to me (needs post-processing due to JSON structure)
      if (options.assignedToMe) {
        requests = requests.filter(r => {
          const currentStep = r.steps[r.currentStep];
          return currentStep?.assignedTo.includes(userId);
        });
      }

      return {
        requests,
        total: count || 0,
      };
    } catch (error: unknown) {
      logger.error('Failed to get approval requests:', { error, userId });
      throw error;
    }
  }

  /**
   * Get a specific approval request
   */
  async getApprovalRequest(requestId: string, userId: string): Promise<ApprovalRequest | null> {
    try {
      const { data, error } = await this.supabase
        .from('approval_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (error || !data) return null;

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

      // Update in database
      const { data, error } = await this.supabase
        .from('approval_requests')
        .update({
          status: request.status,
          current_step: request.currentStep,
          steps: request.steps,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;

      // If fully approved, trigger post-approval actions
      if (request.status === 'approved') {
        await this.handleApproved(request);
      }

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
      const { data, error } = await this.supabase
        .from('approval_requests')
        .update({
          status: 'rejected',
          steps: request.steps,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;

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
      const { data, error } = await this.supabase
        .from('approval_requests')
        .update({
          status: 'revision_requested',
          steps: request.steps,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;

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
  async resubmit(requestId: string, userId: string, comment?: string): Promise<ApprovalRequest> {
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
      const { data, error } = await this.supabase
        .from('approval_requests')
        .update({
          status: 'in_review',
          steps: request.steps,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;

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
      await this.supabase
        .from('approval_requests')
        .update({
          steps: request.steps,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

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
  async getWorkflowTemplates(organizationId: string): Promise<WorkflowTemplate[]> {
    try {
      const { data, error } = await this.supabase
        .from('workflow_templates')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });

      if (error) throw error;

      return (data || []).map(this.mapDbToTemplate);
    } catch (error: unknown) {
      logger.error('Failed to get workflow templates:', { error, organizationId });
      throw error;
    }
  }

  /**
   * Get a specific workflow template
   */
  async getWorkflowTemplate(templateId: string): Promise<WorkflowTemplate | null> {
    try {
      const { data, error } = await this.supabase
        .from('workflow_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error || !data) return null;

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
      const { data: template, error } = await this.supabase
        .from('workflow_templates')
        .insert({
          organization_id: organizationId,
          name: data.name,
          description: data.description,
          steps: data.steps,
          is_default: data.isDefault || false,
          content_types: data.contentTypes || ['post'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      return this.mapDbToTemplate(template);
    } catch (error: unknown) {
      logger.error('Failed to create workflow template:', { error, organizationId });
      throw error;
    }
  }

  // ==================== Private Methods ====================

  private async getDefaultWorkflow(clientId: string, contentType: string): Promise<WorkflowTemplate | null> {
    const { data: client } = await this.supabase
      .from('clients')
      .select('organization_id')
      .eq('id', clientId)
      .single();

    if (!client) return null;

    const { data: template } = await this.supabase
      .from('workflow_templates')
      .select('*')
      .eq('organization_id', client.organization_id)
      .eq('is_default', true)
      .contains('content_types', [contentType])
      .single();

    return template ? this.mapDbToTemplate(template) : null;
  }

  private async createStepsFromTemplate(
    template: WorkflowTemplate,
    clientId?: string
  ): Promise<ApprovalStep[]> {
    const steps: ApprovalStep[] = [];

    for (const stepTemplate of template.steps) {
      // Get assignees by role
      const assignees = await this.getAssigneesByRole(stepTemplate.assigneeRole, clientId);

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

  private async createDefaultSteps(submitterId: string): Promise<ApprovalStep[]> {
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

  private async getAssigneesByRole(role: string, clientId?: string): Promise<string[]> {
    if (role === '*' || role === 'any') return ['*'];

    if (!clientId) return ['*'];

    const { data } = await this.supabase
      .from('client_members')
      .select('user_id')
      .eq('client_id', clientId)
      .eq('role', role)
      .eq('status', 'active');

    return (data || []).map(m => m.user_id);
  }

  private async getUserName(userId: string): Promise<string> {
    const { data } = await this.supabase
      .from('users')
      .select('name, email')
      .eq('id', userId)
      .single();

    return data?.name || data?.email || 'Unknown User';
  }

  private async notifyStepAssignees(step: ApprovalStep, title: string): Promise<void> {
    // Would integrate with notification system
    logger.info('Notifying step assignees', { stepId: step.id, assignees: step.assignedTo });
  }

  private async notifySubmitter(request: ApprovalRequest, action: string, message: string): Promise<void> {
    // Would integrate with notification system
    logger.info('Notifying submitter', { requestId: request.id, submitter: request.submittedBy, action });
  }

  private async handleApproved(request: ApprovalRequest): Promise<void> {
    // Handle post-approval actions (e.g., schedule post, publish)
    if (request.contentType === 'post') {
      await this.supabase
        .from('scheduled_posts')
        .update({
          status: request.metadata.scheduledTime ? 'scheduled' : 'ready',
          approved_at: new Date().toISOString(),
        })
        .eq('id', request.contentId);
    }
  }

  private mapDbToRequest(data: any): ApprovalRequest {
    return {
      id: data.id,
      contentId: data.content_id,
      contentType: data.content_type,
      clientId: data.client_id,
      workflowId: data.workflow_id,
      submittedBy: data.submitted_by,
      status: data.status,
      currentStep: data.current_step,
      totalSteps: data.total_steps,
      priority: data.priority,
      dueDate: data.due_date,
      steps: data.steps || [],
      metadata: data.metadata || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  private mapDbToTemplate(data: any): WorkflowTemplate {
    return {
      id: data.id,
      organizationId: data.organization_id,
      name: data.name,
      description: data.description,
      steps: data.steps || [],
      isDefault: data.is_default,
      contentTypes: data.content_types || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

// Export singleton
export const approvalWorkflow = new ApprovalWorkflowService();
