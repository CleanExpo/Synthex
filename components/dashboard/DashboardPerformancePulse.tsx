'use client';

import useSWR from 'swr';
import { fetchJson } from '@/lib/fetcher';
import { PerformancePulse } from '@/components/command-centre/PerformancePulse';
import type { PerformanceData } from '@/components/command-centre/types';

export function DashboardPerformancePulse() {
  const { data, isLoading } = useSWR<PerformanceData>(
    '/api/command-centre/performance',
    fetchJson,
    { refreshInterval: 60_000 }
  );

  if (isLoading) {
    return (
      <div className="h-36 animate-pulse rounded-sm border border-white/6 bg-white/2" />
    );
  }

  if (!data) return null;

  return <PerformancePulse data={data} variant="compact" />;
}
