'use client';

/**
 * HumannessScoreCard — displays a HumannessResult with score, grade,
 * component breakdown, issues, and suggestions.
 *
 * @module components/quality/HumannessScoreCard
 */

import { cn } from '@/lib/utils';
import { CheckCircle, AlertTriangle, AlertCircle } from '@/components/icons';
import type { HumannessResult } from '@/lib/quality/humanness-scorer';

// ---------------------------------------------------------------------------
// Grade colour mapping
// ---------------------------------------------------------------------------

function gradeColour(grade: string): string {
  switch (grade) {
    case 'A': return 'text-emerald-400';
    case 'B': return 'text-cyan-400';
    case 'C': return 'text-amber-400';
    case 'D': return 'text-orange-400';
    case 'F': return 'text-red-400';
    default:  return 'text-gray-400';
  }
}

function gradeBg(grade: string): string {
  switch (grade) {
    case 'A': return 'bg-emerald-500/20 border-emerald-500/30';
    case 'B': return 'bg-cyan-500/20 border-cyan-500/30';
    case 'C': return 'bg-amber-500/20 border-amber-500/30';
    case 'D': return 'bg-orange-500/20 border-orange-500/30';
    case 'F': return 'bg-red-500/20 border-red-500/30';
    default:  return 'bg-gray-500/20 border-gray-500/30';
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HumannessScoreCardProps {
  result: HumannessResult;
  className?: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScoreCircle({ score, grade }: { score: number; grade: string }) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center w-28 h-28 rounded-full border-2',
      gradeBg(grade)
    )}>
      <span className={cn('text-4xl font-bold tabular-nums', gradeColour(grade))}>
        {Math.round(score)}
      </span>
      <span className={cn('text-xl font-semibold', gradeColour(grade))}>
        {grade}
      </span>
    </div>
  );
}

function PassBadge({ passes, score, threshold }: { passes: boolean; score: number; threshold: number }) {
  if (passes) {
    return (
      <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-full text-sm font-medium">
        <CheckCircle className="w-4 h-4" />
        Passes Quality Gate
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-full text-sm font-medium">
      <AlertCircle className="w-4 h-4" />
      Below Threshold ({Math.round(score)}/{threshold})
    </span>
  );
}

function ComponentBar({
  label,
  value,
  type,
}: {
  label: string;
  value: number;
  type: 'penalty' | 'bonus';
}) {
  const isZero = value === 0;
  if (type === 'penalty') {
    const display = isZero ? '±0' : `−${value}`;
    const colour = isZero ? 'text-gray-500' : 'text-red-400';
    return (
      <div className="flex flex-col items-center gap-1 min-w-0">
        <span className={cn('text-lg font-bold tabular-nums', colour)}>{display}</span>
        <span className="text-xs text-slate-500 text-center leading-tight">{label}</span>
      </div>
    );
  }
  const display = isZero ? '+0' : `+${value}`;
  const colour = isZero ? 'text-gray-600' : 'text-emerald-400';
  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <span className={cn('text-lg font-bold tabular-nums', colour)}>{display}</span>
      <span className="text-xs text-slate-500 text-center leading-tight">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HumannessScoreCard
// ---------------------------------------------------------------------------

export function HumannessScoreCard({ result, className }: HumannessScoreCardProps) {
  const { score, grade, passes, passThreshold, components, issues, suggestions, wordCount } = result;

  return (
    <div className={cn('bg-white/5 border border-white/10 backdrop-blur-sm rounded-xl p-5 space-y-5', className)}>
      {/* Header: score circle + pass badge */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <ScoreCircle score={score} grade={grade} />
        <div className="flex flex-col gap-2 items-center sm:items-start">
          <PassBadge passes={passes} score={score} threshold={passThreshold} />
          <p className="text-xs text-slate-500">
            {wordCount.toLocaleString()} words analysed
            {!result.fingerprint && (
              <span className="ml-1 text-amber-500/70">· &lt;200 words — fingerprint unavailable</span>
            )}
          </p>
        </div>
      </div>

      {/* Score component bar */}
      <div className="border-t border-white/10 pt-4">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Score Breakdown</p>
        <div className="flex justify-around gap-2">
          <ComponentBar label="Slop Penalty" value={components.slopPenalty} type="penalty" />
          <div className="w-px bg-white/10" />
          <ComponentBar label="Vocabulary Bonus" value={components.ttrBonus} type="bonus" />
          <ComponentBar label="Rhythm Bonus" value={components.rhythmBonus} type="bonus" />
          <ComponentBar label="Readability Bonus" value={components.readabilityBonus} type="bonus" />
        </div>
        <p className="text-xs text-slate-600 mt-2 text-center">
          100 − {components.slopPenalty} (slop) + {components.ttrBonus + components.rhythmBonus + components.readabilityBonus} (bonuses) = {Math.round(score)}
        </p>
      </div>

      {/* Issues list */}
      {issues.length > 0 && (
        <div className="border-t border-white/10 pt-4 space-y-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Issues</p>
          {issues.map((issue, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
            >
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-300">{issue}</span>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions list */}
      {suggestions.length > 0 && (
        <div className="border-t border-white/10 pt-4 space-y-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Suggestions</p>
          {suggestions.map((suggestion, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2"
            >
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-amber-200">{suggestion}</span>
            </div>
          ))}
        </div>
      )}

      {/* Clean state */}
      {issues.length === 0 && suggestions.length === 0 && (
        <div className="border-t border-white/10 pt-4 flex items-center gap-3 bg-emerald-500/10 border-emerald-500/20 rounded-lg p-3">
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <p className="text-sm text-emerald-300">No issues detected. Content reads as authentically human.</p>
        </div>
      )}
    </div>
  );
}
