/**
 * Benchmarks Hook
 *
 * @description Fetches and manages benchmark comparison data
 * comparing user's performance to industry standards.
 *
 * Uses SWR for data fetching with credentials: 'include'.
 */

'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import type {
  BenchmarkReport,
  PlatformReport,
  BenchmarkComparison,
} from '@/lib/analytics/benchmark-service';

// Re-export types for consumers
export type { BenchmarkReport, PlatformReport, BenchmarkComparison };

// ============================================================================
// TYPES
// ============================================================================

export interface UseBenchmarksOptions {
  platform?: string; // 'all' | specific platform
  period?: '7d' | '30d' | '90d';
}

export interface BenchmarkData extends BenchmarkReport {
  meta?: {
    platform: string;
    period: string;
    platformsAnalyzed: number;
    postsAnalyzed: number;
  };
}

interface ApiResponse {
  success: boolean;
  data: BenchmarkReport;
  meta?: {
    platform: string;
    period: string;
    platformsAnalyzed: number;
    postsAnalyzed: number;
  };
  error?: string;
}

// ============================================================================
// FETCHER
// ============================================================================

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useBenchmarks(options: UseBenchmarksOptions = {}) {
  const { platform = 'all', period = '30d' } = options;

  const params = new URLSearchParams();
  params.set('platform', platform);
  params.set('period', period);
  const url = `/api/analytics/benchmarks?${params.toString()}`;

  const {
    data: response,
    error,
    isLoading,
    mutate,
  } = useSWR<ApiResponse>(url, fetchJson, { revalidateOnFocus: false });

  const data: BenchmarkData | null = response?.success
    ? { ...response.data, meta: response.meta }
    : null;

  const refetch = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    data,
    isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : String(error)
      : null,
    refetch,
  };
}

export default useBenchmarks;
