/**
 * Revenue Hook
 *
 * @description Fetches and manages revenue data with CRUD mutations.
 */

'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import type {
  RevenueEntry,
  RevenueSummary,
  RevenueSource,
  CreateRevenueInput,
  UpdateRevenueInput,
} from '@/lib/revenue/revenue-service';

// Re-export types for consumers
export type {
  RevenueEntry,
  RevenueSummary,
  RevenueSource,
  CreateRevenueInput,
  UpdateRevenueInput,
};

// ============================================================================
// TYPES
// ============================================================================

export interface UseRevenueOptions {
  source?: RevenueSource;
  platform?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface RevenueData {
  entries: RevenueEntry[];
  summary: RevenueSummary;
}

// ============================================================================
// FETCHER
// ============================================================================

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const result = await res.json();
  if (!result.success)
    throw new Error(result.error || 'Failed to fetch revenue data');
  return result.data as T;
}

// ============================================================================
// HOOK
// ============================================================================

export function useRevenue(options: UseRevenueOptions = {}) {
  const { source, platform, startDate, endDate } = options;

  const params = new URLSearchParams();
  if (source) params.set('source', source);
  if (platform) params.set('platform', platform);
  if (startDate) params.set('startDate', startDate.toISOString());
  if (endDate) params.set('endDate', endDate.toISOString());

  const { data, error, isLoading, mutate } = useSWR<RevenueData>(
    `/api/revenue?${params.toString()}`,
    fetchJson,
    { revalidateOnFocus: false }
  );

  // Create entry mutation
  const createEntry = useCallback(
    async (input: CreateRevenueInput): Promise<RevenueEntry> => {
      const response = await fetch('/api/revenue', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...input,
          paidAt:
            input.paidAt instanceof Date
              ? input.paidAt.toISOString()
              : input.paidAt,
          periodStart:
            input.periodStart instanceof Date
              ? input.periodStart.toISOString()
              : input.periodStart,
          periodEnd:
            input.periodEnd instanceof Date
              ? input.periodEnd.toISOString()
              : input.periodEnd,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create entry');
      }

      await mutate();
      return result.data;
    },
    [mutate]
  );

  // Update entry mutation
  const updateEntry = useCallback(
    async (id: string, input: UpdateRevenueInput): Promise<RevenueEntry> => {
      const body: Record<string, unknown> = { ...input };
      if (input.paidAt instanceof Date)
        body.paidAt = input.paidAt.toISOString();
      if (input.periodStart instanceof Date)
        body.periodStart = input.periodStart.toISOString();
      if (input.periodEnd instanceof Date)
        body.periodEnd = input.periodEnd.toISOString();

      const response = await fetch(`/api/revenue/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update entry');
      }

      await mutate();
      return result.data;
    },
    [mutate]
  );

  // Delete entry mutation
  const deleteEntry = useCallback(
    async (id: string): Promise<void> => {
      const response = await fetch(`/api/revenue/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete entry');
      }

      await mutate();
    },
    [mutate]
  );

  return {
    data: data ?? null,
    isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : String(error)
      : null,
    isMutating: false,
    refetch: mutate,
    createEntry,
    updateEntry,
    deleteEntry,
  };
}

export default useRevenue;
