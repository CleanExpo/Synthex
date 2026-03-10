'use client';

/**
 * Schedule Stats Component
 * Stats cards for schedule overview
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, CheckCircle, TrendingUp, Zap } from '@/components/icons';
import type { ScheduleStats } from './types';

interface ScheduleStatsGridProps {
  stats: ScheduleStats;
}

export function ScheduleStatsGrid({ stats }: ScheduleStatsGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">Scheduled</CardTitle>
          <Clock className="h-4 w-4 text-cyan-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{stats.scheduled}</div>
          <p className="text-xs text-slate-500 mt-1">Ready to publish</p>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">Published</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{stats.published}</div>
          <p className="text-xs text-slate-500 mt-1">This month</p>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">Avg Engagement</CardTitle>
          <TrendingUp className="h-4 w-4 text-cyan-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{stats.avgEngagement.toFixed(1)}%</div>
          <p className="text-xs text-slate-500 mt-1">Across all posts</p>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">Best Time</CardTitle>
          <Zap className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">2:00 PM</div>
          <p className="text-xs text-slate-500 mt-1">Highest engagement</p>
        </CardContent>
      </Card>
    </div>
  );
}
