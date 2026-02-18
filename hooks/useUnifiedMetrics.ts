/**
 * Unified Metrics Hook
 *
 * @description Fetches and manages unified metrics across all connected platforms.
 * Provides aggregated totals, per-platform breakdown, and time series data.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

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

export function useUnifiedMetrics(options: UseUnifiedMetricsOptions = {}) {
  const { period = '30d', startDate, endDate } = options;

  // State
  const [data, setData] = useState<UnifiedMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch metrics
  const fetchMetrics = useCallback(async () => {
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
      params.set('period', period);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const response = await fetch(`/api/unified/metrics?${params.toString()}`, {
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
        setData(result.data);
      } else if (!result.success) {
        throw new Error(result.error || 'Failed to fetch metrics');
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
  }, [period, startDate, endDate]);

  // Refetch function
  const refetch = useCallback(async () => {
    await fetchMetrics();
  }, [fetchMetrics]);

  // Initial fetch
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

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

export default useUnifiedMetrics;
