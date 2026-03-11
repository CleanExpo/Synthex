'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { RefreshCw } from 'lucide-react';
import { SpatiotemporalFeatureGate } from './SpatiotemporalFeatureGate';
import { SpatiotemporalCard } from './SpatiotemporalCard';
import { PlatformHeatmap } from './PlatformHeatmap';
import { FORECAST_METRICS } from '@/lib/forecasting/metrics';
import type { SpatiotemporalPredictionResult } from '@/lib/forecasting/types';

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

const SPATIAL_METRICS = [
  'engagement_rate',
  'impressions',
  'reach',
  'clicks',
  'conversions',
] as const;
type SpatialMetric = (typeof SPATIAL_METRICS)[number];

/**
 * Cross-Platform Intelligence tab content.
 *
 * Owns SWR data fetching for spatiotemporal models, training trigger,
 * and prediction display via PlatformHeatmap.
 * Wrapped in SpatiotemporalFeatureGate (Scale-only).
 */
export function CrossPlatformTab() {
  const [activeMetric, setActiveMetric] = useState<SpatialMetric>('engagement_rate');
  const [isTraining, setIsTraining] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [activePredictions, setActivePredictions] =
    useState<SpatiotemporalPredictionResult[] | null>(null);

  const {
    data: modelsData,
    isLoading,
    mutate,
  } = useSWR('/api/predict/models', fetchJson, { refreshInterval: 15_000 });

  const models: Record<string, unknown>[] = modelsData?.data ?? [];

  const handleTrain = async () => {
    setIsTraining(true);
    try {
      await fetch('/api/predict/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetMetric: activeMetric }),
      });
      void mutate();
    } finally {
      setIsTraining(false);
    }
  };

  const handlePredict = async (modelId: string) => {
    setIsPredicting(true);
    try {
      const res = await fetch('/api/predict/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ modelId }),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          data: { predictions: SpatiotemporalPredictionResult[] };
        };
        setActivePredictions(json.data.predictions);
      }
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <SpatiotemporalFeatureGate>
      <div className="space-y-6">
        {/* Train controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={activeMetric}
            onChange={(e) => setActiveMetric(e.target.value as SpatialMetric)}
            className="bg-white/[0.05] border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {SPATIAL_METRICS.map((m) => (
              <option key={m} value={m}>
                {FORECAST_METRICS[m]?.label ?? m}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleTrain()}
            disabled={isTraining}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg disabled:opacity-50 transition-colors"
          >
            {isTraining ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
            Train Cross-Platform Model
          </button>
        </div>

        {/* Heatmap — shown when predictions are available */}
        {activePredictions && activePredictions.length > 0 && (
          <div className="bg-white/[0.02] border border-emerald-500/10 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">
              Cross-Platform Engagement Heatmap
            </h3>
            <p className="text-xs text-gray-500">
              Colour intensity = predicted{' '}
              {FORECAST_METRICS[activeMetric]?.label ?? activeMetric}. Hover for exact values.
            </p>
            <PlatformHeatmap predictions={activePredictions} metric={activeMetric} />
          </div>
        )}

        {/* Model cards */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Trained Models</h2>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-40 animate-pulse bg-white/5 rounded-xl border border-white/[0.05]"
                />
              ))}
            </div>
          ) : models.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500 bg-white/[0.02] rounded-xl border border-white/[0.05]">
              <p className="text-sm font-medium">No spatiotemporal models yet</p>
              <p className="text-xs mt-2 max-w-sm text-center">
                Select a metric and click Train to build your first cross-platform BayesNF model.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {models.map((model) => (
                <SpatiotemporalCard
                  key={model.id as string}
                  model={
                    model as {
                      id: string;
                      name: string;
                      targetMetric: string;
                      status: string;
                      trainingPoints: number;
                      lastTrainedAt: string | null;
                      accuracy: Record<string, number> | null;
                    }
                  }
                  onPredict={handlePredict}
                  isPredicting={isPredicting}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </SpatiotemporalFeatureGate>
  );
}

export default CrossPlatformTab;
