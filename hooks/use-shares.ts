/**
 * Shares Hook
 *
 * @description Manages content sharing state.
 * Provides create, update, revoke, and refresh actions.
 *
 * Uses SWR for GET data fetching; mutations use direct fetch + mutate().
 */

'use client';

import { useCallback } from 'react';
import useSWR from 'swr';

// ============================================================================
// TYPES
// ============================================================================

export interface ContentShare {
  id: string;
  contentType: string;
  contentId: string;
  sharedWithUserId: string | null;
  sharedWithTeamId: string | null;
  sharedWithEmail: string | null;
  permission: string;
  canDownload: boolean;
  canReshare: boolean;
  accessLink: string | null;
  expiresAt: string | null;
  maxViews: number | null;
  viewCount: number;
  sharedById: string;
  organizationId: string | null;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string | null;
}

export interface CreateShareData {
  contentType: string;
  contentId: string;
  sharedWithUserId?: string;
  sharedWithTeamId?: string;
  sharedWithEmail?: string;
  permission?: 'view' | 'comment' | 'edit' | 'admin';
  canDownload?: boolean;
  canReshare?: boolean;
  expiresAt?: string;
  message?: string;
}

export interface UpdateShareData {
  permission?: 'view' | 'comment' | 'edit' | 'admin';
  canDownload?: boolean;
  canReshare?: boolean;
  expiresAt?: string | null;
}

export interface ShareFilter {
  contentType?: string;
  contentId?: string;
  sharedWithMe?: boolean;
  sharedByMe?: boolean;
}

/** API response shape for GET /api/shares */
interface SharesListResponse {
  success: boolean;
  data: ContentShare[];
}

/** API response shape for POST /api/shares */
interface CreateShareResponse {
  success: boolean;
  message: string;
  data: ContentShare;
}

/** API response shape for PATCH /api/shares/[id] */
interface UpdateShareResponse {
  success: boolean;
  message: string;
  data: ContentShare;
}

/** API response shape for DELETE /api/shares/[id] */
interface RevokeShareResponse {
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

// Build query string from filter
function buildQueryString(f: ShareFilter): string {
  const params = new URLSearchParams();

  if (f.contentType && f.contentId) {
    params.set('contentType', f.contentType);
    params.set('contentId', f.contentId);
  } else if (f.sharedWithMe) {
    params.set('sharedWithMe', 'true');
  } else if (f.sharedByMe) {
    params.set('sharedByMe', 'true');
  }

  return params.toString();
}

// ============================================================================
// HOOK
// ============================================================================

export function useShares(filter: ShareFilter) {
  const queryString = buildQueryString(filter);
  const url = `/api/shares?${queryString}`;

  const {
    data: response,
    error,
    isLoading,
    mutate,
  } = useSWR<SharesListResponse>(url, fetchJson, { revalidateOnFocus: false });

  // Backward-compatible aliases
  const loading = isLoading;
  const shares = response?.data ?? [];

  /**
   * Create a new share
   * Returns the created share
   */
  const create = useCallback(
    async (data: CreateShareData): Promise<ContentShare | null> => {
      const res = await fetch('/api/shares', {
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

      const result: CreateShareResponse = await res.json();
      await mutate();
      return result.data;
    },
    [mutate]
  );

  /**
   * Update an existing share
   */
  const update = useCallback(
    async (id: string, data: UpdateShareData): Promise<void> => {
      const res = await fetch(`/api/shares/${encodeURIComponent(id)}`, {
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

      const _result: UpdateShareResponse = await res.json();
      await mutate();
    },
    [mutate]
  );

  /**
   * Revoke a share
   */
  const revoke = useCallback(
    async (id: string, reason?: string): Promise<void> => {
      const revokeUrl = reason
        ? `/api/shares/${encodeURIComponent(id)}?reason=${encodeURIComponent(reason)}`
        : `/api/shares/${encodeURIComponent(id)}`;

      const res = await fetch(revokeUrl, {
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

      const _result: RevokeShareResponse = await res.json();
      await mutate();
    },
    [mutate]
  );

  /**
   * Refresh the shares list
   */
  const refresh = useCallback(async (): Promise<void> => {
    await mutate();
  }, [mutate]);

  return {
    shares,
    loading,
    error: error
      ? error instanceof Error
        ? error.message
        : String(error)
      : null,
    create,
    update,
    revoke,
    refresh,
  };
}
