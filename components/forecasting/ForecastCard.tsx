'use client';

import { format, parseISO } from 'date-fns';
import { FORECAST_METRICS } from '@/lib/forecasting/metrics';
import type { ForecastModelResponse, ForecastHorizon } from '@/lib/forecasting/types';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  training: 'bg-yellow-500/20 text-yellow-400',
  ready: 'bg-emerald-500/20 text-emerald-400',
  failed: 'bg-red-500/20 text-red-400',
};

interface ForecastCardProps {
  model: ForecastModelResponse;
  onPredict: (modelId: string) => void;
  isPredicting: boolean;
  horizon: ForecastHorizon;
}

/**
 * Summary card for a trained Prophet forecast model.
 * Shows metric, platform, status, training points, last trained date, and MAPE.
 * Exposes a "Generate Nd Forecast" button gated to ready models.
 */
export function ForecastCard({
  model,
  onPredict,
  isPredicting,
  horizon,
}: ForecastCardProps) {
  const metricDef = FORECAST_METRICS[model.metric as keyof typeof FORECAST_METRICS];
  const statusStyle = STATUS_STYLES[model.status] ?? 'bg-gray-500/20 text-gray-400';
  const canPredict = model.status === 'ready' && !isPredicting;

  return (
    <div className="bg-white/[0.02] border border-emerald-500/20 rounded-xl p-4 space-y-3 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-white">
            {metricDef?.label ?? model.metric}
          </span>
          {model.platform && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize w-fit">
              {model.platform}
            </span>
          )}
        </div>
        <span
          className={[
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0',
            statusStyle,
          ].join(' ')}
        >
          {model.status}
        </span>
      </div>

      {/* Body */}
      <div className="space-y-1 text-xs text-gray-400 flex-1">
        <p>
          <span className="text-gray-500">Training data:</span>{' '}
          <span className="text-white">{model.trainingPoints}</span> data points
        </p>
        {model.lastTrainedAt && (
          <p>
            <span className="text-gray-500">Last trained:</span>{' '}
            <span className="text-white">
              {format(parseISO(model.lastTrainedAt), 'dd/MM/yyyy')}
            </span>
          </p>
        )}
        {model.accuracy && (
          <p>
            <span className="text-gray-500">MAPE:</span>{' '}
            <span className="text-emerald-400 font-medium">
              {(model.accuracy as { mape: number }).mape?.toFixed(1)}%
            </span>
          </p>
        )}
      </div>

      {/* Predict button */}
      <button
        type="button"
        onClick={() => onPredict(model.modelId)}
        disabled={!canPredict}
        className={[
          'w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors border',
          canPredict
            ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-emerald-500/30'
            : 'bg-white/[0.02] text-gray-600 border-white/5 cursor-not-allowed',
        ].join(' ')}
      >
        Generate {horizon}d Forecast
      </button>
    </div>
  );
}

export default ForecastCard;
