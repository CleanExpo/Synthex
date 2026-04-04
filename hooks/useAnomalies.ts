/**
 * SWR hook for anomaly detection alerts.
 *
 * UNI-1611
 */

import useSWR from 'swr';
import { fetchJson } from '@/lib/fetcher';

export interface AnomalyItem {
  id: string;
  userId: string;
  accountId?: string;
  platform?: string;
  metricType: string;
  anomalyType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  value: number;
  expectedValue: number;
  deviation: number;
  deviationPercent: number;
  timestamp: string;
  detectedAt: string;
  possibleCauses: string[];
  recommendations: string[];
  acknowledged: boolean;
  resolvedAt?: string;
  notes?: string;
}

interface AnomaliesResponse {
  anomalies: AnomalyItem[];
  total: number;
  limit: number;
  offset: number;
}

export function useAnomalies() {
  const { data, error, isLoading, mutate } = useSWR<AnomaliesResponse>(
    '/api/analytics/anomalies?acknowledged=false&limit=20',
    fetchJson
  );

  const acknowledge = async (anomalyId: string, notes?: string) => {
    const res = await fetch('/api/analytics/anomalies?action=acknowledge', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anomalyId, notes }),
    });

    if (!res.ok) {
      throw new Error('Failed to acknowledge anomaly');
    }

    // Re-fetch the list after acknowledging
    await mutate();
  };

  return {
    anomalies: data?.anomalies ?? [],
    total: data?.total ?? 0,
    isLoading,
    error: error?.message,
    refresh: mutate,
    acknowledge,
  };
}
