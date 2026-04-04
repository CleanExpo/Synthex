/**
 * ROI Hook
 *
 * @description Fetches ROI metrics and manages investment CRUD operations.
 */

'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
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
// FETCHER
// ============================================================================

async function fetchROIData(url: string): Promise<ROIData> {
  // Build investments URL from the report URL (same query string, different path)
  const investmentsUrl = url.replace('/api/roi?', '/api/roi/investments?');

  const [reportRes, investmentsRes] = await Promise.all([
    fetch(url, { method: 'GET', credentials: 'include' }),
    fetch(investmentsUrl, { method: 'GET', credentials: 'include' }),
  ]);

  if (!reportRes.ok) throw new Error(`HTTP ${reportRes.status}`);
  if (!investmentsRes.ok) throw new Error(`HTTP ${investmentsRes.status}`);

  const [reportResult, investmentsResult] = await Promise.all([
    reportRes.json(),
    investmentsRes.json(),
  ]);

  if (!reportResult.success)
    throw new Error(reportResult.error || 'Failed to fetch ROI report');
  if (!investmentsResult.success)
    throw new Error(investmentsResult.error || 'Failed to fetch investments');

  return {
    report: reportResult.data,
    investments: investmentsResult.data,
  };
}

// ============================================================================
// HOOK
// ============================================================================

export function useROI(options: UseROIOptions = {}) {
  const { type, category, platform, startDate, endDate } = options;

  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (category) params.set('category', category);
  if (platform) params.set('platform', platform);
  if (startDate) params.set('startDate', startDate.toISOString());
  if (endDate) params.set('endDate', endDate.toISOString());

  const { data, error, isLoading, mutate } = useSWR<ROIData>(
    `/api/roi?${params.toString()}`,
    fetchROIData,
    { revalidateOnFocus: false }
  );

  // Create investment mutation
  const createInvestment = useCallback(
    async (input: CreateInvestmentInput): Promise<ContentInvestment> => {
      const response = await fetch('/api/roi/investments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...input,
          investedAt:
            input.investedAt instanceof Date
              ? input.investedAt.toISOString()
              : input.investedAt,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create investment');
      }

      await mutate();
      return result.data;
    },
    [mutate]
  );

  // Update investment mutation
  const updateInvestment = useCallback(
    async (
      id: string,
      input: UpdateInvestmentInput
    ): Promise<ContentInvestment> => {
      const body: Record<string, unknown> = { ...input };
      if (input.investedAt instanceof Date)
        body.investedAt = input.investedAt.toISOString();

      const response = await fetch(`/api/roi/investments/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update investment');
      }

      await mutate();
      return result.data;
    },
    [mutate]
  );

  // Delete investment mutation
  const deleteInvestment = useCallback(
    async (id: string): Promise<void> => {
      const response = await fetch(`/api/roi/investments/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete investment');
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
    createInvestment,
    updateInvestment,
    deleteInvestment,
  };
}

export default useROI;
