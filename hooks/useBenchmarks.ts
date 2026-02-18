/**
 * Benchmarks Hook
 *
 * @description Fetches and manages benchmark comparison data
 * comparing user's performance to industry standards.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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

// ============================================================================
// HELPERS
// ============================================================================

function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' };

  const token =
    localStorage.getItem('auth_token') ||
    sessionStorage.getItem('auth_token') ||
    localStorage.getItem('token');

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ============================================================================
// HOOK
// ============================================================================

export function useBenchmarks(options: UseBenchmarksOptions = {}) {
  const { platform = 'all', period = '30d' } = options;

  // State
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch benchmark data
  const fetchBenchmarks = useCallback(async () => {
    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('platform', platform);
      params.set('period', period);

      const response = await fetch(`/api/analytics/benchmarks?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders(),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.success && mountedRef.current) {
        setData({
          ...result.data,
          meta: result.meta,
        });
      } else if (!result.success) {
        throw new Error(result.error || 'Failed to fetch benchmark data');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [platform, period]);

  // Refetch function
  const refetch = useCallback(async () => {
    await fetchBenchmarks();
  }, [fetchBenchmarks]);

  // Initial fetch
  useEffect(() => {
    fetchBenchmarks();
  }, [fetchBenchmarks]);

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    data,
    isLoading,
    error,
    refetch,
  };
}

export default useBenchmarks;
