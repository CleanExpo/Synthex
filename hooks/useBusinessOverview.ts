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

interface CrossBusinessAggregation {
  totalBusinesses: number;
  activeBusinesses: number;
  totalCampaigns: number;
  totalPosts: number;
  totalEngagement: number;
  totalMonthlySpend: number;
  perBusiness: OwnedBusiness[];
}

interface UseBusinessOverviewReturn {
  overview: CrossBusinessAggregation | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

export function useBusinessOverview(): UseBusinessOverviewReturn {
  const { user } = useUser();
  const [overview, setOverview] = useState<CrossBusinessAggregation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isOwner = user?.isMultiBusinessOwner ?? false;

  const fetchOverview = useCallback(async () => {
    if (!isOwner) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/businesses/overview', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch business overview');
      }

      const data = await response.json();
      setOverview(data.overview || null);
    } catch (error) {
      console.error('Error fetching business overview:', error);
      setOverview(null);
    } finally {
      setIsLoading(false);
    }
  }, [isOwner]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return {
    overview,
    isLoading,
    refetch: fetchOverview,
  };
}
