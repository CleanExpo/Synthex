'use client';

/**
 * GeoScoreMiniWidget — SYN-657
 *
 * Compact score badge for the AI Advisor GEO teaser row.
 * Shows: colour dot + score number + band label + "View Your Full GEO Score →"
 * When score is null (calculating): shows "GEO Score: calculating..." with no link.
 */

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface GeoScoreMiniWidgetProps {
  score: number | null;
}

function colourForScore(score: number): string {
  if (score >= 67) return '#10B981';
  if (score >= 34) return '#F59E0B';
  return '#EF4444';
}

function labelForScore(score: number): string {
  if (score >= 67) return 'Strong';
  if (score >= 34) return 'Growing';
  return 'Low';
}

export function GeoScoreMiniWidget({ score }: GeoScoreMiniWidgetProps) {
  if (score === null) {
    return (
      <span className="text-xs text-white/30 italic">
        GEO Score: calculating...
      </span>
    );
  }

  const colour = colourForScore(score);
  const label  = labelForScore(score);

  return (
    <Link
      href="/dashboard/geo-score"
      className="inline-flex items-center gap-2 group"
      aria-label={`GEO Score ${score} — ${label}. View full GEO Score panel`}
    >
      {/* Colour dot */}
      <span
        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: colour }}
        aria-hidden="true"
      />

      {/* Score + label */}
      <span className="text-xs font-semibold tabular-nums" style={{ color: colour }}>
        {score}
      </span>
      <span className="text-xs text-white/40">{label}</span>

      {/* CTA */}
      <span className="text-xs text-white/30 group-hover:text-white/60 transition-colors flex items-center gap-0.5">
        View Your Full GEO Score
        <ArrowRight className="w-3 h-3" />
      </span>
    </Link>
  );
}
