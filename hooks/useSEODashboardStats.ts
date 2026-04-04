/**
 * SWR hook for SEO dashboard quick-stat cards.
 *
 * Fetches aggregate stats from /api/seo/dashboard-stats:
 *   - SEO Health Score (latest audit)
 *   - Issues Found (from latest audit)
 *   - AI Visibility (latest GEO analysis)
 *
 * UNI-1616
 */

import useSWR from 'swr';
import { fetchJson } from '@/lib/fetcher';

interface StatValue {
  value: number | null;
  change: number | null;
  updatedAt: string | null;
}

interface SEODashboardStats {
  healthScore: StatValue;
  issuesFound: StatValue;
  aiVisibility: StatValue;
}

export function useSEODashboardStats() {
  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    stats: SEODashboardStats;
  }>('/api/seo/dashboard-stats', fetchJson);

  return {
    stats: data?.stats ?? null,
    isLoading,
    error: error?.message,
    refresh: mutate,
  };
}
