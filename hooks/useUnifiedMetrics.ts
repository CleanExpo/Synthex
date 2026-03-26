/**
 * Unified Metrics Hook
 *
 * @description Fetches and manages unified metrics across all connected platforms.
 * Provides aggregated totals, per-platform breakdown, and time series data.
 */

'use client';

import useSWR from 'swr';

// ============================================================================
// TYPES
// ============================================================================

export interface PlatformMetrics {
  id: string;
  name: string;
  connected: boolean;
  followers: number;
  engagement: number;
  posts: number;
  engagementRate: number;
  growth: number;
  lastSync: string | null;
  color: string;
  icon: string;
}

export interface TimelineDataPoint {
  date: string;
  [platform: string]: number | string;
}

export interface UnifiedInsights {
  topPlatform: string | null;
  fastestGrowing: string | null;
  bestEngagementRate: string | null;
}

export interface UnifiedMetrics {
  totals: {
    followers: number;
    engagement: number;
    reach: number;
    posts: number;
    averageEngagementRate: number;
  };
  platforms: PlatformMetrics[];
  timeline: TimelineDataPoint[];
  insights: UnifiedInsights;
}

export interface UseUnifiedMetricsOptions {
  period?: '7d' | '30d' | '90d';
  startDate?: string;
  endDate?: string;
}

// ============================================================================
// FETCHER
// ============================================================================

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const result = await res.json();
  if (!result.success)
    throw new Error(result.error || 'Failed to fetch metrics');
  return result.data as T;
}

// ============================================================================
// HOOK
// ============================================================================

export function useUnifiedMetrics(options: UseUnifiedMetricsOptions = {}) {
  const { period = '30d', startDate, endDate } = options;

  const params = new URLSearchParams();
  params.set('period', period);
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);

  const { data, error, isLoading, mutate } = useSWR<UnifiedMetrics>(
    `/api/unified/metrics?${params.toString()}`,
    fetchJson,
    { revalidateOnFocus: false }
  );

  return {
    data: data ?? null,
    isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : String(error)
      : null,
    refetch: mutate,
  };
}

export default useUnifiedMetrics;
