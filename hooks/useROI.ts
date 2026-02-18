/**
 * ROI Hook
 *
 * @description Fetches ROI metrics and manages investment CRUD operations.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  ContentInvestment,
  ROIReport,
  InvestmentType,
  InvestmentCategory,
  CreateInvestmentInput,
  UpdateInvestmentInput,
} from '@/lib/roi/roi-service';

// Re-export types for consumers
export type {
  ContentInvestment,
  ROIReport,
  InvestmentType,
  InvestmentCategory,
  CreateInvestmentInput,
  UpdateInvestmentInput,
};

// ============================================================================
// TYPES
// ============================================================================

export interface UseROIOptions {
  type?: InvestmentType;
  category?: InvestmentCategory;
  platform?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ROIData {
  report: ROIReport;
  investments: ContentInvestment[];
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

export function useROI(options: UseROIOptions = {}) {
  const { type, category, platform, startDate, endDate } = options;

  // State
  const [data, setData] = useState<ROIData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  // Refs
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch ROI data (report + investments)
  const fetchROI = useCallback(async () => {
    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      // Build query params
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      if (category) params.set('category', category);
      if (platform) params.set('platform', platform);
      if (startDate) params.set('startDate', startDate.toISOString());
      if (endDate) params.set('endDate', endDate.toISOString());

      // Fetch both report and investments in parallel
      const [reportRes, investmentsRes] = await Promise.all([
        fetch(`/api/roi?${params.toString()}`, {
          method: 'GET',
          credentials: 'include',
          headers: getAuthHeaders(),
          signal: controller.signal,
        }),
        fetch(`/api/roi/investments?${params.toString()}`, {
          method: 'GET',
          credentials: 'include',
          headers: getAuthHeaders(),
          signal: controller.signal,
        }),
      ]);

      if (!reportRes.ok) {
        throw new Error(`HTTP ${reportRes.status}`);
      }
      if (!investmentsRes.ok) {
        throw new Error(`HTTP ${investmentsRes.status}`);
      }

      const [reportResult, investmentsResult] = await Promise.all([
        reportRes.json(),
        investmentsRes.json(),
      ]);

      if (!reportResult.success) {
        throw new Error(reportResult.error || 'Failed to fetch ROI report');
      }
      if (!investmentsResult.success) {
        throw new Error(investmentsResult.error || 'Failed to fetch investments');
      }

      if (mountedRef.current) {
        setData({
          report: reportResult.data,
          investments: investmentsResult.data,
        });
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
  }, [type, category, platform, startDate, endDate]);

  // Refetch function
  const refetch = useCallback(async () => {
    await fetchROI();
  }, [fetchROI]);

  // Create investment mutation
  const createInvestment = useCallback(async (input: CreateInvestmentInput): Promise<ContentInvestment> => {
    setIsMutating(true);
    try {
      const response = await fetch('/api/roi/investments', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...input,
          investedAt: input.investedAt instanceof Date ? input.investedAt.toISOString() : input.investedAt,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create investment');
      }

      // Refetch to get updated data
      await fetchROI();

      return result.data;
    } finally {
      setIsMutating(false);
    }
  }, [fetchROI]);

  // Update investment mutation
  const updateInvestment = useCallback(async (id: string, input: UpdateInvestmentInput): Promise<ContentInvestment> => {
    setIsMutating(true);
    try {
      const body: Record<string, unknown> = { ...input };
      if (input.investedAt instanceof Date) body.investedAt = input.investedAt.toISOString();

      const response = await fetch(`/api/roi/investments/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update investment');
      }

      // Refetch to get updated data
      await fetchROI();

      return result.data;
    } finally {
      setIsMutating(false);
    }
  }, [fetchROI]);

  // Delete investment mutation
  const deleteInvestment = useCallback(async (id: string): Promise<void> => {
    setIsMutating(true);
    try {
      const response = await fetch(`/api/roi/investments/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete investment');
      }

      // Refetch to get updated data
      await fetchROI();
    } finally {
      setIsMutating(false);
    }
  }, [fetchROI]);

  // Initial fetch
  useEffect(() => {
    fetchROI();
  }, [fetchROI]);

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
    createInvestment,
    updateInvestment,
    deleteInvestment,
  };
}

export default useROI;
