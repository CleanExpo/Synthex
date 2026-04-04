'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useUser } from '@/hooks/use-user';

interface OwnedBusiness {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  displayName: string | null;
  isActive: boolean;
  billingStatus: string;
  monthlyRate: number;
  stats?: {
    totalCampaigns: number;
    totalPosts: number;
    activePlatforms: number;
    totalEngagement: number;
  };
}

interface CrossBusinessAggregation {
  totalBusinesses: number;
  activeBusinesses: number;
  totalCampaigns: number;
  totalPosts: number;
  totalEngagement: number;
  totalMonthlySpend: number;
  perBusiness: OwnedBusiness[];
}

interface ApiResponse {
  overview: CrossBusinessAggregation | null;
}

interface UseBusinessOverviewReturn {
  overview: CrossBusinessAggregation | null;
  isLoading: boolean;
  refetch: () => void;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function useBusinessOverview(): UseBusinessOverviewReturn {
  const { user } = useUser();
  const isOwner = user?.isMultiBusinessOwner ?? false;

  // Pass null key when not owner — SWR will skip the request
  const { data, isLoading, mutate } = useSWR<ApiResponse>(
    isOwner ? '/api/businesses/overview' : null,
    fetchJson,
    { revalidateOnFocus: false }
  );

  const overview = data?.overview ?? null;

  const refetch = useCallback(() => {
    void mutate();
  }, [mutate]);

  return {
    overview,
    isLoading,
    refetch,
  };
}
