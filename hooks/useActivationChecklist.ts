'use client';

/**
 * Activation Checklist Hook
 *
 * SWR hook for the 5-step activation sequence (UNI-1615).
 * Drives the GetStartedChecklist component on the dashboard.
 */

import useSWR from 'swr';
import type { ChecklistStatus } from '@/app/api/onboarding/checklist/route';

interface ChecklistResponse {
  status: ChecklistStatus;
}

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => {
    if (!r.ok) throw new Error('checklist fetch failed');
    return r.json() as Promise<ChecklistResponse>;
  });

export function useActivationChecklist() {
  const { data, error, isLoading, mutate } = useSWR<ChecklistResponse>(
    '/api/onboarding/checklist',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  const status = data?.status ?? {
    url_health_check: false,
    social_connection: false,
    gmb_connection: false,
    llm_integration: false,
    first_post: false,
  };

  const completedCount = Object.values(status).filter(Boolean).length;
  const allComplete = completedCount === 5;

  return {
    status,
    completedCount,
    allComplete,
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}
