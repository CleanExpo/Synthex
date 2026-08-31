/**
 * useCohortAnalysis hook
 *
 * Provides cohort retention data and churn-flagging insights via API calls.
 * Supports 7d/30d/90d time ranges.
 */

'use client';

import { useState, useCallback } from 'react';

export interface CohortRetention {
  cohortDate: string;
  cohortSize: number;
  active30d: number;
  active90d: number;
  churn30d: number;
  churn90d: number;
  retention30d: number;
  retention90d: number;
}

export interface ChurnDriverInsight {
  driverType: string;
  drivers: {
    name: string;
    count: number;
    churnRate: number;
    impactScore: number;
  }[];
}

export interface PricingElasticityInsight {
  tier: string;
  monthlyPrice: number;
  churnRate: number;
  featureUsage: Record<string, number>;
  recommendation: string;
}

export interface FeatureAdoptionInsight {
  featureUsage: {
    feature: string;
    usageCount: number;
  }[];
  totalActiveUsers: number;
  avgUsagePerUser: number;
  cohortStartDate: string;
}

export interface CohortAnalysisData {
  timeRange: string;
  cohorts: CohortRetention[];
  churnDrivers: ChurnDriverInsight[];
  pricingElasticity: PricingElasticityInsight[];
  featureAdoption: FeatureAdoptionInsight;
  generatedAt: string;
}

export interface ChurnFlaggedUsersResponse {
  gapDays: number;
  count: number;
  users: {
    id: string;
    email: string;
    name: string;
    lastLogin: string | null;
    createdAt: string;
    organizationId: string | null;
  }[];
  generatedAt: string;
}

const API_URL = '/api/cohort-analysis';

export function useCohortAnalysis() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches cohort analysis data for a given time range.
   */
  const fetchCohortAnalysis = useCallback(
    async (timeRange: string = '30d'): Promise<CohortAnalysisData> => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}?timeRange=${timeRange}`);
        if (!response.ok) {
          throw new Error('Failed to fetch cohort analysis');
        }
        const data = await response.json();
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Fetches churn-flagged users for a given gap days threshold.
   */
  const fetchChurnFlaggedUsers = useCallback(
    async (gapDays: number = 30): Promise<ChurnFlaggedUsersResponse> => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/churn-flagged`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gapDays }),
        });
        if (!response.ok) {
          throw new Error('Failed to fetch churn-flagged users');
        }
        const data = await response.json();
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    isLoading,
    error,
    fetchCohortAnalysis,
    fetchChurnFlaggedUsers,
  };
}
