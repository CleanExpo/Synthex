/**
 * Activity Hook
 *
 * @description Manages activity feed state.
 * Provides refresh and loadMore actions for pagination.
 *
 * Uses raw fetch + useState pattern (no SWR/TanStack Query).
 * Follows the same pattern as hooks/use-webhooks.ts.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type ActivityType =
  | 'post_created'
  | 'post_published'
  | 'post_scheduled'
  | 'post_edited'
  | 'post_deleted'
  | 'engagement_spike'
  | 'new_follower'
  | 'comment_received'
  | 'mention'
  | 'team_member_joined'
  | 'team_member_action'
  | 'system_alert'
  | 'campaign_started'
  | 'campaign_ended'
  | 'milestone_reached'
  | 'post'
  | 'engagement'
  | 'follower'
  | 'campaign'
  | 'comment';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  platform?: string;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  metadata?: Record<string, unknown>;
  read?: boolean;
}

export interface ActivityFilter {
  userId?: string;
  contentType?: string;
  limit?: number;
}

/** API response shape for GET /api/activity */
interface ActivityListResponse {
  activities: ActivityItem[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// HOOK
// ============================================================================

export function useActivity(filter?: ActivityFilter) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const limit = filter?.limit ?? 20;

  /**
   * Fetch activities from API
   */
  const fetchActivities = useCallback(
    async (currentOffset: number, append: boolean = false) => {
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
        const params = new URLSearchParams();
        params.set('limit', String(limit));
        params.set('offset', String(currentOffset));

        if (filter?.userId) {
          params.set('userId', filter.userId);
        }
        if (filter?.contentType) {
          params.set('types', filter.contentType);
        }

        const response = await fetch(`/api/activity?${params.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data: ActivityListResponse = await response.json();

        if (mountedRef.current) {
          if (append) {
            setActivities((prev) => [...prev, ...data.activities]);
          } else {
            setActivities(data.activities);
          }
          setHasMore(data.hasMore);
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
    },
    [filter?.userId, filter?.contentType, limit]
  );

  /**
   * Refresh the activities list (from beginning)
   */
  const refresh = useCallback(async (): Promise<void> => {
    setOffset(0);
    await fetchActivities(0, false);
  }, [fetchActivities]);

  /**
   * Load more activities (pagination)
   */
  const loadMore = useCallback(async (): Promise<void> => {
    if (!hasMore || loading) return;

    const newOffset = offset + limit;
    setOffset(newOffset);
    await fetchActivities(newOffset, true);
  }, [hasMore, loading, offset, limit, fetchActivities]);

  // Initial fetch on mount
  useEffect(() => {
    mountedRef.current = true;
    fetchActivities(0, false);

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchActivities]);

  return {
    activities,
    loading,
    error,
    hasMore,
    refresh,
    loadMore,
  };
}
