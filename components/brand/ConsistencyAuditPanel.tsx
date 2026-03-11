'use client';

/**
 * Brand Builder — Consistency Audit Panel Component (Phase 91)
 *
 * Platform-by-platform NAP consistency matrix with overall score,
 * status badges, critical issues, and recommendations.
 *
 * @module components/brand/ConsistencyAuditPanel
 */

import { AlertCircle, CheckCircle, XCircle, Info, Loader2 } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { ConsistencyReport } from '@/lib/brand/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConsistencyAuditPanelProps {
  report: ConsistencyReport | null;
  loading?: boolean;
  onRunAudit: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreGradeClass(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function scoreGradeBgClass(score: number): string {
  if (score >= 80) return 'bg-green-500/10 border-green-500/20';
  if (score >= 60) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

type NameMatchType = 'exact' | 'variant' | 'mismatch' | 'not-found';

function matchBadge(match: NameMatchType): { label: string; className: string } {
  switch (match) {
    case 'exact':     return { label: 'Exact match',  className: 'bg-green-500/20 text-green-300 border-green-500/30' };
    case 'variant':   return { label: 'Variant',      className: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
    case 'mismatch':  return { label: 'Mismatch',     className: 'bg-red-500/20 text-red-300 border-red-500/30' };
    case 'not-found': return { label: 'Not found',    className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConsistencyAuditPanel({ report, loading, onRunAudit }: ConsistencyAuditPanelProps) {
  return (
    <div className="space-y-4">
      {/* Run Audit Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">NAP Consistency Audit</h3>
        <button
          onClick={onRunAudit}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-300 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          Run Consistency Audit
        </button>
      </div>

      {!report && !loading && (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-8 text-center">
          <Info className="w-8 h-8 text-gray-500 mx-auto mb-3" />
          <p className="text-sm text-gray-400">
            Run a consistency audit to score your brand name across all declared sameAs platforms.
          </p>
        </div>
      )}

      {loading && (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-8 text-center">
          <Loader2 className="w-8 h-8 text-gray-500 mx-auto mb-3 animate-spin" />
          <p className="text-sm text-gray-400">Running consistency audit…</p>
        </div>
      )}

      {report && !loading && (
        <div className="space-y-4">
          {/* Overall Score */}
          <div className={cn(
            'flex items-center justify-between p-4 rounded-xl border',
            scoreGradeBgClass(report.overallScore)
          )}>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Overall Score</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Weighted average across {report.results.length} platform{report.results.length !== 1 ? 's' : ''}
              </p>
            </div>
            <span className={cn('text-4xl font-bold tabular-nums', scoreGradeClass(report.overallScore))}>
              {report.overallScore}
            </span>
          </div>

          {/* Platform Table */}
          {report.results.length > 0 && (
            <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Platform</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Declared Name</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {report.results.map((result, i) => {
                    const badge = matchBadge(result.nameMatch as NameMatchType);
                    return (
                      <tr key={i} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3 text-white font-medium">{result.platform}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                          {result.foundName ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full border',
                            badge.className
                          )}>
                            {badge.label}
                          </span>
                        </td>
                        <td className={cn(
                          'px-4 py-3 text-right font-bold tabular-nums',
                          scoreGradeClass(result.score)
                        )}>
                          {result.score}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Critical Issues */}
          {report.criticalIssues.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-2">
              <h4 className="text-sm font-semibold text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Critical Issues
              </h4>
              <ul className="space-y-1">
                {report.criticalIssues.map((issue, i) => (
                  <li key={i} className="text-xs text-red-200 flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">•</span>
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-2">
              <h4 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Recommendations
              </h4>
              <ul className="space-y-1">
                {report.recommendations.map((rec, i) => (
                  <li key={i} className="text-xs text-amber-200 flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">→</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
