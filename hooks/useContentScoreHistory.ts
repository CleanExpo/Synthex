/**
 * SWR hook for the organisation's weekly Content Score history.
 *
 * @task SYN-665
 */

import useSWR from 'swr';
import { fetchJson } from '@/lib/fetcher';
import type { ContentScoreRow } from '@/app/api/dashboard/content-score-history/route';

interface ContentScoreHistory {
  current: ContentScoreRow | null;
  history: Array<{ score: number; weekStart: string }>;
}

export function useContentScoreHistory() {
  const { data, error, isLoading, mutate } = useSWR<ContentScoreHistory>(
    '/api/dashboard/content-score-history',
    fetchJson
  );

  return {
    current: data?.current ?? null,
    history: data?.history ?? [],
    isLoading,
    error: error?.message ?? (error ? String(error) : null),
    refresh: mutate,
  };
}
