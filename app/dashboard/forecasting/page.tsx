'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { ForecastFeatureGate } from '@/components/forecasting/ForecastFeatureGate';
import { MetricSelector } from '@/components/forecasting/MetricSelector';
import { ForecastChart } from '@/components/forecasting/ForecastChart';
import { ForecastCard } from '@/components/forecasting/ForecastCard';
import { CrossPlatformTab } from '@/components/forecasting/CrossPlatformTab';
import { TrendingUp } from '@/components/icons';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type {
  ForecastMetric,
  ForecastPlatform,
  ForecastHorizon,
  ForecastPredictResponse,
} from '@/lib/forecasting/types';

const fetchJson = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

/**
 * Forecasting Dashboard
 *
 * Two tabs:
 *  1. "Time-Series Forecasting" — Prophet AI confidence-banded forecasts (Pro+)
 *  2. "Cross-Platform Intelligence" — BayesNF spatiotemporal heatmap (Scale — gated inside tab)
 *
 * Outer gate: ForecastFeatureGate (Pro+ required to view the page at all).
 * Inner gate: SpatiotemporalFeatureGate inside CrossPlatformTab (Scale required for heatmap).
 *
 * Data: useSWR with credentials:include per CLAUDE.md pattern.
 */
export default function ForecastingPage() {
  // ─── SWR — Prophet model list ────────────────────────────────────────────────
  const {
    data: modelsData,
    isLoading: modelsLoading,
    mutate,
  } = useSWR('/api/forecast/models', fetchJson, { refreshInterval: 15_000 });

  // ─── State ───────────────────────────────────────────────────────────────────
  const [selectedMetric, setSelectedMetric] = useState<ForecastMetric>('engagement_rate');
  const [selectedPlatform, setSelectedPlatform] = useState<ForecastPlatform | null>(null);
  const [selectedHorizon, setSelectedHorizon] = useState<ForecastHorizon>(7);
  const [isTraining, setIsTraining] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [activeForecast, setActiveForecast] = useState<
    (ForecastPredictResponse & { forecastId: string }) | null
  >(null);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleTrain = async () => {
    setIsTraining(true);
    try {
      const body: Record<string, unknown> = { metric: selectedMetric };
      if (selectedPlatform) body.platform = selectedPlatform;

      await fetch('/api/forecast/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      void mutate();
    } finally {
      setIsTraining(false);
    }
  };

  const handlePredict = async (modelId: string) => {
    setIsPredicting(true);
    try {
      const response = await fetch('/api/forecast/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ modelId, horizonDays: selectedHorizon }),
      });

      if (response.ok) {
        const json = await response.json();
        setActiveForecast(json.data);
      }
    } finally {
      setIsPredicting(false);
    }
  };

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const models = modelsData?.data ?? [];

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <ForecastFeatureGate>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <TrendingUp className="h-7 w-7 text-emerald-400" />
            Forecasting
          </h1>
          <p className="text-gray-400 mt-1">
            Prophet time-series forecasting and BayesNF cross-platform predictions
          </p>
        </div>

        <Tabs defaultValue="prophet" className="w-full">
          <TabsList variant="glass">
            <TabsTrigger value="prophet">Time-Series Forecasting</TabsTrigger>
            <TabsTrigger value="spatiotemporal">Cross-Platform Intelligence</TabsTrigger>
          </TabsList>

          {/* ── Prophet tab ── */}
          <TabsContent value="prophet" className="space-y-6 mt-4">
            {/* Metric / platform / horizon selector */}
            <MetricSelector
              metric={selectedMetric}
              platform={selectedPlatform}
              horizon={selectedHorizon}
              onMetricChange={setSelectedMetric}
              onPlatformChange={setSelectedPlatform}
              onHorizonChange={setSelectedHorizon}
              onTrain={handleTrain}
              isTraining={isTraining}
            />

            {/* Active forecast chart */}
            {activeForecast && (
              <ForecastChart
                predictions={activeForecast.predictions}
                metric={activeForecast.modelId ? selectedMetric : selectedMetric}
                horizonDays={selectedHorizon}
                accuracy={activeForecast.accuracy}
              />
            )}

            {/* Trained models section */}
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Trained Models</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Select a model and generate a forecast for your chosen horizon.
                </p>
              </div>

              {modelsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-48 animate-pulse bg-white/5 rounded-xl border border-white/[0.05]"
                    />
                  ))}
                </div>
              ) : models.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500 bg-white/[0.02] rounded-xl border border-white/[0.05]">
                  <TrendingUp className="h-10 w-10 mb-3 opacity-30 text-emerald-400" />
                  <p className="text-sm font-medium">No forecast models yet</p>
                  <p className="text-xs mt-2 max-w-sm text-center">
                    Select a metric above and click &quot;Train Model&quot; to build your first
                    Prophet model. You need at least 30 days of data for most metrics.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {models.map(
                    (model: {
                      id: string;
                      metric: string;
                      platform: string | null;
                      status: string;
                      trainingPoints: number;
                      lastTrainedAt: string | null;
                      accuracy: unknown;
                      seasonality: unknown;
                    }) => (
                      <ForecastCard
                        key={model.id}
                        model={{
                          modelId: model.id,
                          orgId: '',
                          metric: model.metric,
                          platform: model.platform,
                          status: model.status as 'pending' | 'training' | 'ready' | 'failed',
                          trainingPoints: model.trainingPoints,
                          lastTrainedAt: model.lastTrainedAt,
                          accuracy:
                            model.accuracy as import('@/lib/forecasting/types').ForecastAccuracy | null,
                          seasonality:
                            model.seasonality as import('@/lib/forecasting/types').DetectedSeasonality | null,
                        }}
                        onPredict={handlePredict}
                        isPredicting={isPredicting}
                        horizon={selectedHorizon}
                      />
                    ),
                  )}
                </div>
              )}
            </section>
          </TabsContent>

          {/* ── Cross-Platform Intelligence tab ── */}
          <TabsContent value="spatiotemporal" className="mt-4">
            {/*
              CrossPlatformTab internally wraps its content in SpatiotemporalFeatureGate.
              Non-Scale users see the upgrade prompt; Scale users see the full BayesNF UI.
            */}
            <CrossPlatformTab />
          </TabsContent>
        </Tabs>
      </div>
    </ForecastFeatureGate>
  );
}
