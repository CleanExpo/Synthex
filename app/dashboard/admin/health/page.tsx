'use client';

import useSWR, { mutate as globalMutate } from 'swr';
import { fetchJson } from '@/lib/fetcher';
import { useState } from 'react';

/**
 * Client Health Score Admin Dashboard — SYN-611
 *
 * Shows all active clients sorted by health score (at-risk first).
 * Protected by /dashboard/admin/layout.tsx (owner-only).
 * Refreshes every 5 minutes.
 */

type RiskLevel = 'healthy' | 'watch' | 'at_risk' | 'critical' | null;

interface DimensionScore {
  score: number;
  raw_value: number;
  description: string;
}

interface HealthScore {
  overallScore: number;
  scoreDelta: number;
  riskLevel: RiskLevel;
  dimensions: {
    content_consistency: DimensionScore | null;
    engagement_trajectory: DimensionScore | null;
    review_responsiveness: DimensionScore | null;
    authority_momentum: DimensionScore | null;
    advisor_engagement: DimensionScore | null;
    platform_usage: DimensionScore | null;
  };
  weekStart: string;
}

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  createdAt: string;
  healthScore: HealthScore | null;
}

const RISK_STYLES: Record<
  string,
  { badge: string; bar: string; label: string }
> = {
  healthy: {
    badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    bar: 'bg-emerald-500',
    label: 'Healthy',
  },
  watch: {
    badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    bar: 'bg-yellow-500',
    label: 'Watch',
  },
  at_risk: {
    badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    bar: 'bg-orange-500',
    label: 'At Risk',
  },
  critical: {
    badge: 'bg-red-500/20 text-red-400 border-red-500/30',
    bar: 'bg-red-500',
    label: 'Critical',
  },
};

const DIMENSIONS = [
  { key: 'content_consistency', short: 'Content' },
  { key: 'engagement_trajectory', short: 'Engage' },
  { key: 'review_responsiveness', short: 'Reviews' },
  { key: 'authority_momentum', short: 'Authority' },
  { key: 'advisor_engagement', short: 'Advisor' },
  { key: 'platform_usage', short: 'Usage' },
] as const;

function ScoreBar({ score, colour }: { score: number; colour: string }) {
  return (
    <div className="h-1.5 w-8 rounded-full bg-white/10 overflow-hidden">
      <div
        className={`h-full rounded-full ${colour}`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

function DeltaArrow({ delta }: { delta: number }) {
  if (delta > 0)
    return <span className="text-emerald-400 text-xs">↑{delta}</span>;
  if (delta < 0)
    return <span className="text-red-400 text-xs">↓{Math.abs(delta)}</span>;
  return <span className="text-gray-500 text-xs">→</span>;
}

function ScorePill({ score }: { score: number }) {
  const s =
    RISK_STYLES[
      score >= 75
        ? 'healthy'
        : score >= 50
          ? 'watch'
          : score >= 25
            ? 'at_risk'
            : 'critical'
    ];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-semibold border ${s.badge}`}
    >
      {score}
    </span>
  );
}

export default function ClientHealthPage() {
  const { data, isLoading, error } = useSWR<{ rows: OrgRow[]; total: number }>(
    '/api/admin/health',
    fetchJson,
    { refreshInterval: 300_000 }
  );

  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);

  async function triggerComputation() {
    setTriggering(true);
    setTriggerMsg(null);
    try {
      const resp = await fetch('/api/admin/health', { method: 'POST' });
      // SYN-732 Phase 2: previously consumed resp.json() without checking
      // resp.ok, so a 500 was rendered as "Done — processed undefined orgs,
      // 0 alerts" — the admin saw fabricated success on failure.
      if (!resp.ok) {
        throw new Error(`Health trigger failed (${resp.status})`);
      }
      const body = await resp.json();
      setTriggerMsg(
        `Done — processed ${body.processed ?? '?'} orgs, ${body.riskAlerts ?? 0} alerts`
      );
      await globalMutate('/api/admin/health');
    } catch (err) {
      setTriggerMsg(
        err instanceof Error ? err.message : 'Failed to trigger computation'
      );
    } finally {
      setTriggering(false);
    }
  }

  const rows = data?.rows ?? [];
  const atRiskCount = rows.filter(
    r =>
      r.healthScore?.riskLevel === 'at_risk' ||
      r.healthScore?.riskLevel === 'critical'
  ).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Client Health Scores
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Weekly marketing health across all active clients — sorted most
            at-risk first.
            {atRiskCount > 0 && (
              <span className="ml-2 text-orange-400 font-medium">
                {atRiskCount} need attention
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {triggerMsg && (
            <span className="text-xs text-gray-400">{triggerMsg}</span>
          )}
          <button
            onClick={triggerComputation}
            disabled={triggering}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm text-white font-medium transition-colors"
          >
            {triggering ? 'Computing…' : 'Run Now'}
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading health scores…</div>
      ) : error ? (
        <div className="text-red-400 text-sm">
          Failed to load health scores.
        </div>
      ) : rows.length === 0 ? (
        <div className="text-gray-400 text-sm">
          No scores yet — click <strong>Run Now</strong> to compute.
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">
                  Client
                </th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">
                  Score
                </th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">
                  Risk
                </th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">
                  Dimensions
                </th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">
                  Week of
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map(row => {
                const hs = row.healthScore;
                const risk = hs?.riskLevel ?? null;
                const style = risk ? RISK_STYLES[risk] : null;

                return (
                  <tr
                    key={row.id}
                    className="hover:bg-white/5 transition-colors"
                  >
                    {/* Client */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{row.name}</div>
                      <div className="text-gray-500 text-xs capitalize">
                        {row.plan}
                      </div>
                    </td>

                    {/* Score */}
                    <td className="px-4 py-3">
                      {hs ? (
                        <div className="flex items-center gap-2">
                          <ScorePill score={hs.overallScore} />
                          <DeltaArrow delta={hs.scoreDelta} />
                        </div>
                      ) : (
                        <span className="text-gray-500 text-xs">No data</span>
                      )}
                    </td>

                    {/* Risk badge */}
                    <td className="px-4 py-3">
                      {style ? (
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${style.badge}`}
                        >
                          {style.label}
                        </span>
                      ) : (
                        <span className="text-gray-500 text-xs">—</span>
                      )}
                    </td>

                    {/* Dimension mini-bars */}
                    <td className="px-4 py-3">
                      {hs ? (
                        <div className="flex items-end gap-2">
                          {DIMENSIONS.map(d => {
                            const dim = hs.dimensions[d.key];
                            const dimScore = dim?.score ?? 0;
                            const barColour =
                              dimScore >= 75
                                ? 'bg-emerald-500'
                                : dimScore >= 50
                                  ? 'bg-yellow-500'
                                  : dimScore >= 25
                                    ? 'bg-orange-500'
                                    : 'bg-red-500';
                            return (
                              <div
                                key={d.key}
                                className="flex flex-col items-center gap-1"
                                title={dim?.description ?? d.short}
                              >
                                <ScoreBar
                                  score={dimScore}
                                  colour={dim ? barColour : 'bg-gray-700'}
                                />
                                <span className="text-[10px] text-gray-600">
                                  {d.short}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-gray-500 text-xs">—</span>
                      )}
                    </td>

                    {/* Week */}
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {hs
                        ? new Date(hs.weekStart).toLocaleDateString('en-AU', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-500">
        {Object.entries(RISK_STYLES).map(([key, s]) => (
          <span
            key={key}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${s.badge}`}
          >
            {s.label}
          </span>
        ))}
        <span className="text-gray-600">
          Scores computed Monday 05:00 AEDT · Internal only until validation
          complete
        </span>
      </div>
    </div>
  );
}
