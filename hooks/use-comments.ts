/**
 * Comments Hook
 *
 * @description Manages content comment state.
 * Provides create, update, remove, resolve, unresolve, and refresh actions.
 *
 * Uses raw fetch + useState pattern (no SWR/TanStack Query).
 * Follows the same pattern as hooks/use-webhooks.ts.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface ContentComment {
  id: string;
  contentType: string;
  contentId: string;
  content: string;
  parentId: string | null;
  authorId: string;
  sentiment: string | null;
  sentimentScore: number | null;
  emotions: unknown;
  isResolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  mentions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentData {
  contentType: string;
  contentId: string;
  content: string;
  parentId?: string;
  mentions?: string[];
}

export interface UpdateCommentData {
  content?: string;
  isResolved?: boolean;
}

/** API response shape for GET /api/comments */
interface CommentsListResponse {
  success: boolean;
  data: ContentComment[];
}

/** API response shape for POST /api/comments */
interface CreateCommentResponse {
  success: boolean;
  message: string;
  data: ContentComment;
}

/** API response shape for PATCH /api/comments/[id] */
interface UpdateCommentResponse {
  success: boolean;
  message: string;
  data: ContentComment;
}

/** API response shape for DELETE /api/comments/[id] */
interface DeleteCommentResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// HOOK
// ============================================================================

export function useComments(contentType: string, contentId: string) {
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetch all comments from API
   */
  const fetchComments = useCallback(async () => {
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
      const params = new URLSearchParams({
        contentType,
        contentId,
      });

      const response = await fetch(`/api/comments?${params.toString()}`, {
        credentials: 'include',
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: CommentsListResponse = await response.json();

      if (mountedRef.current) {
        setComments(data.data);
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
  }, [contentType, contentId]);

  /**
   * Create a new comment
   * Returns the created comment
   */
  const create = useCallback(
    async (data: CreateCommentData): Promise<ContentComment | null> => {
      try {
        const response = await fetch('/api/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const result: CreateCommentResponse = await response.json();

        // Refetch all comments to reflect the change
        if (mountedRef.current) {
          await fetchComments();
        }

        return result.data;
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
        return null;
      }
    },
    [fetchComments]
  );

  /**
   * Update an existing comment
   */
  const update = useCallback(
    async (id: string, data: UpdateCommentData): Promise<void> => {
      try {
        const response = await fetch(`/api/comments/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const _result: UpdateCommentResponse = await response.json();

        // Refetch all comments to reflect the change
        if (mountedRef.current) {
          await fetchComments();
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [fetchComments]
  );

  /**
   * Remove a comment
   */
  const remove = useCallback(
    async (id: string): Promise<void> => {
      try {
        const response = await fetch(`/api/comments/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const _result: DeleteCommentResponse = await response.json();

        // Refetch all comments to reflect the change
        if (mountedRef.current) {
          await fetchComments();
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [fetchComments]
  );

  /**
   * Resolve a comment
   */
  const resolve = useCallback(
    async (id: string): Promise<void> => {
      await update(id, { isResolved: true });
    },
    [update]
  );

  /**
   * Unresolve a comment
   */
  const unresolve = useCallback(
    async (id: string): Promise<void> => {
      await update(id, { isResolved: false });
    },
    [update]
  );

  /**
   * Refresh the comments list
   */
  const refresh = useCallback(async (): Promise<void> => {
    await fetchComments();
  }, [fetchComments]);

  // Initial fetch on mount
  useEffect(() => {
    mountedRef.current = true;
    fetchComments();

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchComments]);

  return {
    comments,
    loading,
    error,
    create,
    update,
    remove,
    resolve,
    unresolve,
    refresh,
  };
}
