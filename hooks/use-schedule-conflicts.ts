'use client';

/**
 * useScheduleConflicts Hook
 *
 * Fetches existing scheduled posts for a date range and provides
 * a `checkConflict()` function to detect same-platform overlaps
 * within a configurable buffer window.
 *
 * Uses SWR to fetch from `/api/scheduler/posts` with status=scheduled.
 *
 * @module hooks/use-schedule-conflicts
 */

import useSWR from 'swr';
import { useMemo, useCallback } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface ScheduleConflict {
  existingPostId: string;
  platform: string;
  scheduledAt: Date;
  content: string; // first 60 chars
}

export interface UseScheduleConflictsOptions {
  startDate: Date;
  endDate: Date;
  enabled?: boolean;
}

export interface UseScheduleConflictsResult {
  /** All existing scheduled posts in the date range */
  existingPosts: Array<{
    id: string;
    platform: string;
    scheduledAt: Date;
    content: string;
  }>;
  /**
   * Check if a proposed time conflicts with an existing post on the same
   * platform within `bufferMinutes` (default 30).
   */
  checkConflict: (
    platform: string,
    proposedTime: Date,
    bufferMinutes?: number
  ) => ScheduleConflict | null;
  /** Whether data is still loading */
  isLoading: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

interface SchedulerApiPost {
  id: string;
  platform: string;
  content: string;
  status: string;
  scheduledAt: string | null;
}

interface SchedulerApiResponse {
  data: SchedulerApiPost[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch scheduled posts');
  return res.json();
}

// =============================================================================
// Hook
// =============================================================================

export function useScheduleConflicts({
  startDate,
  endDate,
  enabled = true,
}: UseScheduleConflictsOptions): UseScheduleConflictsResult {
  // Build API URL with date range and status filter
  const apiUrl = useMemo(() => {
    if (!enabled) return null;

    const start = startDate.toISOString();
    const end = endDate.toISOString();

    return `/api/scheduler/posts?status=scheduled&startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}&limit=100&sortBy=scheduledAt&sortOrder=asc`;
  }, [enabled, startDate, endDate]);

  const { data, isLoading } = useSWR<SchedulerApiResponse>(
    apiUrl,
    fetchJson,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60 * 1000, // 1 minute dedup
    }
  );

  // Transform API response into normalised post list
  const existingPosts = useMemo(() => {
    if (!data?.data) return [];

    return data.data
      .filter((post) => post.scheduledAt)
      .map((post) => ({
        id: post.id,
        platform: post.platform.toLowerCase(),
        scheduledAt: new Date(post.scheduledAt!),
        content: post.content.slice(0, 60),
      }));
  }, [data]);

  // Check for conflicts: same platform within bufferMinutes
  const checkConflict = useCallback(
    (
      platform: string,
      proposedTime: Date,
      bufferMinutes: number = 30
    ): ScheduleConflict | null => {
      const platformLower = platform.toLowerCase();
      const bufferMs = bufferMinutes * 60 * 1000;
      const proposedMs = proposedTime.getTime();

      for (const post of existingPosts) {
        if (post.platform !== platformLower) continue;

        const diff = Math.abs(post.scheduledAt.getTime() - proposedMs);
        if (diff < bufferMs) {
          return {
            existingPostId: post.id,
            platform: post.platform,
            scheduledAt: post.scheduledAt,
            content: post.content,
          };
        }
      }

      return null;
    },
    [existingPosts]
  );

  return { existingPosts, checkConflict, isLoading };
}
