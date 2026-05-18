/**
 * Approvals Hook
 *
 * @description Manages approval request state and workflow actions.
 * Provides create, approve, reject, revision, resubmit, comment, and remove actions.
 *
 * Uses SWR for GET data fetching; mutations use direct fetch + mutate().
 */

'use client';

import { useCallback } from 'react';
import useSWR from 'swr';

// ============================================================================
// TYPES
// ============================================================================

export interface ApprovalComment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  type: 'comment' | 'revision_request' | 'approval' | 'rejection';
  attachments?: string[];
  createdAt: string;
}

export interface ApprovalStep {
  id: string;
  order: number;
  type:
    | 'review'
    | 'approval'
    | 'legal_check'
    | 'brand_check'
    | 'final_approval';
  name: string;
  status:
    | 'pending'
    | 'in_review'
    | 'approved'
    | 'rejected'
    | 'revision_requested';
  assignedTo: string[];
  comments: ApprovalComment[];
  requiredApprovals: number;
  currentApprovals: number;
  isOptional: boolean;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface ApprovalRequest {
  id: string;
  contentId: string;
  contentType: 'post' | 'campaign' | 'media' | 'template';
  workflowId: string | null;
  submittedBy: string;
  submitterName?: string;
  submitterEmail?: string;
  status:
    | 'pending'
    | 'in_review'
    | 'approved'
    | 'rejected'
    | 'revision_requested';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  currentStep: number;
  totalSteps: number;
  steps: ApprovalStep[];
  title: string;
  description: string | null;
  dueDate: string | null;
  metadata: Record<string, unknown> | null;
  organizationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApprovalData {
  contentId: string;
  contentType: 'post' | 'campaign' | 'media' | 'template';
  title: string;
  description?: string;
  workflowId?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  dueDate?: string;
  metadata?: Record<string, unknown>;
}

export interface UseApprovalsOptions {
  status?: string;
  assignedToMe?: boolean;
  submittedByMe?: boolean;
  contentType?: string;
  priority?: string;
}

/** API response shape for GET /api/approvals */
interface ApprovalsListResponse {
  success: boolean;
  data: ApprovalRequest[];
  total: number;
}

/** API response shape for POST /api/approvals */
interface CreateApprovalResponse {
  success: boolean;
  message: string;
  data: ApprovalRequest;
}

/** API response shape for PATCH /api/approvals/[id] */
interface ActionApprovalResponse {
  success: boolean;
  message: string;
  data: ApprovalRequest;
}

/** API response shape for DELETE /api/approvals/[id] */
interface DeleteApprovalResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// FETCHER
// ============================================================================

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useApprovals(options?: UseApprovalsOptions) {
  // Build query string from options
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.assignedToMe) params.set('assignedToMe', 'true');
  if (options?.submittedByMe) params.set('submittedByMe', 'true');
  if (options?.contentType) params.set('contentType', options.contentType);
  if (options?.priority) params.set('priority', options.priority);
  const queryString = params.toString();
  const url = `/api/approvals${queryString ? `?${queryString}` : ''}`;

  const {
    data: response,
    error,
    isLoading,
    mutate,
  } = useSWR<ApprovalsListResponse>(url, fetchJson, {
    revalidateOnFocus: false,
  });

  // Backward-compatible aliases
  const loading = isLoading;
  const requests = response?.data ?? [];
  const total = response?.total ?? 0;

  /**
   * Create a new approval request
   */
  const create = useCallback(
    async (data: CreateApprovalData): Promise<ApprovalRequest | null> => {
      try {
        const res = await fetch('/api/approvals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              errorData.message ||
              `HTTP ${res.status}: ${res.statusText}`
          );
        }

        const result: CreateApprovalResponse = await res.json();
        await mutate();
        return result.data;
      } catch (err) {
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
    [mutate]
  );

  /**
   * Perform workflow action on approval request
   */
  const performAction = useCallback(
    async (
      id: string,
      action:
        | 'approve'
        | 'reject'
        | 'request_revision'
        | 'resubmit'
        | 'add_comment',
      comment?: string,
      attachments?: string[]
    ): Promise<boolean> => {
      try {
        const res = await fetch(`/api/approvals/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action, comment, attachments }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              errorData.message ||
              `HTTP ${res.status}: ${res.statusText}`
          );
        }

        const _result: ActionApprovalResponse = await res.json();
        await mutate();
        return true;
      } catch {
        return false;
      }
    },
    [mutate]
  );

  /**
   * Approve current step
   */
  const approve = useCallback(
    async (id: string, comment?: string): Promise<boolean> => {
      return performAction(id, 'approve', comment);
    },
    [performAction]
  );

  /**
   * Reject approval request
   */
  const reject = useCallback(
    async (id: string, reason: string): Promise<boolean> => {
      return performAction(id, 'reject', reason);
    },
    [performAction]
  );

  /**
   * Request revision from submitter
   */
  const requestRevision = useCallback(
    async (id: string, feedback: string): Promise<boolean> => {
      return performAction(id, 'request_revision', feedback);
    },
    [performAction]
  );

  /**
   * Resubmit after revision (submitter only)
   */
  const resubmit = useCallback(
    async (id: string, comment?: string): Promise<boolean> => {
      return performAction(id, 'resubmit', comment);
    },
    [performAction]
  );

  /**
   * Add comment to current step
   */
  const addComment = useCallback(
    async (
      id: string,
      content: string,
      attachments?: string[]
    ): Promise<boolean> => {
      return performAction(id, 'add_comment', content, attachments);
    },
    [performAction]
  );

  /**
   * Remove approval request (submitter only)
   */
  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/approvals/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              errorData.message ||
              `HTTP ${res.status}: ${res.statusText}`
          );
        }

        const _result: DeleteApprovalResponse = await res.json();
        await mutate();
        return true;
      } catch {
        return false;
      }
    },
    [mutate]
  );

  /**
   * Refresh the approvals list
   */
  const refresh = useCallback(async (): Promise<void> => {
    await mutate();
  }, [mutate]);

  return {
    requests,
    total,
    loading,
    error: error
      ? error instanceof Error
        ? error.message
        : String(error)
      : null,
    refresh,
    create,
    approve,
    reject,
    requestRevision,
    resubmit,
    addComment,
    remove,
  };
}
