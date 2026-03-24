'use client';

/**
 * Visibility Score Widget — circular gauge + 4 component bars
 *
 * Reviews (40%), GBP (20%), Content (20%), Rankings (20%)
 *
 * SYN-473
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useVisibilityScore } from '@/hooks/useVisibilityScore';
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Eye,
} from '@/components/icons';
import { cn } from '@/lib/utils';

// ── Circular Gauge ────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  const colour = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative mx-auto h-32 w-32">
      <svg className="-rotate-90 h-full w-full" viewBox="0 0 120 120">
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
        <span className="text-3xl font-bold text-white">
          {Math.round(score)}
        </span>
        <span className="text-xs text-gray-300">/100</span>
      </div>
    </div>
  );
}

// ── Trend Indicator ───────────────────────────────────────────────────────────

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  if (delta > 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
        <TrendingUp className="h-3.5 w-3.5" />+{delta} this week
      </span>
    );
  if (delta < 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-400">
        <TrendingDown className="h-3.5 w-3.5" />
        {delta} this week
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
      <Minus className="h-3.5 w-3.5" />
      No change
    </span>
  );
}

// ── Component Bar ─────────────────────────────────────────────────────────────

function ComponentBar({
  label,
  score,
  maxScore,
  weight,
}: {
  label: string;
  score: number;
  maxScore: number;
  weight: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-300">{label}</span>
        <span className="tabular-nums text-gray-300">
          {score}/{maxScore} <span className="text-gray-600">({weight})</span>
        </span>
      </div>
      <Progress
        value={(score / maxScore) * 100}
        className="h-1.5 bg-white/10"
      />
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

const TOP_ACTIONS = [
  'Get more Google reviews (up to +40 pts)',
  'Complete your Google Business Profile (up to +20 pts)',
  'Publish content consistently — 8+ per month (up to +20 pts)',
  'Track keywords that rank on positions 5–20 (up to +20 pts)',
];

// ── Widget ────────────────────────────────────────────────────────────────────

export function VisibilityScoreWidget() {
  const { visibilityScore, delta, isLoading, error } = useVisibilityScore();
  const [showTips, setShowTips] = useState(false);

  return (
    <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-300">
          <Eye className="h-4 w-4 text-orange-400" />
          Visibility Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}
        {error && (
          <p className="text-center text-xs text-red-400">
            Unable to load score
          </p>
        )}
        {!isLoading && !error && !visibilityScore && (
          <div className="py-6 text-center">
            <p className="text-sm text-gray-400">No score yet</p>
            <p className="mt-1 text-xs text-gray-500">
              Score updates after GBP sync and content activity
            </p>
          </div>
        )}
        {!isLoading && visibilityScore && (
          <>
            <ScoreGauge score={visibilityScore.score} />
            <div className="text-center">
              <DeltaBadge delta={delta} />
            </div>

            {/* Component bars */}
            <div className="space-y-2.5 pt-2">
              <ComponentBar
                label="Reviews"
                score={visibilityScore.reviewScore}
                maxScore={40}
                weight="40%"
              />
              <ComponentBar
                label="GBP Profile"
                score={visibilityScore.gbpScore}
                maxScore={20}
                weight="20%"
              />
              <ComponentBar
                label="Content"
                score={visibilityScore.contentScore}
                maxScore={20}
                weight="20%"
              />
              <ComponentBar
                label="Rankings"
                score={visibilityScore.rankScore}
                maxScore={20}
                weight="20%"
              />
            </div>

            {/* Expandable tips */}
            <button
              onClick={() => setShowTips(v => !v)}
              className="flex w-full items-center justify-between text-xs text-gray-400 hover:text-gray-200 transition-colors pt-1"
            >
              <span>What moves my score?</span>
              {showTips ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
            {showTips && (
              <ul className="space-y-1 text-xs text-gray-400 pl-2">
                {TOP_ACTIONS.map(action => (
                  <li key={action} className="flex items-start gap-1.5">
                    <span className="mt-0.5 text-orange-400">•</span>
                    {action}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
