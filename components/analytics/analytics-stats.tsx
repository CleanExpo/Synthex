'use client';

/**
 * Analytics Stats Component
 * Key metrics cards for analytics overview
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, Heart, Activity, Users, TrendingUp, TrendingDown } from '@/components/icons';
import type { DisplayData, GrowthData } from './types';

interface AnalyticsStatsProps {
  data: DisplayData;
  growth?: GrowthData;
}

function GrowthIndicator({ change }: { change: number }) {
  if (change === 0) {
    return <span className="text-xs text-slate-400">No change</span>;
  }
  const isPositive = change > 0;
  return (
    <div className="flex items-center mt-1">
      {isPositive ? (
        <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
      ) : (
        <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
      )}
      <span className={`text-xs ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
        {isPositive ? '+' : ''}{change}%
      </span>
      <span className="text-xs text-slate-500 ml-1">from last period</span>
    </div>
  );
}

export function AnalyticsStats({ data, growth }: AnalyticsStatsProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">Total Reach</CardTitle>
          <Eye className="h-4 w-4 text-cyan-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{formatNumber(data.reach)}</div>
          <GrowthIndicator change={growth?.reachChange ?? 0} />
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">Total Engagement</CardTitle>
          <Heart className="h-4 w-4 text-cyan-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{formatNumber(data.engagement)}</div>
          <GrowthIndicator change={growth?.engagementChange ?? 0} />
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">Engagement Rate</CardTitle>
          <Activity className="h-4 w-4 text-cyan-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{data.engagementRate.toFixed(1)}%</div>
          <div className="flex items-center mt-1">
            {data.engagementRate > 5 ? (
              <>
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-xs text-green-500">Good</span>
              </>
            ) : (
              <>
                <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                <span className="text-xs text-red-500">Needs improvement</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">Follower Growth</CardTitle>
          <Users className="h-4 w-4 text-cyan-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">+{formatNumber(data.followerGrowth)}</div>
          <GrowthIndicator change={growth?.postsChange ?? 0} />
        </CardContent>
      </Card>
    </div>
  );
}
