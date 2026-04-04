'use client';

/**
 * GeoScorePanel — SYN-657
 *
 * Composes GeoScoreRing + GeoScoreTrendLine + up to 3 GeoScoreActionCards.
 * This is the main client-facing surface at /dashboard/geo-score.
 */

import { GeoScoreRing } from './GeoScoreRing';
import { GeoScoreTrendLine, type TrendDataPoint } from './GeoScoreTrendLine';
import { GeoScoreActionCard, type GeoRecommendedAction } from './GeoScoreActionCard';

export interface GeoScoreData {
  score:               number;
  components:          Record<string, number>;
  trend_data:          TrendDataPoint[];
  recommended_actions: GeoRecommendedAction[];
  computed_at:         string;
}

interface GeoScorePanelProps {
  data: GeoScoreData;
}

export function GeoScorePanel({ data }: GeoScorePanelProps) {
  const { score, trend_data, recommended_actions, computed_at } = data;

  const computedDate = new Date(computed_at);
  const trackingStart = trend_data.length > 0
    ? computedDate.toISOString()
    : null;

  const topActions = recommended_actions.slice(0, 3);

  const updatedLabel = computedDate.toLocaleDateString('en-AU', {
    day:   'numeric',
    month: 'short',
    year:  'numeric',
  });

  return (
    <div className="space-y-8">
      {/* Score ring */}
      <section className="flex flex-col items-center gap-4">
        <GeoScoreRing score={score} size="lg" />
        <p className="text-[11px] text-white/25">
          Last updated {updatedLabel}
        </p>
      </section>

      {/* 90-day trend */}
      {trend_data.length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-white/40 uppercase tracking-widest mb-3">
            90-Day Trend
          </h2>
          <GeoScoreTrendLine
            data={trend_data}
            currentScore={score}
            trackingStart={trackingStart}
          />
        </section>
      )}

      {/* Recommended actions */}
      {topActions.length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-white/40 uppercase tracking-widest mb-3">
            Recommended Actions
          </h2>
          <div className="space-y-2">
            {topActions.map((action, i) => (
              <GeoScoreActionCard key={i} action={action} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
