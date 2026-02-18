/**
 * Audience Insights Hook
 *
 * @description Fetches and manages audience demographics, behavior patterns,
 * and growth data across all connected platforms.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface AudienceDemographics {
  ageRanges: Array<{ range: string; percentage: number; count: number }>;
  genderSplit: Array<{ gender: string; percentage: number; count: number }>;
  topLocations: Array<{ location: string; country: string; percentage: number; count: number }>;
  topLanguages: Array<{ language: string; percentage: number }>;
}

export interface AudienceBehavior {
  bestPostingTimes: Array<{ day: number; hour: number; engagement: number }>;
  activeHours: Array<{ hour: number; activity: number }>;
  peakDays: Array<{ day: string; activity: number }>;
}

export interface AudienceGrowth {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: Array<{ date: string; followers: number; gained: number; lost: number }>;
}

export interface PlatformAudienceData {
  id: string;
  name: string;
  color: string;
  demographics: AudienceDemographics;
  behavior: AudienceBehavior;
}

export interface AudienceInsights {
  demographics: AudienceDemographics;
  behavior: AudienceBehavior;
  growth: AudienceGrowth;
  platforms: PlatformAudienceData[];
  lastUpdated: string;
}

export interface UseAudienceInsightsOptions {
  platform?: string; // 'all' | specific platform id
  period?: '7d' | '30d' | '90d';
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

export function useAudienceInsights(options: UseAudienceInsightsOptions = {}) {
  const { platform = 'all', period = '30d' } = options;

  // State
  const [data, setData] = useState<AudienceInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch audience insights
  const fetchInsights = useCallback(async () => {
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

      const response = await fetch(`/api/audience/insights?${params.toString()}`, {
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
        throw new Error(result.error || 'Failed to fetch audience insights');
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
    await fetchInsights();
  }, [fetchInsights]);

  // Initial fetch
  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

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

export default useAudienceInsights;
