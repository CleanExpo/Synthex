'use client';

import { TrendingUp, ArrowUp, ArrowDown, Loader2 } from '@/components/icons';

// ============================================================================
// TYPES
// ============================================================================

interface EngagementPredictionProps {
  prediction: {
    likes: number;
    comments: number;
    shares: number;
    reach: number;
    engagementRate: number;
    confidence: number;
    factors: {
      factor: string;
      impact: 'positive' | 'neutral' | 'negative';
      weight: number;
    }[];
    recommendations: string[];
  } | null;
  isLoading?: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.6) return 'Moderate';
  return 'Low';
}

// ============================================================================
// COMPONENT
// ============================================================================

export function EngagementPrediction({
  prediction,
  isLoading = false,
}: EngagementPredictionProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-orange-400 animate-spin" />
          <span className="text-sm text-white/40">
            Predicting engagement...
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 bg-white/[0.02] rounded-sm animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // Null state
  if (!prediction) return null;

  const confidencePercent = Math.round(prediction.confidence * 100);
  const confidenceLabel = getConfidenceLabel(prediction.confidence);

  const metrics = [
    { label: 'Likes', value: prediction.likes },
    { label: 'Comments', value: prediction.comments },
    { label: 'Shares', value: prediction.shares },
    { label: 'Reach', value: prediction.reach },
    {
      label: 'Eng. Rate',
      value: prediction.engagementRate,
      suffix: '%',
      raw: true,
    },
  ];

  return (
    <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-light text-white flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-orange-400" />
          Engagement Prediction
        </h3>
        <span className="text-xs text-white/40">
          {confidenceLabel} confidence
        </span>
      </div>

      {/* Confidence bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-white/40">Confidence</span>
          <span className="text-xs text-orange-400">{confidencePercent}%</span>
        </div>
        <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500/60 rounded-full transition-all duration-500"
            style={{ width: `${confidencePercent}%` }}
          />
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-4">
        {metrics.map(metric => (
          <div
            key={metric.label}
            className="border-[0.5px] border-white/[0.04] bg-white/[0.02] rounded-sm p-2 text-center"
          >
            <div className="text-sm font-medium text-white">
              {metric.raw
                ? `${metric.value}${metric.suffix || ''}`
                : formatNumber(metric.value)}
            </div>
            <div className="text-xs text-white/40 mt-0.5">{metric.label}</div>
          </div>
        ))}
      </div>

      {/* Factors */}
      {prediction.factors.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs text-white/40 mb-2">Impact Factors</h4>
          <div className="space-y-1.5">
            {prediction.factors.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {f.impact === 'positive' ? (
                  <ArrowUp className="h-3 w-3 text-green-400 flex-shrink-0" />
                ) : f.impact === 'negative' ? (
                  <ArrowDown className="h-3 w-3 text-red-400 flex-shrink-0" />
                ) : (
                  <span className="h-3 w-3 flex items-center justify-center text-white/50 flex-shrink-0">
                    &mdash;
                  </span>
                )}
                <span
                  className={
                    f.impact === 'positive'
                      ? 'text-green-400/80'
                      : f.impact === 'negative'
                        ? 'text-red-400/80'
                        : 'text-white/50'
                  }
                >
                  {f.factor}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {prediction.recommendations.length > 0 && (
        <div>
          <h4 className="text-xs text-white/40 mb-2">Recommendations</h4>
          <ul className="space-y-1">
            {prediction.recommendations.map((rec, i) => (
              <li
                key={i}
                className="text-xs text-white/50 flex items-start gap-1.5"
              >
                <span className="text-orange-400 mt-0.5 flex-shrink-0">
                  &bull;
                </span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
