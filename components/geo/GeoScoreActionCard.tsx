'use client';

/**
 * GeoScoreActionCard — SYN-657
 *
 * Single recommended action card with:
 *   - Action text
 *   - Estimated score impact badge (+N pts)
 *   - CTA button linking to the relevant Synthex feature
 */

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export interface GeoRecommendedAction {
  action:   string;
  impact:   number;   // estimated score delta in points
  cta_url:  string;   // relative URL to Synthex feature
  cta_text?: string;  // button label fallback
}

interface GeoScoreActionCardProps {
  action: GeoRecommendedAction;
  index:  number;
}

export function GeoScoreActionCard({ action, index }: GeoScoreActionCardProps) {
  return (
    <div className="flex items-start justify-between gap-3 p-4 bg-white/[0.03] border border-white/[0.06] rounded-lg">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-[10px] text-white/40 font-mono mt-0.5">
          {index + 1}
        </span>
        <p className="text-sm text-white/70 leading-relaxed">{action.action}</p>
      </div>

      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        {/* Impact badge */}
        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-2 py-0.5 whitespace-nowrap">
          +{action.impact} pts
        </span>

        {/* CTA */}
        <Link
          href={action.cta_url}
          className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70 transition-colors"
          aria-label={`${action.cta_text ?? 'Take action'} — opens ${action.cta_url}`}
        >
          {action.cta_text ?? 'Go'}
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
