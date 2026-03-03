'use client';

/**
 * ConfidenceBadge — Displays an AI step's confidence score as a coloured chip.
 * Green ≥ 0.85 | Amber 0.60–0.84 | Red < 0.60
 */

import { cn } from '@/lib/utils';

interface ConfidenceBadgeProps {
  score: number | null | undefined;
  className?: string;
}

export function ConfidenceBadge({ score, className }: ConfidenceBadgeProps) {
  if (score === null || score === undefined) return null;

  const pct = Math.round(score * 100);

  const colourClass =
    score >= 0.85
      ? 'bg-green-500/20 text-green-400 border-green-500/30'
      : score >= 0.6
        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
        : 'bg-red-500/20 text-red-400 border-red-500/30';

  const label =
    score >= 0.85 ? 'High confidence' : score >= 0.6 ? 'Medium confidence' : 'Low confidence';

  return (
    <span
      title={label}
      className={cn(
        'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums',
        colourClass,
        className
      )}
    >
      {pct}%
    </span>
  );
}
