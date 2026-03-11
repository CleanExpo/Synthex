'use client';

import { useSubscription } from '@/hooks/useSubscription';
import { RefreshCw } from '@/components/icons';
import { getForecastFeatureLimits } from '@/lib/forecasting/feature-limits';
import { FORECAST_METRICS } from '@/lib/forecasting/metrics';
import type { ForecastMetric, ForecastPlatform, ForecastHorizon } from '@/lib/forecasting/types';

const PLATFORMS: { value: ForecastPlatform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'threads', label: 'Threads' },
];

const HORIZON_LABELS: Record<ForecastHorizon, string> = {
  7: '7d',
  30: '30d',
  90: '90d',
};

const HORIZON_REQUIRED_PLANS: Record<ForecastHorizon, string | null> = {
  7: null,
  30: 'Growth',
  90: 'Scale',
};

interface MetricSelectorProps {
  metric: ForecastMetric;
  platform: ForecastPlatform | null;
  horizon: ForecastHorizon;
  onMetricChange: (m: ForecastMetric) => void;
  onPlatformChange: (p: ForecastPlatform | null) => void;
  onHorizonChange: (h: ForecastHorizon) => void;
  onTrain: () => void;
  isTraining: boolean;
}

/**
 * Metric, platform, and horizon picker for Prophet forecast configuration.
 * Enforces plan-based horizon limits with tooltip hints.
 */
export function MetricSelector({
  metric,
  platform,
  horizon,
  onMetricChange,
  onPlatformChange,
  onHorizonChange,
  onTrain,
  isTraining,
}: MetricSelectorProps) {
  const { subscription } = useSubscription();
  const plan = subscription?.plan ?? 'free';
  const limits = getForecastFeatureLimits(plan);

  const supportsPlatform = FORECAST_METRICS[metric].supportsPlatform;

  return (
    <div className="bg-white/[0.02] border border-emerald-500/10 rounded-xl p-4 space-y-4">
      <div className="flex flex-wrap gap-4 items-end">
        {/* Metric selector */}
        <div className="space-y-1 min-w-[180px]">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Metric
          </label>
          <select
            value={metric}
            onChange={(e) => onMetricChange(e.target.value as ForecastMetric)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            {Object.values(FORECAST_METRICS).map((def) => (
              <option key={def.id} value={def.id} className="bg-gray-900">
                {def.label}
              </option>
            ))}
          </select>
        </div>

        {/* Platform selector — only render if metric supports per-platform breakdown */}
        {supportsPlatform && (
          <div className="space-y-1 min-w-[180px]">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Platform
            </label>
            <select
              value={platform ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                onPlatformChange(val === '' ? null : (val as ForecastPlatform));
              }}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="" className="bg-gray-900">
                All platforms
              </option>
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value} className="bg-gray-900">
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Horizon buttons */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Horizon
          </label>
          <div className="flex gap-1">
            {([7, 30, 90] as ForecastHorizon[]).map((h) => {
              const isDisabled = h > limits.maxHorizonDays;
              const requiredPlan = HORIZON_REQUIRED_PLANS[h];
              const title = isDisabled && requiredPlan
                ? `Requires ${requiredPlan} plan`
                : undefined;

              return (
                <button
                  key={h}
                  type="button"
                  disabled={isDisabled}
                  title={title}
                  onClick={() => !isDisabled && onHorizonChange(h)}
                  className={[
                    'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    horizon === h && !isDisabled
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : isDisabled
                      ? 'bg-white/[0.02] text-gray-600 border border-white/5 cursor-not-allowed'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:border-emerald-500/30 hover:text-emerald-400',
                  ].join(' ')}
                >
                  {HORIZON_LABELS[h]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Train button */}
        <div className="ml-auto">
          <button
            type="button"
            onClick={onTrain}
            disabled={isTraining}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTraining ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Training…
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Train Model
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MetricSelector;
