'use client';

/**
 * ContentScoreCard — weekly content performance score from content_score_history.
 *
 * Displays the latest 0-100 Content Score for the authenticated org with:
 *   - Circular SVG gauge (green ≥75, amber ≥50, red <50)
 *   - Weekly delta badge (▲/▼ or →)
 *   - Three component bars: Data Availability, Engagement Lift, Volume Bonus
 *   - "Building data..." skeleton when score === 0 and dataPoints < 10
 *
 * Data source: /api/dashboard/content-score-history → content_score_history table
 * Scored weekly by score-content-draft Edge Function.
 *
 * @task SYN-665
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, TrendingDown, Minus } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useContentScoreHistory } from '@/hooks/useContentScoreHistory';

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_DATA_POINTS = 10;

// ── Gauge ─────────────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  const colour = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="8"
        />
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke={colour}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{score}</span>
        <span className="text-xs text-gray-300">/100</span>
      </div>
    </div>
  );
}

// ── Delta badge ───────────────────────────────────────────────────────────────

function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
        <TrendingUp className="w-3.5 h-3.5" />
        +{delta} pts this week
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-400">
        <TrendingDown className="w-3.5 h-3.5" />
        {delta} pts this week
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-300">
      <Minus className="w-3.5 h-3.5" />
      No change this week
    </span>
  );
}

// ── Component bar ─────────────────────────────────────────────────────────────

function ComponentBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-300 tabular-nums">
          {value}/{max}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-cyan-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

export function ContentScoreCard() {
  const { current, isLoading, error } = useContentScoreHistory();

  if (isLoading) {
    return (
      <Card className="bg-surface-base/80 border border-cyan-500/10">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-surface-base/80 border border-cyan-500/10">
        <CardContent className="p-6">
          <p className="text-xs text-red-400">Unable to load content score.</p>
        </CardContent>
      </Card>
    );
  }

  // No data yet — pipeline hasn't run
  if (!current) {
    return (
      <Card className="bg-surface-base/80 border border-cyan-500/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-white">Content Score</CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center">
          <p className="text-sm text-gray-400">
            Publishing your first posts — score will appear here next week.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isBuilding = current.score === 0 && current.data_points < MIN_DATA_POINTS;

  return (
    <Card className={cn('border', 'bg-surface-base/80', 'border-cyan-500/10')}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-white flex items-center justify-between">
          <span>Content Score</span>
          <DeltaBadge delta={current.delta} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {isBuilding ? (
          <div className="text-center py-4">
            <p className="text-sm font-medium text-cyan-400">Building data…</p>
            <p className="text-xs text-gray-400 mt-1">
              {current.data_points} of {MIN_DATA_POINTS} posts analysed
            </p>
          </div>
        ) : (
          <ScoreGauge score={current.score} />
        )}

        {/* Component bars */}
        <div className="space-y-3">
          <ComponentBar
            label="Data Availability"
            value={current.components.data_availability}
            max={40}
          />
          <ComponentBar
            label="Engagement Lift"
            value={current.components.engagement_lift}
            max={40}
          />
          <ComponentBar
            label="Volume Bonus"
            value={current.components.volume_bonus}
            max={20}
          />
        </div>

        {/* Week label */}
        {current.week_start && (
          <p className="text-[10px] text-gray-400 text-right">
            Week of{' '}
            {new Date(current.week_start).toLocaleDateString('en-AU', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
