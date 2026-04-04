'use client';

/**
 * Composite Health Widget — circular gauge + pillar bars + checklist
 *
 * UNI-1610
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useCompositeHealth } from '@/hooks/useCompositeHealth';
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  ArrowRight,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import Link from 'next/link';

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

// ── Pillar Bar ───────────────────────────────────────────────────────────────

function PillarBar({
  label,
  score,
  max,
  details,
}: {
  label: string;
  score: number;
  max: number;
  details?: string;
}) {
  const pct = max > 0 ? (score / max) * 100 : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-300 tabular-nums">
          {Math.round(score * 10) / 10}/{max}
        </span>
      </div>
      <Progress value={pct} className="h-2" />
      {details && <p className="text-[10px] text-gray-400">{details}</p>}
    </div>
  );
}

// ── Main Widget ──────────────────────────────────────────────────────────────

export function CompositeHealthWidget() {
  const { score, isLoading, error } = useCompositeHealth();
  const [expanded, setExpanded] = useState(false);

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
        <CardContent className="p-6 text-center text-sm text-white/40">
          Unable to load health score — please refresh
        </CardContent>
      </Card>
    );
  }

  if (!score) {
    return null; // No data yet — silently omit the widget
  }

  const { pillars, checklist, nextActions } = score;

  return (
    <Card className="bg-surface-base/80 border border-orange-500/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-white flex items-center gap-2">
          Local SEO Health Score
          <Badge
            className={cn(
              'text-xs',
              score.total >= 80
                ? 'bg-emerald-500/20 text-emerald-400'
                : score.total >= 60
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'bg-red-500/20 text-red-400'
            )}
          >
            {score.total >= 80
              ? 'Good'
              : score.total >= 60
                ? 'Needs work'
                : 'Critical'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Gauge */}
        <ScoreGauge score={score.total} />

        {/* Pillar bars */}
        <div className="space-y-3">
          <PillarBar {...pillars.seoAudit} />
          <PillarBar {...pillars.sentinelHealth} />
          <PillarBar {...pillars.gbpCompleteness} />
          <PillarBar {...pillars.cwvPassRate} />
        </div>

        {/* Next actions */}
        {nextActions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-300">Quick wins</p>
            {nextActions.map(action => (
              <div
                key={action}
                className="flex items-center gap-2 text-xs text-gray-300"
              >
                <ArrowRight className="w-3 h-3 text-orange-400 shrink-0" />
                {action}
              </div>
            ))}
          </div>
        )}

        {/* Expandable checklist */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors w-full"
        >
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
          {expanded ? 'Hide checklist' : 'Show full checklist'}
          <span className="ml-auto text-gray-400">
            {checklist.filter(c => c.completed).length}/{checklist.length}
          </span>
        </button>

        {expanded && (
          <div className="space-y-1.5 pl-1">
            {checklist.map(item => (
              <div key={item.id} className="flex items-center gap-2 text-xs">
                <CheckCircle
                  className={cn(
                    'w-3.5 h-3.5 shrink-0',
                    item.completed ? 'text-emerald-400' : 'text-gray-600'
                  )}
                />
                <span
                  className={
                    item.completed
                      ? 'text-gray-300 line-through'
                      : 'text-gray-300'
                  }
                >
                  {item.label}
                </span>
                {!item.completed && item.actionUrl && (
                  <Link
                    href={item.actionUrl}
                    className="ml-auto text-orange-400 hover:text-orange-300 text-[10px]"
                  >
                    Fix
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
