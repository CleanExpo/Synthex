'use client';

import { useState, useCallback } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
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

        // SYN-908: invalidate /api/businesses (so the dropdown's own display
        // name updates) AND every other SWR cache in the app (so org-scoped
        // widgets — Command Centre, analytics, campaigns, posts, etc. — re-
        // fetch against the now-active org instead of serving the previous
        // org's cached response).
        //
        // Without the global mutate, switching business changes the server-
        // side `user.activeOrganizationId` but the client never refetches,
        // so every dashboard panel keeps showing the old org's numbers
        // (reported by the user as "data looks generic, not my brands").
        await Promise.all([
          mutate(),
          globalMutate(
            key => typeof key === 'string' && key.startsWith('/api/'),
            undefined,
            { revalidate: true }
          ),
        ]);
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
