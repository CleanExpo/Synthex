'use client';

import { format, parseISO } from 'date-fns';
import { FORECAST_METRICS } from '@/lib/forecasting/metrics';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  training: 'bg-yellow-500/20 text-yellow-400',
  ready: 'bg-emerald-500/20 text-emerald-400',
  failed: 'bg-red-500/20 text-red-400',
};

interface SpatiotemporalCardProps {
  model: {
    id: string;
    name: string;
    targetMetric: string;
    status: string;
    trainingPoints: number;
    lastTrainedAt: string | null;
    accuracy: Record<string, number> | null;
  };
  onPredict: (modelId: string) => void;
  isPredicting: boolean;
}

/**
 * Summary card for a trained BayesNF spatiotemporal model.
 * Shows name, target metric, status, training points, last trained date, and first accuracy metric.
 * Exposes a "Generate Predictions" button gated to ready models.
 */
export function SpatiotemporalCard({ model, onPredict, isPredicting }: SpatiotemporalCardProps) {
  const metricDef = FORECAST_METRICS[model.targetMetric as keyof typeof FORECAST_METRICS];
  const statusStyle = STATUS_STYLES[model.status] ?? 'bg-gray-500/20 text-gray-400';
  const canPredict = model.status === 'ready' && !isPredicting;

  // Display name: capitalise first character
  const displayName =
    model.name.charAt(0).toUpperCase() + model.name.slice(1).replace(/_/g, ' ');

  // First accuracy entry for display
  const accuracyEntry = model.accuracy
    ? Object.entries(model.accuracy).find(([, v]) => typeof v === 'number')
    : null;

  return (
    <div className="bg-white/[0.02] border border-emerald-500/20 rounded-xl p-4 space-y-3 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-white">{displayName}</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize w-fit">
            {metricDef?.label ?? model.targetMetric}
          </span>
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
          <span className="text-white">{model.trainingPoints}</span> training points
        </p>
        {model.lastTrainedAt && (
          <p>
            <span className="text-gray-500">Last trained:</span>{' '}
            <span className="text-white">
              {format(parseISO(model.lastTrainedAt), 'dd/MM/yyyy')}
            </span>
          </p>
        )}
        {accuracyEntry && (
          <p>
            <span className="text-gray-500 capitalize">{accuracyEntry[0]}:</span>{' '}
            <span className="text-emerald-400 font-medium">
              {accuracyEntry[1].toFixed(3)}
            </span>
          </p>
        )}
      </div>

      {/* Predict button */}
      <button
        type="button"
        onClick={() => onPredict(model.id)}
        disabled={!canPredict}
        className={[
          'w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors border',
          canPredict
            ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-emerald-500/30'
            : 'bg-white/[0.02] text-gray-600 border-white/5 cursor-not-allowed',
        ].join(' ')}
      >
        {isPredicting ? 'Generating…' : 'Generate Predictions'}
      </button>
    </div>
  );
}

export default SpatiotemporalCard;
