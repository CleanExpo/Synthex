/**
 * Content Sharing Hook
 *
 * @description Hook for managing content sharing:
 * - Share content with users, teams, or via link
 * - List shares for content
 * - Revoke shares
 *
 * Usage:
 * ```tsx
 * const { shares, shareContent, revokeShare, isLoading } = useContentShare({
 *   contentType: 'campaign',
 *   contentId: 'abc123',
 * });
 * ```
 */

'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

export type ContentType = 'campaign' | 'post' | 'calendar_post' | 'project';
export type Permission = 'view' | 'comment' | 'edit' | 'admin';

export interface ContentShare {
  id: string;
  contentType: ContentType;
  contentId: string;
  sharedWithUserId?: string;
  sharedWithTeamId?: string;
  sharedWithEmail?: string;
  permission: Permission;
  canDownload: boolean;
  canReshare: boolean;
  accessLink?: string;
  expiresAt?: Date;
  maxViews?: number;
  viewCount: number;
  message?: string;
  sharedById: string;
  createdAt: Date;
  lastAccessedAt?: Date;
}

export interface ShareOptions {
  sharedWithUserId?: string;
  sharedWithTeamId?: string;
  sharedWithEmail?: string;
  permission?: Permission;
  canDownload?: boolean;
  canReshare?: boolean;
  expiresAt?: Date | string;
  maxViews?: number;
  message?: string;
  password?: string;
  createLink?: boolean;
}

export interface UseContentShareOptions {
  contentType: ContentType;
  contentId: string;
  autoLoad?: boolean;
}

export interface UseContentShareReturn {
  shares: ContentShare[];
  isLoading: boolean;
  error: Error | null;
  shareContent: (
    options: ShareOptions
  ) => Promise<{ share: ContentShare; shareUrl?: string } | null>;
  revokeShare: (shareId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  getShareUrl: (share: ContentShare) => string | null;
}

// ============================================================================
// FETCHER
// ============================================================================

function mapShare(s: any): ContentShare {
  return {
    ...s,
    createdAt: new Date(s.createdAt),
    expiresAt: s.expiresAt ? new Date(s.expiresAt) : undefined,
    lastAccessedAt: s.lastAccessedAt ? new Date(s.lastAccessedAt) : undefined,
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch shares');
  const data = await res.json();
  return (data.shares || []).map(mapShare) as T;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useContentShare(
  options: UseContentShareOptions
): UseContentShareReturn {
  const { contentType, contentId, autoLoad = true } = options;

  const key =
    autoLoad && contentType && contentId
      ? `/api/content/share?contentType=${contentType}&contentId=${contentId}`
      : null;

  const {
    data: shares = [],
    error,
    isLoading,
    mutate,
  } = useSWR<ContentShare[]>(key, fetchJson, { revalidateOnFocus: false });

  /**
   * Share content
   */
  const shareContent = useCallback(
    async (
      shareOptions: ShareOptions
    ): Promise<{ share: ContentShare; shareUrl?: string } | null> => {
      try {
        const response = await fetch('/api/content/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            contentType,
            contentId,
            ...shareOptions,
            expiresAt: shareOptions.expiresAt
              ? new Date(shareOptions.expiresAt).toISOString()
              : undefined,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to share content');
        }

        const data = await response.json();

        const newShare: ContentShare = {
          ...data.share,
          createdAt: new Date(data.share.createdAt),
          expiresAt: data.share.expiresAt
            ? new Date(data.share.expiresAt)
            : undefined,
        };

        if (data.updated) {
          toast.success('Share updated');
        } else {
          toast.success('Content shared successfully');
        }

        await mutate();
        return { share: newShare, shareUrl: data.shareUrl };
      } catch (err) {
        toast.error((err as Error).message);
        return null;
      }
    },
    [contentType, contentId, mutate]
  );

  /**
   * Revoke a share
   */
  const revokeShare = useCallback(
    async (shareId: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/content/share?id=${shareId}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to revoke share');
        }

        await mutate();
        toast.success('Share revoked');
        return true;
      } catch (err) {
        toast.error((err as Error).message);
        return false;
      }
    },
    [mutate]
  );

  /**
   * Get share URL
   */
  const getShareUrl = useCallback((share: ContentShare): string | null => {
    if (!share.accessLink) return null;
    return `${window.location.origin}/shared/${share.accessLink}`;
  }, []);

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    shares,
    isLoading,
    error:
      error instanceof Error ? error : error ? new Error(String(error)) : null,
    shareContent,
    revokeShare,
    refresh,
    getShareUrl,
  };
}

/**
 * Hook for shares that were shared with the current user
 */
export function useSharedWithMe() {
  const {
    data: shares = [],
    error,
    isLoading,
    mutate,
  } = useSWR<ContentShare[]>(
    '/api/content/share?sharedWithMe=true',
    fetchJson,
    { revalidateOnFocus: false }
  );

  return {
    shares,
    isLoading,
    error:
      error instanceof Error ? error : error ? new Error(String(error)) : null,
    refresh: mutate,
  };
}

export default useContentShare;
