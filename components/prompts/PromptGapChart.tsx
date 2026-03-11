'use client';

/**
 * PromptGapChart (Phase 96)
 *
 * Visual gap analysis panel:
 * - Mention rate ring (CSS-based donut)
 * - Category breakdown: horizontal bars
 * - Gap list with recommendations
 *
 * @module components/prompts/PromptGapChart
 */

import { cn } from '@/lib/utils';
import type { PromptGapAnalysis, PromptCategory } from '@/lib/prompts/types';
import { CATEGORY_CONFIG } from '@/lib/prompts/types';

// ─── Colour map (matches PromptCard) ────────────────────────────────────────

const CATEGORY_BAR_COLOURS: Record<PromptCategory, string> = {
  'brand-awareness':       'bg-purple-500',
  'competitor-comparison': 'bg-amber-500',
  'local-discovery':       'bg-green-500',
  'use-case':              'bg-blue-500',
  'how-to':                'bg-cyan-500',
  'product-feature':       'bg-slate-500',
};

function barColour(cat: string): string {
  return CATEGORY_BAR_COLOURS[cat as PromptCategory] ?? 'bg-slate-500';
}

// ─── CSS Donut Ring ───────────────────────────────────────────────────────────

function DonutRing({
  mentionedCount,
  missedCount,
  coverageRate,
}: {
  mentionedCount: number
  missedCount: number
  coverageRate: number
}) {
  const total = mentionedCount + missedCount;
  const pct = total > 0 ? Math.round(coverageRate) : 0;

  // SVG ring — circumference of r=40 circle
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          {/* Track */}
          <circle
            cx="50" cy="50" r={r}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="12"
          />
          {/* Fill */}
          <circle
            cx="50" cy="50" r={r}
            fill="none"
            stroke={pct >= 60 ? '#22d3ee' : pct >= 30 ? '#f59e0b' : '#f87171'}
            strokeWidth="12"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        {/* Centre label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white tabular-nums">{pct}%</span>
          <span className="text-[10px] text-slate-400">coverage</span>
        </div>
      </div>
      {/* Legend */}
      <div className="flex gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
          {mentionedCount} mentioned
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
          {missedCount} missed
        </span>
      </div>
    </div>
  );
}

// ─── Category Bars ────────────────────────────────────────────────────────────

function CategoryBars({ categories }: { categories: PromptGapAnalysis['topCategories'] }) {
  return (
    <div className="space-y-2.5">
      {categories.map((cat) => {
        const label = CATEGORY_CONFIG[cat.category]?.label ?? cat.category;
        const pct   = Math.round(cat.mentionRate);
        return (
          <div key={cat.category} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">{label}</span>
              <span className="text-slate-400 tabular-nums">
                {pct}%
                {cat.testedCount > 0 && (
                  <span className="text-slate-500 ml-1">({cat.testedCount} tested)</span>
                )}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', barColour(cat.category))}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Gap Recommendations ──────────────────────────────────────────────────────

function GapRecommendations({ gaps }: { gaps: PromptGapAnalysis['gaps'] }) {
  if (gaps.length === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-4">
        No significant gaps detected — great visibility coverage!
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {gaps.slice(0, 4).map((gap) => {
        const label = CATEGORY_CONFIG[gap.category]?.label ?? gap.category;
        return (
          <div
            key={gap.category}
            className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"
          >
            <p className="text-xs font-semibold text-amber-300 mb-1">{label}</p>
            <p className="text-xs text-slate-400 leading-relaxed">{gap.recommendation}</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PromptGapChartProps {
  analysis: PromptGapAnalysis
  className?: string
}

export function PromptGapChart({ analysis, className }: PromptGapChartProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Donut + summary */}
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <DonutRing
          mentionedCount={analysis.mentionedCount}
          missedCount={analysis.missedCount}
          coverageRate={analysis.coverageRate}
        />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-white">
            {analysis.entityName} — Prompt Visibility
          </p>
          <p className="text-xs text-slate-400">
            Tested <strong className="text-slate-200">{analysis.testedCount}</strong> prompts across 6 categories
          </p>
          <p className="text-xs text-slate-400">
            Brand mentioned in{' '}
            <strong className="text-cyan-400">{analysis.mentionedCount}</strong> of them
            ({Math.round(analysis.coverageRate)}% coverage)
          </p>
        </div>
      </div>

      {/* Category breakdown */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Mention Rate by Category
        </h4>
        {analysis.topCategories.every((c) => c.testedCount === 0) ? (
          <p className="text-xs text-slate-500">No categories tested yet.</p>
        ) : (
          <CategoryBars categories={analysis.topCategories} />
        )}
      </div>

      {/* Recommendations */}
      {analysis.gaps.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Gap Recommendations
          </h4>
          <GapRecommendations gaps={analysis.gaps} />
        </div>
      )}
    </div>
  );
}
