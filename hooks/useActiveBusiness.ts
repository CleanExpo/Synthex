'use client';

import { useState, useEffect, useCallback } from 'react';
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

interface UseActiveBusinessReturn {
  businesses: OwnedBusiness[];
  activeBusiness: OwnedBusiness | null;
  activeOrganizationId: string | null;
  isOwner: boolean;
  isLoading: boolean;
  switchBusiness: (orgId: string | null) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useActiveBusiness(): UseActiveBusinessReturn {
  const { user } = useUser();
  const [businesses, setBusinesses] = useState<OwnedBusiness[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isOwner = user?.isMultiBusinessOwner ?? false;

  const fetchBusinesses = useCallback(async () => {
    if (!isOwner) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/businesses', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch businesses');
      }

      const data = await response.json();
      setBusinesses(data.businesses || []);
      setActiveOrganizationId(data.activeBusiness || null);
    } catch (error) {
      console.error('Error fetching businesses:', error);
      setBusinesses([]);
      setActiveOrganizationId(null);
    } finally {
      setIsLoading(false);
    }
  }, [isOwner]);

  const switchBusiness = useCallback(async (orgId: string | null) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/businesses/switch', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ organizationId: orgId }),
      });

      if (!response.ok) {
        throw new Error('Failed to switch business');
      }

      const data = await response.json();
      setActiveOrganizationId(data.activeOrganizationId);

      // Refetch to get updated data
      await fetchBusinesses();
    } catch (error) {
      console.error('Error switching business:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [fetchBusinesses]);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  const activeBusiness = businesses.find(
    (b) => b.organizationId === activeOrganizationId
  ) || null;

  return {
    businesses,
    activeBusiness,
    activeOrganizationId,
    isOwner,
    isLoading,
    switchBusiness,
    refetch: fetchBusinesses,
  };
}
