'use client';

/**
 * Content Stats Component
 *
 * Displays real per-user post metrics fetched from
 * /api/analytics/dashboard-stats.  Falls back to zeros on
 * fetch error so the page always renders cleanly.
 */

import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, BarChart3, Clock, Target } from '@/components/icons';
import type { DashboardStatsData } from '@/app/api/analytics/dashboard-stats/route';

interface StatItem {
  title: string;
  value: string;
  change: string;
  Icon: React.ComponentType<{ className?: string }>;
}

function buildStats(data: DashboardStatsData): StatItem[] {
  return [
    {
      title: 'Generated Today',
      value: String(data.todayPosts),
      change: data.todayPosts === 1 ? '1 post created today' : `${data.todayPosts} posts created today`,
      Icon: Sparkles,
    },
    {
      title: 'Avg Engagement',
      value: data.avgEngagement > 0 ? `${data.avgEngagement.toFixed(1)}%` : '—',
      change: data.avgEngagement > 0 ? 'From connected platforms' : 'Connect platforms to track',
      Icon: BarChart3,
    },
    {
      title: 'Scheduled',
      value: String(data.scheduledPosts),
      change: data.scheduledPosts === 1 ? '1 post queued' : `${data.scheduledPosts} posts queued`,
      Icon: Clock,
    },
    {
      title: 'Success Rate',
      value: `${data.successRate}%`,
      change: data.totalPosts > 0 ? `${data.publishedPosts} of ${data.totalPosts} published` : 'No posts yet',
      Icon: Target,
    },
  ];
}

const emptyData: DashboardStatsData = {
  totalPosts: 0,
  publishedPosts: 0,
  scheduledPosts: 0,
  draftPosts: 0,
  todayPosts: 0,
  avgEngagement: 0,
  successRate: 0,
};

interface ApiResponse {
  success?: boolean;
  data?: DashboardStatsData;
}

const fetchJson = async (url: string): Promise<ApiResponse | null> => {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) return null;
  return res.json();
};

export function ContentStats() {
  const { data: body } = useSWR<ApiResponse | null>(
    '/api/analytics/dashboard-stats',
    fetchJson,
    { revalidateOnFocus: false }
  );

  const statsData = body?.success && body?.data ? body.data : emptyData;
  const stats = buildStats(statsData);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map(({ title, value, change, Icon }) => (
        <Card key={title} variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">{title}</CardTitle>
            <Icon className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{value}</div>
            <p className="text-xs text-gray-500 mt-1">{change}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
