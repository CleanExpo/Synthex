/**
 * Content Performance Hook
 *
 * @description Fetches and manages content performance analysis data
 * including patterns, insights, and top/low performers.
 */

'use client';

import useSWR from 'swr';
import type {
  ContentPerformanceAnalysis,
  PostPerformance,
  PerformanceInsight,
} from '@/lib/ai/content-performance-analyzer';

// Re-export types for consumers
export type { ContentPerformanceAnalysis, PostPerformance, PerformanceInsight };

// ============================================================================
// TYPES
// ============================================================================

export interface UseContentPerformanceOptions {
  platform?: string; // 'all' | specific platform id
  period?: '7d' | '30d' | '90d';
  includeAI?: boolean;
}

export interface ContentPerformanceData extends ContentPerformanceAnalysis {
  meta?: {
    platform: string;
    period: string;
    postsAnalyzed: number;
    lastUpdated: string;
  };
}

// ============================================================================
// FETCHER
// ============================================================================

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const result = await res.json();
  if (!result.success)
    throw new Error(result.error || 'Failed to fetch performance data');
  return { ...result.data, meta: result.meta } as T;
}

// ============================================================================
// HOOK
// ============================================================================

export function useContentPerformance(
  options: UseContentPerformanceOptions = {}
) {
  const { platform = 'all', period = '30d', includeAI = true } = options;

  const params = new URLSearchParams();
  params.set('platform', platform);
  params.set('period', period);
  params.set('includeAI', String(includeAI));

  const { data, error, isLoading, mutate } = useSWR<ContentPerformanceData>(
    `/api/content/performance?${params.toString()}`,
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

export default useContentPerformance;
