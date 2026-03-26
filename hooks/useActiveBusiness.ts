'use client';

import { useState, useCallback } from 'react';
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

interface BusinessesResponse {
  businesses: OwnedBusiness[];
  activeBusiness: string | null;
}

interface UseActiveBusinessReturn {
  businesses: OwnedBusiness[];
  activeBusiness: OwnedBusiness | null;
  activeOrganizationId: string | null;
  isOwner: boolean;
  isLoading: boolean;
  switchBusiness: (orgId: string | null) => Promise<void>;
  refetch: () => void;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function useActiveBusiness(): UseActiveBusinessReturn {
  const { user } = useUser();
  const isOwner = user?.isMultiBusinessOwner ?? false;

  // Switching state — separate from SWR loading
  const [isSwitching, setIsSwitching] = useState(false);

  // Pass null key when not owner — SWR will skip the request
  const { data, isLoading, mutate } = useSWR<BusinessesResponse>(
    isOwner ? '/api/businesses' : null,
    fetchJson,
    { revalidateOnFocus: false }
  );

  const businesses = data?.businesses ?? [];
  const activeOrganizationId = data?.activeBusiness ?? null;
  const activeBusiness =
    businesses.find(b => b.organizationId === activeOrganizationId) ?? null;

  const switchBusiness = useCallback(
    async (orgId: string | null) => {
      try {
        setIsSwitching(true);
        const res = await fetch('/api/businesses/switch', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ organizationId: orgId }),
        });

        if (!res.ok) {
          throw new Error('Failed to switch business');
        }

        // Revalidate to get updated data
        await mutate();
      } catch (error) {
        console.error('Error switching business:', error);
        throw error;
      } finally {
        setIsSwitching(false);
      }
    },
    [mutate]
  );

  const refetch = useCallback(() => {
    void mutate();
  }, [mutate]);

  return {
    businesses,
    activeBusiness,
    activeOrganizationId,
    isOwner,
    isLoading: isLoading || isSwitching,
    switchBusiness,
    refetch,
  };
}
