'use client';

/**
 * User Health Score Widget — circular gauge + trend + component bars
 *
 * Displays user engagement health (0-100) with five weighted pillars:
 * Login Frequency (25%), Content Creation (25%), Feature Usage (20%),
 * Engagement (20%), Growth (10%).
 *
 * UNI-1611
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useHealthScore } from '@/hooks/useHealthScore';
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
} from '@/components/icons';
import { cn } from '@/lib/utils';

// ── Circular Gauge ───────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 54; // radius 54
  const offset = circumference - (score / 100) * circumference;
  const colour = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';

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
        <span className="text-3xl font-bold text-white">
          {Math.round(score)}
        </span>
        <span className="text-xs text-gray-300">/100</span>
      </div>
    </div>
  );
}

// ── Trend Indicator ──────────────────────────────────────────────────────────

function TrendIndicator({ trend }: { trend: string }) {
  switch (trend) {
    case 'improving':
      return (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
          <TrendingUp className="w-3.5 h-3.5" />
          Improving
        </span>
      );
    case 'declining':
      return (
        <span className="inline-flex items-center gap-1 text-xs text-red-400">
          <TrendingDown className="w-3.5 h-3.5" />
          Declining
        </span>
      );
    case 'critical':
      return (
        <span className="inline-flex items-center gap-1 text-xs text-red-400">
          <Zap className="w-3.5 h-3.5" />
          Critical
        </span>
      );
    case 'stable':
    default:
      return (
        <span className="inline-flex items-center gap-1 text-xs text-gray-300">
          <Minus className="w-3.5 h-3.5" />
          Stable
        </span>
      );
  }
}

// ── Component Bar ────────────────────────────────────────────────────────────

function ComponentBar({
  label,
  score,
  weight,
}: {
  label: string;
  score: number;
  weight: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-300 tabular-nums">
          {Math.round(score)}/100{' '}
          <span className="text-gray-600">({weight})</span>
        </span>
      </div>
      <Progress value={score} className="h-2" />
    </div>
  );
}

// ── Main Widget ──────────────────────────────────────────────────────────────

export function HealthScoreWidget() {
  const { healthScore, isLoading, error } = useHealthScore();

  if (isLoading) {
    return (
      <Card className="bg-surface-base/80 border border-orange-500/10">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-surface-base/80 border border-orange-500/10">
        <CardContent className="p-6">
          <p className="text-xs text-red-400">
            Unable to load health score. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!healthScore) {
    return null;
  }

  const formattedDate = healthScore.updatedAt
    ? new Date(healthScore.updatedAt).toLocaleString('en-AU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <Card className="bg-surface-base/80 border border-orange-500/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-white flex items-center justify-between">
          <span>User Health Score</span>
          <TrendIndicator trend={healthScore.trend} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Gauge */}
        <ScoreGauge score={healthScore.score} />

        {/* Component bars */}
        <div className="space-y-3">
          <ComponentBar
            label="Login Frequency"
            score={healthScore.loginScore}
            weight="25%"
          />
          <ComponentBar
            label="Content Creation"
            score={healthScore.contentScore}
            weight="25%"
          />
          <ComponentBar
            label="Feature Usage"
            score={healthScore.featureScore}
            weight="20%"
          />
          <ComponentBar
            label="Engagement"
            score={healthScore.engagementScore}
            weight="20%"
          />
          <ComponentBar
            label="Growth"
            score={healthScore.growthScore}
            weight="10%"
          />
        </div>

        {/* Last updated */}
        {formattedDate && (
          <p className="text-[10px] text-gray-400 text-right">
            Last updated: {formattedDate}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
