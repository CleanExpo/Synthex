'use client';

/**
 * Predictive Analytics Dashboard Page
 *
 * @description ML-powered engagement predictions and optimal posting times.
 * Surfaces existing backend prediction services:
 * - Engagement predictor form with results
 * - Prediction accuracy statistics
 * - Optimal posting time recommendations
 * - Engagement forecast chart with confidence bands (Plan 23-02)
 * - Best-time heatmap for platform posting windows (Plan 23-02)
 */

import { useState, useCallback, useEffect } from 'react';
import { PageHeader } from '@/components/dashboard/page-header';
import { AnalyticsSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
import {
  usePredictionHistory,
  useOptimalTimes,
  fetchEngagementPrediction,
  fetchForecast,
} from '@/hooks/use-dashboard';
import {
  PredictionStats,
  EngagementPredictor,
  OptimalTimesCard,
  ForecastChart,
  BestTimeHeatmap,
} from '@/components/predictions';
import type {
  PredictionInput,
  PredictionResult,
  EngagementForecast,
} from '@/components/predictions/types';

// ============================================================================
// PLATFORMS FOR FILTER
// ============================================================================

const PLATFORM_OPTIONS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
] as const;

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function PredictionsPage() {
  const [platform, setPlatform] = useState('instagram');
  const [predictionResult, setPredictionResult] = useState<PredictionResult | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [forecastData, setForecastData] = useState<EngagementForecast | null>(null);
  const [isForecastLoading, setIsForecastLoading] = useState(false);

  // Fetch prediction history / stats
  const {
    data: historyData,
    isLoading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = usePredictionHistory();

  // Fetch optimal times for selected platform
  const {
    data: optimalTimesData,
    isLoading: optimalTimesLoading,
  } = useOptimalTimes({ platform });

  // Fetch engagement forecast when platform changes
  useEffect(() => {
    setIsForecastLoading(true);
    fetchForecast({ accountId: 'current', platform, metric: 'engagement', days: 30 })
      .then((response) => setForecastData(response.forecast))
      .catch(() => setForecastData(null))
      .finally(() => setIsForecastLoading(false));
  }, [platform]);

  // Handle engagement prediction
  const handlePredict = useCallback(async (input: PredictionInput) => {
    setIsPredicting(true);
    try {
      const result = await fetchEngagementPrediction(input);
      setPredictionResult(result);
      // Refetch history to update stats after new prediction
      refetchHistory();
    } catch (err) {
      console.error('Prediction failed:', err);
    } finally {
      setIsPredicting(false);
    }
  }, [refetchHistory]);

  // Loading state
  if (historyLoading && !historyData) {
    return (
      <div>
        <PageHeader
          title="Predictive Analytics"
          description="ML-powered engagement predictions and optimal posting times"
        />
        <AnalyticsSkeleton />
      </div>
    );
  }

  // Error state
  if (historyError && !historyData) {
    return (
      <div>
        <PageHeader
          title="Predictive Analytics"
          description="ML-powered engagement predictions and optimal posting times"
        />
        <APIErrorCard
          title="Failed to load predictions"
          message="Could not fetch prediction data. Please try again."
          onRetry={() => refetchHistory()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with platform selector */}
      <PageHeader
        title="Predictive Analytics"
        description="ML-powered engagement predictions and optimal posting times"
        actions={
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="rounded-lg bg-white/5 border border-white/10 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          >
            {PLATFORM_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        }
      />

      {/* Prediction Stats */}
      <PredictionStats stats={historyData?.stats ?? null} />

      {/* Two-column: Predictor + Optimal Times */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EngagementPredictor
          onPredict={handlePredict}
          result={predictionResult}
          isLoading={isPredicting}
        />
        <OptimalTimesCard
          data={optimalTimesData ?? null}
          isLoading={optimalTimesLoading}
        />
      </div>

      {/* Visualizations: Forecast Chart + Best Time Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ForecastChart
          forecast={forecastData}
          isLoading={isForecastLoading}
        />
        <BestTimeHeatmap
          slots={optimalTimesData?.slots ?? []}
          isLoading={optimalTimesLoading}
        />
      </div>
    </div>
  );
}
