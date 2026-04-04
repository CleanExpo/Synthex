'use client';

/**
 * Admin: Intervention Logs — SYN-614
 *
 * Shows aggregated intervention frequency by dimension, tier, and channel.
 * Allows adjusting the lookback window (7 / 30 / 90 days).
 * Protected by /dashboard/admin/layout.tsx (owner-only).
 */

import { useState } from 'react';
import useSWR from 'swr';
import { fetchJson } from '@/lib/fetcher';

interface DimensionAgg {
  dimension: string;
  tier: number;
  channel: string;
  total: number;
  dispatched: number;
  observed: number;
}

interface OrgCount {
  name: string;
  plan: string;
  count: number;
}

interface LogsData {
  windowDays: number;
  totalInterventions: number;
  dispatched: number;
  observed: number;
  byDimension: DimensionAgg[];
  topOrgs: OrgCount[];
}

const CHANNEL_BADGE: Record<string, string> = {
  in_app:       'bg-violet-500/20 text-violet-400 border-violet-500/30',
  email:        'bg-sky-500/20 text-sky-400 border-sky-500/30',
  founder_queue:'bg-rose-500/20 text-rose-400 border-rose-500/30',
};

const TIER_LABEL: Record<number, { label: string; colour: string }> = {
  1: { label: 'T1', colour: 'text-yellow-400' },
  2: { label: 'T2', colour: 'text-orange-400' },
  3: { label: 'T3', colour: 'text-red-400' },
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

const WINDOW_OPTIONS = [
  { label: '7 days',  value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];

export default function InterventionLogsPage() {
  const [days, setDays] = useState(30);

  const { data, isLoading, error } = useSWR<LogsData>(
    `/api/admin/intervention-logs?days=${days}`,
    fetchJson,
    { refreshInterval: 300_000 }
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Intervention Logs</h1>
          <p className="text-gray-400 mt-1 text-sm">
            Frequency of intervention triggers by dimension, tier, and channel.
          </p>
        </div>
        {/* Window selector */}
        <div className="flex rounded-lg border border-white/10 overflow-hidden">
          {WINDOW_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                days === opt.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-900 text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading…</div>
      ) : error ? (
        <div className="text-red-400 text-sm">Failed to load intervention logs.</div>
      ) : !data ? null : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total triggers',  value: data.totalInterventions, colour: 'text-white' },
              { label: 'Dispatched live', value: data.dispatched,         colour: 'text-emerald-400' },
              { label: 'Observation',     value: data.observed,           colour: 'text-yellow-400' },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-white/10 bg-white/3 p-4">
                <div className={`text-3xl font-bold ${s.colour}`}>{s.value}</div>
                <div className="text-gray-400 text-sm mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* By-dimension table */}
          {data.byDimension.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No interventions logged in the last {days} days.
            </p>
          ) : (
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 bg-white/3">
                <h2 className="text-sm font-semibold text-white">By dimension</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Dimension</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Tier</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Channel</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Total</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Live</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Observed</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium w-32">Live ratio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.byDimension.map((row, i) => {
                    const tier = TIER_LABEL[row.tier] ?? { label: `T${row.tier}`, colour: 'text-gray-400' };
                    const channelClass = CHANNEL_BADGE[row.channel] ?? 'bg-zinc-700/50 text-zinc-300 border-zinc-600/30';
                    const liveRatio = row.total > 0 ? (row.dispatched / row.total) * 100 : 0;

                    return (
                      <tr key={i} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{humanDimension(row.dimension)}</td>
                        <td className={`px-4 py-3 font-bold ${tier.colour}`}>{tier.label}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs border ${channelClass}`}>
                            {row.channel.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-white">{row.total}</td>
                        <td className="px-4 py-3 text-right text-emerald-400">{row.dispatched}</td>
                        <td className="px-4 py-3 text-right text-yellow-400">{row.observed}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${liveRatio}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-8 text-right">
                              {Math.round(liveRatio)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Top orgs */}
          {data.topOrgs.length > 0 && (
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 bg-white/3">
                <h2 className="text-sm font-semibold text-white">Most-intervened clients</h2>
                <p className="text-xs text-gray-500 mt-0.5">Top 10 by intervention count in window</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">#</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Client</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Interventions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.topOrgs.map((org, i) => (
                    <tr key={org.name} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-gray-500 text-xs">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-white">{org.name}</span>
                          <PlanBadge plan={org.plan} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-white font-medium">{org.count}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
