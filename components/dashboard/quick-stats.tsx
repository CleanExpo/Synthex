'use client';

import type { DashboardStats } from './types';

interface QuickStatsProps {
  stats: DashboardStats | null;
}

const STAT_COLORS: Record<string, string> = {
  posts: '#00F5FF',
  engagement: '#00FF88',
  followers: '#FFB800',
  scheduled: '#00F5FF',
};

/** Horizontal data strip — Scientific Luxury: mono font, single-pixel separators */
export function QuickStats({ stats }: QuickStatsProps) {
  const items = [
    {
      key: 'posts',
      value: (stats?.totalPosts || 0).toLocaleString(),
      label: 'Total Posts',
      color: STAT_COLORS.posts,
    },
    {
      key: 'engagement',
      value: `${(stats?.engagementRate || 0).toFixed(1)}%`,
      label: 'Engagement Rate',
      color: STAT_COLORS.engagement,
    },
    {
      key: 'followers',
      value: (stats?.followers || 0).toLocaleString(),
      label: 'Total Followers',
      color: STAT_COLORS.followers,
    },
    {
      key: 'scheduled',
      value: (stats?.scheduledPosts || 0).toString(),
      label: 'Scheduled',
      color: STAT_COLORS.scheduled,
    },
    {
      key: 'platforms',
      value: (stats?.connectedPlatforms || 0).toString(),
      label: 'Platforms',
      color: '#6B7280',
    },
    {
      key: 'campaigns',
      value: (stats?.activeCampaigns || 0).toString(),
      label: 'Campaigns',
      color: '#6B7280',
    },
  ];

  return (
    <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
        {items.map(item => (
          <div
            key={item.key}
            className="flex flex-col gap-1.5 px-5 py-4 group hover:bg-white/[0.02] transition-colors"
          >
            <span
              className="font-mono text-xl lg:text-2xl font-medium tabular-nums leading-none"
              style={{ color: item.color }}
            >
              {item.value}
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
