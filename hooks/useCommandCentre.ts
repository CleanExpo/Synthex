/**
 * Command Centre — Composite SWR Hook
 *
 * Composes SWR calls to all command-centre endpoints with
 * appropriate polling intervals.
 *
 * @module hooks/useCommandCentre
 */

'use client';

import useSWR from 'swr';
import { fetchJson } from '@/lib/fetcher';
import type {
  AutopilotStatus,
  AIActivityItem,
  PendingContent,
  PerformanceData,
  CommandCentreStats,
} from '@/components/command-centre/types';

export function useCommandCentre() {
  const status = useSWR<AutopilotStatus>(
    '/api/command-centre/status',
    fetchJson,
    { refreshInterval: 30_000 }
  );

  const activity = useSWR<{
    items: AIActivityItem[];
    nextCursor: string | null;
  }>('/api/command-centre/activity?limit=10', fetchJson, {
    refreshInterval: 30_000,
  });

  const pending = useSWR<{ items: PendingContent[]; total: number }>(
    '/api/command-centre/pending?limit=10',
    fetchJson,
    { refreshInterval: 15_000 }
  );

  const performance = useSWR<PerformanceData>(
    '/api/command-centre/performance',
    fetchJson,
    { refreshInterval: 60_000 }
  );

  const stats = useSWR<CommandCentreStats>(
    '/api/command-centre/stats',
    fetchJson,
    { refreshInterval: 30_000 }
  );

  return {
    status: status.data ?? null,
    activity: activity.data?.items ?? [],
    pending: pending.data?.items ?? [],
    pendingTotal: pending.data?.total ?? 0,
    performance: performance.data ?? null,
    stats: stats.data ?? null,
    isLoading:
      status.isLoading ||
      activity.isLoading ||
      pending.isLoading ||
      performance.isLoading ||
      stats.isLoading,
    error:
      status.error ||
      activity.error ||
      pending.error ||
      performance.error ||
      stats.error,
    mutateStatus: status.mutate,
    mutatePending: pending.mutate,
    mutateActivity: activity.mutate,
    mutateStats: stats.mutate,
  };
}
