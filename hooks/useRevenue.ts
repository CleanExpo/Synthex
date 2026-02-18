/**
 * Revenue Hook
 *
 * @description Fetches and manages revenue data with CRUD mutations.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  RevenueEntry,
  RevenueSummary,
  RevenueSource,
  CreateRevenueInput,
  UpdateRevenueInput,
} from '@/lib/revenue/revenue-service';

// Re-export types for consumers
export type { RevenueEntry, RevenueSummary, RevenueSource, CreateRevenueInput, UpdateRevenueInput };

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
// HELPERS
// ============================================================================

function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' };

  const token =
    localStorage.getItem('auth_token') ||
    sessionStorage.getItem('auth_token') ||
    localStorage.getItem('token');

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ============================================================================
// HOOK
// ============================================================================

export function useRevenue(options: UseRevenueOptions = {}) {
  const { source, platform, startDate, endDate } = options;

  // State
  const [data, setData] = useState<RevenueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  // Refs
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch revenue data
  const fetchRevenue = useCallback(async () => {
    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (source) params.set('source', source);
      if (platform) params.set('platform', platform);
      if (startDate) params.set('startDate', startDate.toISOString());
      if (endDate) params.set('endDate', endDate.toISOString());

      const response = await fetch(`/api/revenue?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders(),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.success && mountedRef.current) {
        setData(result.data);
      } else if (!result.success) {
        throw new Error(result.error || 'Failed to fetch revenue data');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [source, platform, startDate, endDate]);

  // Refetch function
  const refetch = useCallback(async () => {
    await fetchRevenue();
  }, [fetchRevenue]);

  // Create entry mutation
  const createEntry = useCallback(async (input: CreateRevenueInput): Promise<RevenueEntry> => {
    setIsMutating(true);
    try {
      const response = await fetch('/api/revenue', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...input,
          paidAt: input.paidAt instanceof Date ? input.paidAt.toISOString() : input.paidAt,
          periodStart: input.periodStart instanceof Date ? input.periodStart.toISOString() : input.periodStart,
          periodEnd: input.periodEnd instanceof Date ? input.periodEnd.toISOString() : input.periodEnd,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create entry');
      }

      // Refetch to get updated data
      await fetchRevenue();

      return result.data;
    } finally {
      setIsMutating(false);
    }
  }, [fetchRevenue]);

  // Update entry mutation
  const updateEntry = useCallback(async (id: string, input: UpdateRevenueInput): Promise<RevenueEntry> => {
    setIsMutating(true);
    try {
      const body: Record<string, unknown> = { ...input };
      if (input.paidAt instanceof Date) body.paidAt = input.paidAt.toISOString();
      if (input.periodStart instanceof Date) body.periodStart = input.periodStart.toISOString();
      if (input.periodEnd instanceof Date) body.periodEnd = input.periodEnd.toISOString();

      const response = await fetch(`/api/revenue/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update entry');
      }

      // Refetch to get updated data
      await fetchRevenue();

      return result.data;
    } finally {
      setIsMutating(false);
    }
  }, [fetchRevenue]);

  // Delete entry mutation
  const deleteEntry = useCallback(async (id: string): Promise<void> => {
    setIsMutating(true);
    try {
      const response = await fetch(`/api/revenue/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete entry');
      }

      // Refetch to get updated data
      await fetchRevenue();
    } finally {
      setIsMutating(false);
    }
  }, [fetchRevenue]);

  // Initial fetch
  useEffect(() => {
    fetchRevenue();
  }, [fetchRevenue]);

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    data,
    isLoading,
    error,
    isMutating,
    refetch,
    createEntry,
    updateEntry,
    deleteEntry,
  };
}

export default useRevenue;
