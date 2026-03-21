/**
 * SWR hook for the user engagement health score.
 *
 * UNI-1611
 */

import useSWR from 'swr';
import { fetchJson } from '@/lib/fetcher';

interface UserHealthScore {
  score: number;
  trend: string;
  riskLevel: string;
  loginScore: number;
  contentScore: number;
  featureScore: number;
  engagementScore: number;
  growthScore: number;
  updatedAt: string | null;
}

export function useHealthScore() {
  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    healthScore: UserHealthScore;
  }>('/api/user/health-score', fetchJson);

  return {
    healthScore: data?.healthScore ?? null,
    isLoading,
    error: error?.message,
    refresh: mutate,
  };
}
