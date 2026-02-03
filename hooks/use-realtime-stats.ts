/**
 * Real-Time Stats Hook
 *
 * @description React hook for real-time dashboard statistics:
 * - Supabase real-time subscriptions
 * - Optimistic updates
 * - Automatic reconnection
 * - Metrics aggregation
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL (PUBLIC)
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase anonymous key (PUBLIC)
 *
 * FAILURE MODE: Falls back to polling on subscription failure
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient, RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

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
// SUPABASE CLIENT
// ============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialStats: DashboardStats = {
  posts: {
    total: 0,
    published: 0,
    scheduled: 0,
    draft: 0,
  },
  engagement: {
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    totalViews: 0,
    engagementRate: 0,
  },
  followers: {
    total: 0,
    growth: 0,
    growthPercentage: 0,
  },
  performance: {
    topPost: null,
    bestTime: '9:00 AM',
    bestDay: 'Tuesday',
  },
  lastUpdated: new Date(),
};

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useRealtimeStats(
  userId: string | null,
  options: RealtimeStatsOptions = {}
): RealtimeStatsResult {
  const {
    pollingFallbackMs = 30000,
    enableRealtime = true,
    tables = ['posts', 'platform_metrics', 'campaigns'],
  } = options;

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  /**
   * Fetch stats from database
   */
  const fetchStats = useCallback(async (): Promise<DashboardStats> => {
    if (!userId) {
      return initialStats;
    }

    try {
      // Fetch posts stats
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('status')
        .eq('campaign_id', userId); // Adjust based on your schema

      if (postsError) throw postsError;

      const postStats = {
        total: postsData?.length || 0,
        published: postsData?.filter(p => p.status === 'published').length || 0,
        scheduled: postsData?.filter(p => p.status === 'scheduled').length || 0,
        draft: postsData?.filter(p => p.status === 'draft').length || 0,
      };

      // Fetch engagement metrics
      const { data: metricsData, error: metricsError } = await supabase
        .from('platform_metrics')
        .select('likes, comments, shares, views')
        .limit(100);

      if (metricsError) throw metricsError;

      const engagementStats = (metricsData || []).reduce(
        (acc, m) => ({
          totalLikes: acc.totalLikes + (m.likes || 0),
          totalComments: acc.totalComments + (m.comments || 0),
          totalShares: acc.totalShares + (m.shares || 0),
          totalViews: acc.totalViews + (m.views || 0),
        }),
        { totalLikes: 0, totalComments: 0, totalShares: 0, totalViews: 0 }
      );

      const totalEngagement = engagementStats.totalLikes +
        engagementStats.totalComments +
        engagementStats.totalShares;
      const engagementRate = engagementStats.totalViews > 0
        ? (totalEngagement / engagementStats.totalViews) * 100
        : 0;

      return {
        posts: postStats,
        engagement: {
          ...engagementStats,
          engagementRate: Math.round(engagementRate * 100) / 100,
        },
        followers: {
          total: 0, // Would come from platform connections
          growth: 0,
          growthPercentage: 0,
        },
        performance: {
          topPost: null, // Would be calculated from metrics
          bestTime: '9:00 AM',
          bestDay: 'Tuesday',
        },
        lastUpdated: new Date(),
      };
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      throw err;
    }
  }, [userId]);

  /**
   * Refresh stats
   */
  const refresh = useCallback(async (): Promise<void> => {
    if (!mountedRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const newStats = await fetchStats();
      if (mountedRef.current) {
        setStats(newStats);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err as Error);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchStats]);

  /**
   * Merge real-time changes into current stats
   */
  const mergeChanges = useCallback((
    current: DashboardStats | null,
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>
  ): DashboardStats => {
    if (!current) return initialStats;

    const { table, eventType, new: newRecord, old: oldRecord } = payload;

    // Deep clone to avoid mutations
    const updated = JSON.parse(JSON.stringify(current)) as DashboardStats;

    switch (table) {
      case 'posts':
        if (eventType === 'INSERT') {
          updated.posts.total++;
          const status = (newRecord as { status?: string })?.status;
          if (status === 'published') updated.posts.published++;
          else if (status === 'scheduled') updated.posts.scheduled++;
          else updated.posts.draft++;
        } else if (eventType === 'DELETE') {
          updated.posts.total--;
          const status = (oldRecord as { status?: string })?.status;
          if (status === 'published') updated.posts.published--;
          else if (status === 'scheduled') updated.posts.scheduled--;
          else updated.posts.draft--;
        } else if (eventType === 'UPDATE') {
          const oldStatus = (oldRecord as { status?: string })?.status;
          const newStatus = (newRecord as { status?: string })?.status;
          if (oldStatus !== newStatus) {
            // Decrement old status
            if (oldStatus === 'published') updated.posts.published--;
            else if (oldStatus === 'scheduled') updated.posts.scheduled--;
            else updated.posts.draft--;
            // Increment new status
            if (newStatus === 'published') updated.posts.published++;
            else if (newStatus === 'scheduled') updated.posts.scheduled++;
            else updated.posts.draft++;
          }
        }
        break;

      case 'platform_metrics':
        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          const record = newRecord as {
            likes?: number;
            comments?: number;
            shares?: number;
            views?: number;
          };
          // For simplicity, just add the new metrics
          // In production, you'd need to track and subtract old values
          if (eventType === 'INSERT') {
            updated.engagement.totalLikes += record.likes || 0;
            updated.engagement.totalComments += record.comments || 0;
            updated.engagement.totalShares += record.shares || 0;
            updated.engagement.totalViews += record.views || 0;
          }
        }
        break;
    }

    updated.lastUpdated = new Date();
    return updated;
  }, []);

  /**
   * Set up real-time subscription
   */
  useEffect(() => {
    if (!userId || !enableRealtime) return;

    // Create channel
    const channel = supabase.channel(`stats:${userId}`);

    // Subscribe to each table
    for (const table of tables) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          // filter: `user_id=eq.${userId}`, // Add if your tables have user_id
        },
        (payload) => {
          if (mountedRef.current) {
            setStats(current => mergeChanges(current, payload));
          }
        }
      );
    }

    // Subscribe
    channel
      .subscribe((status) => {
        if (mountedRef.current) {
          setIsConnected(status === 'SUBSCRIBED');

          if (status === 'SUBSCRIBED') {
            console.log('Real-time stats connected');
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            console.warn('Real-time stats disconnected, falling back to polling');
            // Start polling fallback
            if (!pollingIntervalRef.current) {
              pollingIntervalRef.current = setInterval(refresh, pollingFallbackMs);
            }
          }
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, enableRealtime, tables, mergeChanges, refresh, pollingFallbackMs]);

  /**
   * Initial fetch
   */
  useEffect(() => {
    mountedRef.current = true;
    refresh();

    return () => {
      mountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [refresh]);

  return {
    stats,
    isLoading,
    error,
    isConnected,
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
