/**
 * SWR hook for the composite 100/100 health score.
 *
 * UNI-1610
 */

import useSWR from 'swr';
import { fetchJson } from '@/lib/fetcher';
import type { CompositeHealthScore } from '@/lib/health/composite-score';

export function useCompositeHealth() {
  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    score: CompositeHealthScore;
  }>('/api/health/composite', fetchJson);

  return {
    score: data?.score ?? null,
    isLoading,
    error: error?.message,
    refresh: mutate,
  };
}
