'use client';

import useSWR from 'swr';
import { fetchJson } from '@/lib/fetcher';
import { useState } from 'react';

/**
 * ROI Attribution Dashboard — SYN-624 (skeleton)
 *
 * Shows revenue attribution from recommended actions with attribution_context.
 * Protected by /dashboard/admin/layout.tsx (owner-only).
 *
 * NOTE: Data will be sparse until SYN-622 validates the attribution model
 * (~09/04/2026, after 7 days of health score accumulation).
 */

interface Summary {
  totalActions: number;
  totalRevenue: number;
  totalEnquiries: number;
  avgConfidence: number | null;
  topContentType: string | null;
  lookbackDays: number;
}

interface ContentTypeBreakdown {
  contentType: string;
  actionCount: number;
  totalRevenue: number;
  totalEnquiries: number;
  avgConfidence: number;
}

interface ActionRow {
  id: string;
  dollarAttribution: string;
  weekStart: string;
  status: string;
  createdAt: string;
  organizationId: string;
  attribution: {
    contentType?: string;
    trackedRevenue?: number;
    trackedEnquiries?: number;
    predictedConversionProbability?: number;
    ga4Connected?: boolean;
  };
}

interface ROIData {
  summary: Summary;
  breakdown: ContentTypeBreakdown[];
  actions: ActionRow[];
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  social_post: 'Social Posts',
  review_response: 'Review Responses',
  blog_article: 'Blog Articles',
  google_post: 'Google Posts',
  email_campaign: 'Email Campaigns',
  unknown: 'Unclassified',
};

const CONTENT_TYPE_COLOURS: Record<string, string> = {
  social_post: 'bg-blue-500',
  review_response: 'bg-emerald-500',
  blog_article: 'bg-purple-500',
  google_post: 'bg-amber-500',
  email_campaign: 'bg-pink-500',
  unknown: 'bg-gray-500',
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="text-xs text-gray-400 uppercase tracking-wider">{label}</div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const colour = pct >= 70 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
    : pct >= 40 ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10'
    : 'text-gray-400 border-gray-500/30 bg-gray-500/10';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${colour}`}>
      {pct}%
    </span>
  );
}

function BreakdownBar({ breakdown }: { breakdown: ContentTypeBreakdown[] }) {
  const total = breakdown.reduce((sum, b) => sum + b.actionCount, 0);
  if (total === 0) return null;

  return (
    <div className="space-y-2">
      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden bg-white/5">
        {breakdown.map(b => {
          const pct = (b.actionCount / total) * 100;
          if (pct < 1) return null;
          return (
            <div
              key={b.contentType}
              className={`${CONTENT_TYPE_COLOURS[b.contentType] ?? 'bg-gray-500'} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${CONTENT_TYPE_LABELS[b.contentType] ?? b.contentType}: ${b.actionCount} actions`}
            />
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {breakdown.map(b => (
          <div key={b.contentType} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${CONTENT_TYPE_COLOURS[b.contentType] ?? 'bg-gray-500'}`} />
            <span className="text-gray-400">{CONTENT_TYPE_LABELS[b.contentType] ?? b.contentType}</span>
            <span className="text-gray-600">({b.actionCount})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ROIAttributionPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useSWR<ROIData>(
    `/api/admin/roi-attribution?days=${days}`,
    fetchJson,
    { refreshInterval: 300_000 }
  );

  const summary = data?.summary;
  const breakdown = data?.breakdown ?? [];
  const actions = data?.actions ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">ROI Attribution</h1>
          <p className="text-gray-400 mt-1 text-sm">
            Revenue impact from Synthex-managed content actions.
            {summary?.totalActions === 0 && (
              <span className="ml-2 text-amber-400">Data accumulating — attribution model validating.</span>
            )}
          </p>
        </div>
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-indigo-500"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Loading / Error */}
      {isLoading && <div className="text-gray-400 text-sm">Loading attribution data...</div>}
      {error && <div className="text-red-400 text-sm">Failed to load attribution data.</div>}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Tracked Revenue"
            value={summary.totalRevenue > 0 ? `$${summary.totalRevenue.toLocaleString('en-AU')}` : '$0'}
            sub={summary.totalRevenue === 0 ? 'Awaiting GA4 data' : `${days}-day window`}
          />
          <StatCard
            label="Tracked Enquiries"
            value={summary.totalEnquiries.toString()}
            sub="From attributed actions"
          />
          <StatCard
            label="Avg Confidence"
            value={summary.avgConfidence != null ? `${Math.round(summary.avgConfidence * 100)}%` : 'N/A'}
            sub="Model prediction accuracy"
          />
          <StatCard
            label="Attributed Actions"
            value={summary.totalActions.toString()}
            sub={summary.topContentType ? `Top: ${CONTENT_TYPE_LABELS[summary.topContentType] ?? summary.topContentType}` : 'No data yet'}
          />
        </div>
      )}

      {/* Content Type Breakdown */}
      {breakdown.length > 0 && (
        <div className="rounded-xl border border-white/10 p-5 space-y-4">
          <h2 className="text-sm font-medium text-gray-300">Attribution by Content Type</h2>
          <BreakdownBar breakdown={breakdown} />
          <div className="rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium">Content Type</th>
                  <th className="text-right px-4 py-2 text-gray-400 font-medium">Actions</th>
                  <th className="text-right px-4 py-2 text-gray-400 font-medium">Revenue</th>
                  <th className="text-right px-4 py-2 text-gray-400 font-medium">Enquiries</th>
                  <th className="text-right px-4 py-2 text-gray-400 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {breakdown.map(b => (
                  <tr key={b.contentType} className="hover:bg-white/5">
                    <td className="px-4 py-2 text-white">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${CONTENT_TYPE_COLOURS[b.contentType] ?? 'bg-gray-500'}`} />
                        {CONTENT_TYPE_LABELS[b.contentType] ?? b.contentType}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-300">{b.actionCount}</td>
                    <td className="px-4 py-2 text-right text-gray-300">
                      {b.totalRevenue > 0 ? `$${b.totalRevenue.toLocaleString('en-AU')}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-300">{b.totalEnquiries || '—'}</td>
                    <td className="px-4 py-2 text-right">
                      {b.avgConfidence > 0 ? <ConfidenceBadge confidence={b.avgConfidence} /> : <span className="text-gray-500">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Actions Table */}
      {actions.length > 0 && (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="px-5 py-3 bg-white/5 border-b border-white/10">
            <h2 className="text-sm font-medium text-gray-300">Recent Attributed Actions</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="text-left px-4 py-2 text-gray-400 font-medium">Attribution</th>
                <th className="text-left px-4 py-2 text-gray-400 font-medium">Content Type</th>
                <th className="text-left px-4 py-2 text-gray-400 font-medium">Status</th>
                <th className="text-right px-4 py-2 text-gray-400 font-medium">Revenue</th>
                <th className="text-right px-4 py-2 text-gray-400 font-medium">Confidence</th>
                <th className="text-left px-4 py-2 text-gray-400 font-medium">Week</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {actions.map(a => (
                <tr key={a.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-2 text-white max-w-[200px] truncate" title={a.dollarAttribution}>
                    {a.dollarAttribution}
                  </td>
                  <td className="px-4 py-2 text-gray-400 text-xs">
                    {CONTENT_TYPE_LABELS[a.attribution.contentType ?? ''] ?? a.attribution.contentType ?? '—'}
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-xs text-gray-400 capitalize">{a.status}</span>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-300">
                    {a.attribution.trackedRevenue ? `$${a.attribution.trackedRevenue.toLocaleString('en-AU')}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {a.attribution.predictedConversionProbability != null ? (
                      <ConfidenceBadge confidence={a.attribution.predictedConversionProbability} />
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-400 text-xs">
                    {new Date(a.weekStart).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && summary?.totalActions === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <div className="text-gray-400 text-sm">
            <p className="font-medium text-white mb-2">No attribution data yet</p>
            <p>The attribution model is accumulating data from the health score engine</p>
            <p>and telemetry layer. Expected availability: ~09/04/2026.</p>
            <p className="mt-3 text-gray-500">
              Requires: recommended_actions with populated attribution_context fields
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-xs text-gray-600">
        ROI Attribution Dashboard (SYN-624) — Data from recommended_actions.attribution_context
        {' '} | Attribution model validation: SYN-622
      </div>
    </div>
  );
}
