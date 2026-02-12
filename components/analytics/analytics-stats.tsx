'use client';

/**
 * Analytics Stats Component
 * Key metrics cards for analytics overview
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, Heart, Activity, Users, TrendingUp, TrendingDown } from 'lucide-react';
import type { DisplayData } from './types';

interface AnalyticsStatsProps {
  data: DisplayData;
}

export function AnalyticsStats({ data }: AnalyticsStatsProps) {
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
          <div className="flex items-center mt-1">
            <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
            <span className="text-xs text-green-500">+18.2%</span>
            <span className="text-xs text-slate-500 ml-1">from last period</span>
          </div>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">Total Engagement</CardTitle>
          <Heart className="h-4 w-4 text-cyan-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{formatNumber(data.engagement)}</div>
          <div className="flex items-center mt-1">
            <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
            <span className="text-xs text-green-500">+12.5%</span>
            <span className="text-xs text-slate-500 ml-1">from last period</span>
          </div>
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
          <div className="flex items-center mt-1">
            <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
            <span className="text-xs text-green-500">+24.8%</span>
            <span className="text-xs text-slate-500 ml-1">from last period</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
