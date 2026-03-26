/**
 * Comments Hook
 *
 * @description Manages content comment state.
 * Provides create, update, remove, resolve, unresolve, and refresh actions.
 *
 * Uses SWR for GET data fetching; mutations use direct fetch + mutate().
 */

'use client';

import { useCallback } from 'react';
import useSWR from 'swr';

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

export function useComments(contentType: string, contentId: string) {
  const params = new URLSearchParams({ contentType, contentId });
  const url = `/api/comments?${params.toString()}`;

  const {
    data: response,
    error,
    isLoading,
    mutate,
  } = useSWR<CommentsListResponse>(url, fetchJson, {
    revalidateOnFocus: false,
  });

  // Backward-compatible aliases
  const loading = isLoading;
  const comments = response?.data ?? [];

  /**
   * Create a new comment
   * Returns the created comment
   */
  const create = useCallback(
    async (data: CreateCommentData): Promise<ContentComment | null> => {
      try {
        const res = await fetch('/api/comments', {
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

        const result: CreateCommentResponse = await res.json();
        await mutate();
        return result.data;
      } catch (err) {
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
    [mutate]
  );

  /**
   * Update an existing comment
   */
  const update = useCallback(
    async (id: string, data: UpdateCommentData): Promise<void> => {
      const res = await fetch(`/api/comments/${encodeURIComponent(id)}`, {
        method: 'PATCH',
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

      const _result: UpdateCommentResponse = await res.json();
      await mutate();
    },
    [mutate]
  );

  /**
   * Remove a comment
   */
  const remove = useCallback(
    async (id: string): Promise<void> => {
      const res = await fetch(`/api/comments/${encodeURIComponent(id)}`, {
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

      const _result: DeleteCommentResponse = await res.json();
      await mutate();
    },
    [mutate]
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
    await mutate();
  }, [mutate]);

  return {
    comments,
    loading,
    error: error
      ? error instanceof Error
        ? error.message
        : String(error)
      : null,
    create,
    update,
    remove,
    resolve,
    unresolve,
    refresh,
  };
}
