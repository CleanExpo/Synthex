'use client';

/**
 * QualityGateBadge — compact pass/fail badge for embedding in content editors
 * and publishing flows.
 *
 * Variants:
 * - 'inline' (default): small coloured span "Quality: A (94)"
 * - 'button': clickable with a tooltip showing top 2 issues + audit link
 *
 * @module components/quality/QualityGateBadge
 */

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Shield } from '@/components/icons';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface QualityGateBadgeProps {
  score: number;
  grade: string;
  passes: boolean;
  issues?: string[];
  variant?: 'inline' | 'button';
  className?: string;
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

function badgeColour(passes: boolean, grade: string): string {
  if (passes) {
    if (grade === 'A') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (grade === 'B') return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  }
  return 'bg-red-500/20 text-red-400 border-red-500/30';
}

// ---------------------------------------------------------------------------
// QualityGateBadge
// ---------------------------------------------------------------------------

export function QualityGateBadge({
  score,
  grade,
  passes,
  issues = [],
  variant = 'inline',
  className,
}: QualityGateBadgeProps) {
  const [open, setOpen] = useState(false);
  const colour = badgeColour(passes, grade);
  const label = `Quality: ${grade} (${Math.round(score)})`;

  if (variant === 'inline') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border',
          colour,
          className
        )}
      >
        <Shield className="w-3 h-3" />
        {label}
      </span>
    );
  }

  // 'button' variant — shows tooltip with issues on click
  return (
    <div className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={cn(
          'inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border cursor-pointer hover:opacity-80 transition-opacity',
          colour
        )}
        aria-expanded={open}
        aria-label={`${label}. Click for details.`}
      >
        <Shield className="w-3.5 h-3.5" />
        {label}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 z-50 w-72 bg-gray-900/95 backdrop-blur-sm border border-white/10 rounded-xl shadow-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-white">
            {passes ? 'Passes quality gate' : 'Below quality threshold'}
          </p>

          {issues.length > 0 && (
            <div className="space-y-1">
              {issues.slice(0, 2).map((issue, i) => (
                <p key={i} className="text-xs text-red-300 leading-snug">
                  • {issue}
                </p>
              ))}
            </div>
          )}

          {issues.length === 0 && (
            <p className="text-xs text-emerald-400">No blocking issues detected.</p>
          )}

          <Link
            href="/dashboard/quality"
            className="block text-xs text-cyan-400 hover:text-cyan-300 pt-1 border-t border-white/10"
            onClick={() => setOpen(false)}
          >
            Run Full Audit →
          </Link>
        </div>
      )}
    </div>
  );
}
