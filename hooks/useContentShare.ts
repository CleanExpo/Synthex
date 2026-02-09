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

import { useState, useCallback, useEffect } from 'react';
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
  shareContent: (options: ShareOptions) => Promise<{ share: ContentShare; shareUrl?: string } | null>;
  revokeShare: (shareId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  getShareUrl: (share: ContentShare) => string | null;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useContentShare(options: UseContentShareOptions): UseContentShareReturn {
  const { contentType, contentId, autoLoad = true } = options;

  const [shares, setShares] = useState<ContentShare[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch shares for content
   */
  const fetchShares = useCallback(async () => {
    if (!contentType || !contentId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/content/share?contentType=${contentType}&contentId=${contentId}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch shares');
      }

      const data = await response.json();
      setShares(
        (data.shares || []).map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          expiresAt: s.expiresAt ? new Date(s.expiresAt) : undefined,
          lastAccessedAt: s.lastAccessedAt ? new Date(s.lastAccessedAt) : undefined,
        }))
      );
    } catch (err) {
      setError(err as Error);
      console.error('Fetch shares error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [contentType, contentId]);

  /**
   * Share content
   */
  const shareContent = useCallback(
    async (shareOptions: ShareOptions): Promise<{ share: ContentShare; shareUrl?: string } | null> => {
      setIsLoading(true);
      setError(null);

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
          expiresAt: data.share.expiresAt ? new Date(data.share.expiresAt) : undefined,
        };

        if (data.updated) {
          setShares((prev) =>
            prev.map((s) => (s.id === newShare.id ? newShare : s))
          );
          toast.success('Share updated');
        } else {
          setShares((prev) => [newShare, ...prev]);
          toast.success('Content shared successfully');
        }

        return { share: newShare, shareUrl: data.shareUrl };
      } catch (err) {
        setError(err as Error);
        toast.error((err as Error).message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [contentType, contentId]
  );

  /**
   * Revoke a share
   */
  const revokeShare = useCallback(async (shareId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/content/share?id=${shareId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to revoke share');
      }

      setShares((prev) => prev.filter((s) => s.id !== shareId));
      toast.success('Share revoked');
      return true;
    } catch (err) {
      setError(err as Error);
      toast.error((err as Error).message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get share URL
   */
  const getShareUrl = useCallback((share: ContentShare): string | null => {
    if (!share.accessLink) return null;
    return `${window.location.origin}/shared/${share.accessLink}`;
  }, []);

  /**
   * Auto-load on mount
   */
  useEffect(() => {
    if (autoLoad && contentType && contentId) {
      fetchShares();
    }
  }, [autoLoad, fetchShares, contentType, contentId]);

  return {
    shares,
    isLoading,
    error,
    shareContent,
    revokeShare,
    refresh: fetchShares,
    getShareUrl,
  };
}

/**
 * Hook for shares that were shared with the current user
 */
export function useSharedWithMe() {
  const [shares, setShares] = useState<ContentShare[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchShares = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/content/share?sharedWithMe=true', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch shared content');
      }

      const data = await response.json();
      setShares(
        (data.shares || []).map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          expiresAt: s.expiresAt ? new Date(s.expiresAt) : undefined,
        }))
      );
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  return {
    shares,
    isLoading,
    error,
    refresh: fetchShares,
  };
}

export default useContentShare;
