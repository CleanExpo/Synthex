'use client';

/**
 * CompetitorVisibilityTable (Phase 96)
 *
 * Table showing competitors found in AI responses to tracked prompts.
 * Sorted by mention count descending.
 *
 * @module components/prompts/CompetitorVisibilityTable
 */

import type { CompetitorVisibility } from '@/lib/prompts/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CompetitorVisibilityTableProps {
  competitors: CompetitorVisibility[]
}

// ─── Mention rate badge ───────────────────────────────────────────────────────

function MentionRateBadge({ rate }: { rate: number }) {
  const pct = Math.round(rate);
  const colour =
    pct >= 60 ? 'text-red-400 bg-red-500/10' :
    pct >= 30 ? 'text-amber-400 bg-amber-500/10' :
    'text-slate-400 bg-white/5';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colour}`}>
      {pct}%
    </span>
  );
}

// ─── Position display ────────────────────────────────────────────────────────

function AvgPosition({ pos }: { pos: number }) {
  if (pos === 0) return <span className="text-slate-500 text-sm">—</span>;
  return (
    <span className="text-sm text-slate-300 tabular-nums">
      #{pos.toFixed(1)}
    </span>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CompetitorVisibilityTable({ competitors }: CompetitorVisibilityTableProps) {
  if (competitors.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
        <p className="text-sm text-slate-400">No competitor mentions detected yet.</p>
        <p className="text-xs text-slate-500 mt-1">
          Test more prompts to surface competitor visibility data.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">
              Competitor
            </th>
            <th className="text-center text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">
              Mentions
            </th>
            <th className="text-center text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">
              Mention Rate
            </th>
            <th className="text-center text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">
              Avg Position
            </th>
          </tr>
        </thead>
        <tbody>
          {competitors.map((comp, idx) => (
            <tr
              key={comp.competitor}
              className={idx < competitors.length - 1 ? 'border-b border-white/5' : ''}
            >
              <td className="px-4 py-3">
                <span className="font-medium text-slate-200 capitalize">
                  {comp.competitor}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="text-slate-300 tabular-nums font-medium">
                  {comp.mentionCount}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <MentionRateBadge rate={comp.mentionRate} />
              </td>
              <td className="px-4 py-3 text-center">
                <AvgPosition pos={comp.avgPosition} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
