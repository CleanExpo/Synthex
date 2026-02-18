/**
 * Content Performance Hook
 *
 * @description Fetches and manages content performance analysis data
 * including patterns, insights, and top/low performers.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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

export function useContentPerformance(options: UseContentPerformanceOptions = {}) {
  const { platform = 'all', period = '30d', includeAI = true } = options;

  // State
  const [data, setData] = useState<ContentPerformanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch performance data
  const fetchPerformance = useCallback(async () => {
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
      params.set('includeAI', String(includeAI));

      const response = await fetch(`/api/content/performance?${params.toString()}`, {
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
        throw new Error(result.error || 'Failed to fetch performance data');
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
  }, [platform, period, includeAI]);

  // Refetch function
  const refetch = useCallback(async () => {
    await fetchPerformance();
  }, [fetchPerformance]);

  // Initial fetch
  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

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

export default useContentPerformance;
