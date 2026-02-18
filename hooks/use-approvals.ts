/**
 * Approvals Hook
 *
 * @description Manages approval request state and workflow actions.
 * Provides create, approve, reject, revision, resubmit, comment, and remove actions.
 *
 * Uses raw fetch + useState pattern (no SWR/TanStack Query).
 * Follows the same pattern as hooks/use-webhooks.ts.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

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

export interface ApprovalRequest {
  id: string;
  contentId: string;
  contentType: 'post' | 'campaign' | 'media' | 'template';
  workflowId: string | null;
  submittedBy: string;
  submitterName?: string;
  submitterEmail?: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'revision_requested';
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
// HOOK
// ============================================================================

export function useApprovals(options?: UseApprovalsOptions) {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Build query params from options
   */
  const buildQueryParams = useCallback((opts?: UseApprovalsOptions): string => {
    const params = new URLSearchParams();
    if (opts?.status) params.set('status', opts.status);
    if (opts?.assignedToMe) params.set('assignedToMe', 'true');
    if (opts?.submittedByMe) params.set('submittedByMe', 'true');
    if (opts?.contentType) params.set('contentType', opts.contentType);
    if (opts?.priority) params.set('priority', opts.priority);
    return params.toString();
  }, []);

  /**
   * Fetch all approval requests from API
   */
  const fetchApprovals = useCallback(async () => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!mountedRef.current) return;
    setLoading(true);
    setError(null);

    try {
      const queryString = buildQueryParams(options);
      const url = `/api/approvals${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        credentials: 'include',
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ApprovalsListResponse = await response.json();

      if (mountedRef.current) {
        setRequests(data.data);
        setTotal(data.total);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Request was cancelled, don't update state
      }
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [buildQueryParams, options]);

  /**
   * Create a new approval request
   */
  const create = useCallback(
    async (data: CreateApprovalData): Promise<ApprovalRequest | null> => {
      try {
        const response = await fetch('/api/approvals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const result: CreateApprovalResponse = await response.json();

        // Refetch to reflect the change
        if (mountedRef.current) {
          await fetchApprovals();
        }

        return result.data;
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
        return null;
      }
    },
    [fetchApprovals]
  );

  /**
   * Perform workflow action on approval request
   */
  const performAction = useCallback(
    async (
      id: string,
      action: 'approve' | 'reject' | 'request_revision' | 'resubmit' | 'add_comment',
      comment?: string,
      attachments?: string[]
    ): Promise<boolean> => {
      try {
        const response = await fetch(`/api/approvals/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action, comment, attachments }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const _result: ActionApprovalResponse = await response.json();

        // Refetch to reflect the change
        if (mountedRef.current) {
          await fetchApprovals();
        }

        return true;
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
        return false;
      }
    },
    [fetchApprovals]
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
    async (id: string, content: string, attachments?: string[]): Promise<boolean> => {
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
        const response = await fetch(`/api/approvals/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const _result: DeleteApprovalResponse = await response.json();

        // Refetch to reflect the change
        if (mountedRef.current) {
          await fetchApprovals();
        }

        return true;
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
        return false;
      }
    },
    [fetchApprovals]
  );

  /**
   * Refresh the approvals list
   */
  const refresh = useCallback(async (): Promise<void> => {
    await fetchApprovals();
  }, [fetchApprovals]);

  // Initial fetch on mount
  useEffect(() => {
    mountedRef.current = true;
    fetchApprovals();

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchApprovals]);

  return {
    requests,
    total,
    loading,
    error,
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
