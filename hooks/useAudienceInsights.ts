/**
 * Audience Insights Hook
 *
 * @description Fetches and manages audience demographics, behaviour patterns,
 * and growth data across all connected platforms.
 *
 * Uses SWR for data fetching with credentials: 'include'.
 */

'use client';

import { useCallback } from 'react';
import useSWR from 'swr';

// ============================================================================
// TYPES
// ============================================================================

export interface AudienceDemographics {
  ageRanges: Array<{ range: string; percentage: number; count: number }>;
  genderSplit: Array<{ gender: string; percentage: number; count: number }>;
  topLocations: Array<{
    location: string;
    country: string;
    percentage: number;
    count: number;
  }>;
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
  trend: Array<{
    date: string;
    followers: number;
    gained: number;
    lost: number;
  }>;
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

interface ApiResponse {
  success: boolean;
  data: AudienceInsights;
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

export function useAudienceInsights(options: UseAudienceInsightsOptions = {}) {
  const { platform = 'all', period = '30d' } = options;

  const params = new URLSearchParams();
  params.set('platform', platform);
  params.set('period', period);
  const url = `/api/audience/insights?${params.toString()}`;

  const {
    data: response,
    error,
    isLoading,
    mutate,
  } = useSWR<ApiResponse>(url, fetchJson, { revalidateOnFocus: false });

  const data = response?.success ? response.data : null;

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

export default useAudienceInsights;
