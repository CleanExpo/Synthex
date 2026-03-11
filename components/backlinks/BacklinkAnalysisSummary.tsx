'use client';

/**
 * BacklinkAnalysisSummary — Summary card for a completed analysis (Phase 95)
 *
 * Displays topic, total opportunities, by-type breakdown, and high-value count.
 *
 * @module components/backlinks/BacklinkAnalysisSummary
 */

import { ArrowRight, TrendingUp } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { BacklinkOpportunityType } from '@/lib/backlinks/types';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AnalysisSummaryData {
  id: string;
  sourceUrl: string;
  linksFound: number;
  highValueCount: number;
  createdAt: string;
  analysisResult: {
    topic?: string;
    userDomain?: string;
    byType?: Record<BacklinkOpportunityType, number>;
    prospects?: unknown[];
  };
}

export interface BacklinkAnalysisSummaryProps {
  analysis: AnalysisSummaryData;
  onViewProspects?: (analysisId: string) => void;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const TYPE_COLOURS: Record<BacklinkOpportunityType, string> = {
  'resource-page':      'bg-blue-500',
  'guest-post':         'bg-emerald-500',
  'broken-link':        'bg-amber-500',
  'competitor-link':    'bg-purple-500',
  'journalist-mention': 'bg-cyan-500',
};

const TYPE_SHORT: Record<BacklinkOpportunityType, string> = {
  'resource-page':      'Resource',
  'guest-post':         'Guest Post',
  'broken-link':        'Broken Link',
  'competitor-link':    'Competitor',
  'journalist-mention': 'Journalist',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BacklinkAnalysisSummary({
  analysis,
  onViewProspects,
}: BacklinkAnalysisSummaryProps) {
  const result = analysis.analysisResult;
  const byType = result.byType ?? {};
  const topic  = result.topic ?? analysis.sourceUrl;
  const total  = analysis.linksFound;
  const highValue = analysis.highValueCount;

  const typeEntries = Object.entries(byType) as [BacklinkOpportunityType, number][];
  const totalForBar = typeEntries.reduce((acc, [, n]) => acc + n, 0) || 1;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/8 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-sm font-semibold text-white truncate max-w-xs">{topic}</div>
          <div className="text-xs text-slate-500 mt-0.5">{formatDate(analysis.createdAt)}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="text-2xl font-bold text-white tabular-nums">{total}</div>
            <div className="text-xs text-slate-500">opportunities</div>
          </div>
          {highValue > 0 && (
            <div className="text-right">
              <div className="flex items-center gap-1 text-emerald-400">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xl font-bold tabular-nums">{highValue}</span>
              </div>
              <div className="text-xs text-slate-500">high value</div>
            </div>
          )}
        </div>
      </div>

      {/* Stacked bar breakdown */}
      {typeEntries.length > 0 && total > 0 && (
        <div className="mb-3">
          <div className="flex h-2 rounded-full overflow-hidden gap-0.5 bg-white/5 mb-2">
            {typeEntries
              .filter(([, count]) => count > 0)
              .map(([type, count]) => (
                <div
                  key={type}
                  style={{ width: `${(count / totalForBar) * 100}%` }}
                  className={cn('h-full rounded-sm', TYPE_COLOURS[type])}
                  title={`${TYPE_SHORT[type]}: ${count}`}
                />
              ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {typeEntries
              .filter(([, count]) => count > 0)
              .map(([type, count]) => (
                <div key={type} className="flex items-center gap-1 text-xs text-slate-400">
                  <span className={cn('inline-block h-2 w-2 rounded-full', TYPE_COLOURS[type])} />
                  {TYPE_SHORT[type]}: {count}
                </div>
              ))}
          </div>
        </div>
      )}

      {total === 0 && (
        <p className="text-xs text-slate-500 mb-3">
          No opportunities found for this topic. Try a broader search term or add API keys for Google CSE.
        </p>
      )}

      {/* Action */}
      {onViewProspects && total > 0 && (
        <button
          onClick={() => onViewProspects(analysis.id)}
          className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
        >
          View prospects <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
