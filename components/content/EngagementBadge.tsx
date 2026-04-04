'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface EngagementBadgeProps {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  suggestions?: string[];
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Grade colour maps
// ─────────────────────────────────────────────────────────────────────────────

const gradeStyles: Record<
  EngagementBadgeProps['grade'],
  { pill: string; dot: string }
> = {
  A: {
    pill: 'bg-green-500/15 text-green-400 border-green-500/30',
    dot: 'bg-green-400',
  },
  B: {
    pill: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
    dot: 'bg-teal-400',
  },
  C: {
    pill: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-400',
  },
  D: {
    pill: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    dot: 'bg-orange-400',
  },
  F: {
    pill: 'bg-red-500/15 text-red-400 border-red-500/30',
    dot: 'bg-red-400',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function EngagementBadge({
  score,
  grade,
  suggestions = [],
  className,
}: EngagementBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const styles = gradeStyles[grade];

  return (
    <div className={cn('inline-flex flex-col gap-1.5', className)}>
      {/* Pill badge */}
      <button
        type="button"
        onClick={() => {
          if (suggestions.length > 0) setExpanded(prev => !prev);
        }}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
          'text-xs font-medium border-[0.5px] transition-opacity',
          styles.pill,
          suggestions.length > 0
            ? 'cursor-pointer hover:opacity-80'
            : 'cursor-default'
        )}
        aria-expanded={suggestions.length > 0 ? expanded : undefined}
      >
        <span
          className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', styles.dot)}
          aria-hidden="true"
        />
        Score: {score} · {grade}
        {suggestions.length > 0 && (
          <span className="opacity-60 ml-0.5">{expanded ? '▲' : '▼'}</span>
        )}
      </button>

      {/* Suggestions list (collapsible) */}
      {suggestions.length > 0 && expanded && (
        <ul className="mt-0.5 space-y-1 pl-1">
          {suggestions.map((suggestion, index) => (
            <li
              key={index}
              className="flex items-start gap-1.5 text-xs text-white/60"
            >
              <span className="mt-0.5 flex-shrink-0 text-white/30">•</span>
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
