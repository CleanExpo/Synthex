/**
 * Churn Analysis Client Hook
 *
 * Mirror of AnalyticsClient pattern for real-time cohort polling.
 * Polls /api/cohort-analysis every 30s when live mode is enabled.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

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

const API_URL = '/api/cohort-analysis';
const POLL_INTERVAL_MS = 30000; // 30 seconds

export function useChurnAnalysisClient() {
  const [data, setData] = useState<CohortAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${API_URL}?timeRange=30d`);
        if (!response.ok) {
          throw new Error('Failed to fetch cohort analysis');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Poll if enabled
  useEffect(() => {
    if (!isPolling || isLoading || error || !data) {
      return;
    }

    const interval = setInterval(() => {
      fetch(`${API_URL}?timeRange=30d`)
        .then(response => {
          if (!response.ok) throw new Error('Failed to fetch cohort analysis');
          return response.json();
        })
        .then(result => {
          setData(result);
        })
        .catch(err => {
          console.error('Polling error:', err);
          setError(err instanceof Error ? err.message : 'Unknown error');
        });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isPolling, isLoading, error, data]);

  const startPolling = useCallback(() => {
    setIsPolling(true);
  }, []);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  return {
    data,
    isLoading,
    error,
    isPolling,
    startPolling,
    stopPolling,
  };
}
