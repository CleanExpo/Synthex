'use client';

/**
 * Admin: Intervention Review — SYN-614
 *
 * Shows Tier 2 observation-mode candidates approaching their activation window.
 * Allows Phill to review high-confidence interventions before they go live.
 *
 * Activation status:
 *   active   — activation date has passed, these are firing in live mode now
 *   imminent — within 3 days of going live
 *   pending  — more than 3 days away
 *
 * Protected by /dashboard/admin/layout.tsx (owner-only).
 */

import useSWR from 'swr';
import { fetchJson } from '@/lib/fetcher';

interface Candidate {
  interventionId: string;
  orgId: string;
  orgName: string;
  orgPlan: string;
  orgSlug: string;
  dimension: string;
  currentScore: number;
  baselineScore: number;
  declineMagnitude: number;
  wouldHaveSentAt: string;
  tier2ActivationDate: string | null;
  activationStatus: 'active' | 'imminent' | 'pending' | 'no_date';
}

interface ReviewData {
  total: number;
  active: number;
  imminent: number;
  candidates: Candidate[];
}

const STATUS_STYLES: Record<string, { badge: string; label: string; row: string }> = {
  active:   { badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'Live now',   row: '' },
  imminent: { badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',       label: 'Going live',  row: 'bg-amber-950/10' },
  pending:  { badge: 'bg-zinc-700/50 text-zinc-400 border-zinc-600/30',           label: 'Pending',     row: '' },
  no_date:  { badge: 'bg-zinc-700/50 text-zinc-500 border-zinc-600/30',           label: 'No date',     row: '' },
};

function humanDimension(d: string): string {
  return d.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function PlanBadge({ plan }: { plan: string }) {
  const colours: Record<string, string> = {
    free:       'bg-zinc-700 text-zinc-300',
    starter:    'bg-blue-900/50 text-blue-300',
    pro:        'bg-violet-900/50 text-violet-300',
    enterprise: 'bg-amber-900/50 text-amber-300',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colours[plan] ?? colours.free}`}>
      {plan}
    </span>
  );
}

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.min((score / max) * 100, 100);
  const colour = score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-yellow-500' : score >= 25 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400">{score}</span>
    </div>
  );
}

export default function InterventionReviewPage() {
  const { data, isLoading, error } = useSWR<ReviewData>(
    '/api/admin/intervention-review',
    fetchJson,
    { refreshInterval: 120_000 } // refresh every 2 min — activation dates change
  );

  const candidates = data?.candidates ?? [];
  const imminentCount = data?.imminent ?? 0;
  const activeCount = data?.active ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Tier 2 Intervention Review</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Observation-mode candidates approaching the 14-day activation window.
          Review these before the system starts sending value-proof emails.
        </p>
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading…</div>
      ) : error ? (
        <div className="text-red-400 text-sm">Failed to load review candidates.</div>
      ) : (
        <>
          {/* Summary banner */}
          {imminentCount > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-300">
              <strong>{imminentCount} candidate{imminentCount !== 1 ? 's' : ''}</strong> will go live within 3 days.
              {activeCount > 0 && (
                <span className="ml-1 text-emerald-300">
                  {activeCount} already active.
                </span>
              )}
            </div>
          )}

          {candidates.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/3 p-8 text-center">
              <p className="text-gray-400 text-sm">
                No Tier 2 observation candidates in the last 21 days.
              </p>
              <p className="text-gray-600 text-xs mt-1">
                Candidates appear here once the system detects a 20+ point decline during the calibration window.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Client</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Dimension</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Current</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Baseline</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Decline</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Would have sent</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {candidates.map(c => {
                    const status = STATUS_STYLES[c.activationStatus] ?? STATUS_STYLES.pending;
                    const declineAbs = Math.abs(c.declineMagnitude);

                    return (
                      <tr key={c.interventionId} className={`hover:bg-white/5 transition-colors ${status.row}`}>
                        {/* Client */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{c.orgName}</span>
                            <PlanBadge plan={c.orgPlan} />
                          </div>
                        </td>

                        {/* Dimension */}
                        <td className="px-4 py-3 text-gray-300">{humanDimension(c.dimension)}</td>

                        {/* Current score */}
                        <td className="px-4 py-3">
                          <ScoreBar score={c.currentScore} />
                        </td>

                        {/* Baseline score */}
                        <td className="px-4 py-3 text-gray-400 text-xs">{c.baselineScore}</td>

                        {/* Decline */}
                        <td className="px-4 py-3 text-right">
                          <span className="text-red-400 font-semibold">↓{declineAbs}</span>
                        </td>

                        {/* Would have sent */}
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {new Date(c.wouldHaveSentAt).toLocaleDateString('en-AU', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs border w-fit ${status.badge}`}>
                              {status.label}
                            </span>
                            {c.tier2ActivationDate && (
                              <span className="text-[10px] text-gray-600">
                                Live: {new Date(c.tier2ActivationDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Legend */}
          <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
            {Object.entries(STATUS_STYLES).filter(([k]) => k !== 'no_date').map(([key, s]) => (
              <span key={key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${s.badge}`}>
                {s.label}
              </span>
            ))}
            <span className="text-gray-600">
              Tier 2 activation: 14 days from deployment · Showing last 21 days of observations
            </span>
          </div>
        </>
      )}
    </div>
  );
}
