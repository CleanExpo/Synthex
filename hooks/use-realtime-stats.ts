/**
 * Real-Time Stats Hook
 *
 * @description React hook for real-time dashboard statistics.
 *
 * NOT PROVISIONED: this hook read `posts` / `platform_metrics` and subscribed
 * to Postgres changes through the Supabase client, which has been removed
 * (lib/platform/noop-client retired). No existing API route returns these
 * fields (per-status post counts, likes/comments/shares/views breakdown), and
 * there is no realtime channel, so the hook reports unavailable honestly:
 * `stats` stays null, `isConnected` stays false, and `error` is a
 * {@link RealtimeStatsNotProvisionedError} once a user is given. It never
 * returns fabricated zeros.
 */

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface DashboardStats {
  posts: {
    total: number;
    published: number;
    scheduled: number;
    draft: number;
  };
  engagement: {
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalViews: number;
    engagementRate: number;
  };
  followers: {
    total: number;
    growth: number;
    growthPercentage: number;
  };
  performance: {
    topPost: {
      id: string;
      content: string;
      engagement: number;
    } | null;
    bestTime: string;
    bestDay: string;
  };
  lastUpdated: Date;
}

export interface RealtimeStatsOptions {
  pollingFallbackMs?: number;
  enableRealtime?: boolean;
  tables?: string[];
}

export interface RealtimeStatsResult {
  stats: DashboardStats | null;
  isLoading: boolean;
  error: Error | null;
  isConnected: boolean;
  refresh: () => Promise<void>;
}

// ============================================================================
// NOT PROVISIONED
// ============================================================================

export class RealtimeStatsNotProvisionedError extends Error {
  readonly code = 'FEATURE_NOT_PROVISIONED' as const;

  constructor() {
    super(
      'Real-time dashboard stats are not available: the Supabase realtime client was removed ' +
        'and no API route provides these fields. Nothing was read.'
    );
    this.name = 'RealtimeStatsNotProvisionedError';
  }
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useRealtimeStats(
  userId: string | null,
  _options: RealtimeStatsOptions = {}
): RealtimeStatsResult {
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setError(userId ? new RealtimeStatsNotProvisionedError() : null);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    stats: null,
    isLoading: false,
    error,
    isConnected: false,
    refresh,
  };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook for just engagement metrics
 */
export function useEngagementMetrics(userId: string | null) {
  const { stats, isLoading, error, refresh } = useRealtimeStats(userId, {
    tables: ['platform_metrics'],
  });

  return {
    engagement: stats?.engagement || null,
    isLoading,
    error,
    refresh,
  };
}

/**
 * Hook for just post counts
 */
export function usePostCounts(userId: string | null) {
  const { stats, isLoading, error, refresh } = useRealtimeStats(userId, {
    tables: ['posts'],
  });

  return {
    posts: stats?.posts || null,
    isLoading,
    error,
    refresh,
  };
}

// Export default
export default useRealtimeStats;
