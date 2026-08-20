'use client';

/**
 * Analytics KPI Cards
 * Four key metrics: Reach, Engagement, Engagement Rate, Follower Growth.
 * Synthex design: sharp-corner stat cards, mono numerals, orange accent icons,
 * green/red delta chips, white/N opacity text tokens.
 */

import { Eye, Heart, Activity, Users, TrendingUp, TrendingDown } from '@/components/icons';
import type { DisplayData, GrowthData } from './types';

interface AnalyticsStatsProps {
  data: DisplayData;
  growth?: GrowthData;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function Delta({ change }: { change: number }) {
  if (change === 0)
    return <span className="text-[10px] text-white/25 tabular-nums">No change</span>;
  const pos = change > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] tabular-nums font-medium ${pos ? 'text-emerald-400' : 'text-red-400'}`}
    >
      {pos ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {pos ? '+' : ''}{change}%
      <span className="text-white/25 font-normal ml-1">vs last period</span>
    </span>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  accent: string;
  delta?: React.ReactNode;
  note?: React.ReactNode;
}

function StatCard({ label, value, icon: Icon, accent, delta, note }: StatCardProps) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 border-[0.5px] border-white/6 bg-white/1.5 rounded-sm hover:bg-white/2.5 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-[0.22em] text-white/35">{label}</span>
        <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
      </div>
      <span className="font-mono text-2xl font-medium tabular-nums leading-none text-white">
        {value}
      </span>
      {delta ?? note}
    </div>
  );
}

export function AnalyticsStats({ data, growth }: AnalyticsStatsProps) {
  const engRate = data.engagementRate ?? 0;
  const engRateStatus =
    engRate >= 3 ? (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400 font-medium">
        <TrendingUp className="h-3 w-3" /> Above benchmark
      </span>
    ) : engRate > 0 ? (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400 font-medium">
        <TrendingDown className="h-3 w-3" /> Below 3% benchmark
      </span>
    ) : (
      <span className="text-[10px] text-white/25">No data yet</span>
    );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        label="Total Reach"
        value={formatNumber(data.reach)}
        icon={Eye}
        accent="#FF6B35"
        delta={<Delta change={growth?.reachChange ?? 0} />}
      />
      <StatCard
        label="Total Engagement"
        value={formatNumber(data.engagement)}
        icon={Heart}
        accent="#FF6B35"
        delta={<Delta change={growth?.engagementChange ?? 0} />}
      />
      <StatCard
        label="Engagement Rate"
        value={`${engRate.toFixed(1)}%`}
        icon={Activity}
        accent="#00F5FF"
        note={engRateStatus}
      />
      <StatCard
        label="Follower Growth"
        value={formatNumber(data.followerGrowth)}
        icon={Users}
        accent="#00FF88"
        note={
          data.followerDataCollecting ? (
            <span className="text-[10px] text-white/25">Collecting data…</span>
          ) : (
            <Delta change={data.followerChangePercent ?? 0} />
          )
        }
      />
    </div>
  );
}
