/**
 * Shares Hook
 *
 * @description Manages content sharing state.
 * Provides create, update, revoke, and refresh actions.
 *
 * Uses raw fetch + useState pattern (no SWR/TanStack Query).
 * Follows the same pattern as hooks/use-webhooks.ts.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

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
// HOOK
// ============================================================================

export function useShares(filter: ShareFilter) {
  const [shares, setShares] = useState<ContentShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Build query string from filter
   */
  const buildQueryString = useCallback((f: ShareFilter): string => {
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
  }, []);

  /**
   * Fetch all shares from API
   */
  const fetchShares = useCallback(async () => {
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
      const queryString = buildQueryString(filter);

      const response = await fetch(`/api/shares?${queryString}`, {
        credentials: 'include',
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: SharesListResponse = await response.json();

      if (mountedRef.current) {
        setShares(data.data);
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
  }, [filter, buildQueryString]);

  /**
   * Create a new share
   * Returns the created share
   */
  const create = useCallback(
    async (data: CreateShareData): Promise<ContentShare | null> => {
      try {
        const response = await fetch('/api/shares', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const result: CreateShareResponse = await response.json();

        // Refetch all shares to reflect the change
        if (mountedRef.current) {
          await fetchShares();
        }

        return result.data;
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
        return null;
      }
    },
    [fetchShares]
  );

  /**
   * Update an existing share
   */
  const update = useCallback(
    async (id: string, data: UpdateShareData): Promise<void> => {
      try {
        const response = await fetch(`/api/shares/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const _result: UpdateShareResponse = await response.json();

        // Refetch all shares to reflect the change
        if (mountedRef.current) {
          await fetchShares();
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [fetchShares]
  );

  /**
   * Revoke a share
   */
  const revoke = useCallback(
    async (id: string, reason?: string): Promise<void> => {
      try {
        const url = reason
          ? `/api/shares/${encodeURIComponent(id)}?reason=${encodeURIComponent(reason)}`
          : `/api/shares/${encodeURIComponent(id)}`;

        const response = await fetch(url, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const _result: RevokeShareResponse = await response.json();

        // Refetch all shares to reflect the change
        if (mountedRef.current) {
          await fetchShares();
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [fetchShares]
  );

  /**
   * Refresh the shares list
   */
  const refresh = useCallback(async (): Promise<void> => {
    await fetchShares();
  }, [fetchShares]);

  // Initial fetch on mount
  useEffect(() => {
    mountedRef.current = true;
    fetchShares();

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchShares]);

  return {
    shares,
    loading,
    error,
    create,
    update,
    revoke,
    refresh,
  };
}
