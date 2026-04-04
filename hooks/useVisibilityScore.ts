/**
 * SWR hook for the organisation visibility score.
 * SYN-473
 */

import useSWR from 'swr';
import { fetchJson } from '@/lib/fetcher';

interface VisibilityScoreData {
  id: string;
  score: number;
  reviewScore: number;
  gbpScore: number;
  contentScore: number;
  rankScore: number;
  calculatedAt: string;
}

interface UseVisibilityScoreResult {
  visibilityScore: VisibilityScoreData | null;
  previousScore: number | null;
  delta: number | null;
  isLoading: boolean;
  error: string | undefined;
  refresh: () => void;
}

export function useVisibilityScore(): UseVisibilityScoreResult {
  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    visibilityScore: VisibilityScoreData | null;
    previousScore: number | null;
    delta: number | null;
  }>('/api/scoring/visibility', fetchJson);

  return {
    visibilityScore: data?.visibilityScore ?? null,
    previousScore: data?.previousScore ?? null,
    delta: data?.delta ?? null,
    isLoading,
    error: error?.message,
    refresh: mutate,
  };
}
