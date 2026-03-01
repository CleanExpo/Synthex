'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp, Users, Eye, Heart, MessageSquare, Zap, ArrowUp, ArrowDown
} from '@/components/icons';
import { formatNumber } from './constants';
import type { AnalyticsData } from './types';

interface OverviewMetricsProps {
  overview: AnalyticsData['overview'];
}

function getChangeIcon(value: number) {
  return value >= 0 ? (
    <ArrowUp className="w-4 h-4 text-green-500" />
  ) : (
    <ArrowDown className="w-4 h-4 text-red-500" />
  );
}

function getChangeColor(value: number) {
  return value >= 0 ? 'text-green-500' : 'text-red-500';
}

export function OverviewMetrics({ overview }: OverviewMetricsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
      <Card variant="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-gray-400">Total Reach</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold">{formatNumber(overview.totalReach)}</p>
            <Eye className="w-5 h-5 text-cyan-500" />
          </div>
          <div className="flex items-center gap-1 mt-2">
            {getChangeIcon(12.5)}
            <span className={`text-sm ${getChangeColor(12.5)}`}>12.5%</span>
          </div>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-gray-400">Engagement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold">{formatNumber(overview.totalEngagement)}</p>
            <Heart className="w-5 h-5 text-pink-500" />
          </div>
          <div className="flex items-center gap-1 mt-2">
            {getChangeIcon(8.3)}
            <span className={`text-sm ${getChangeColor(8.3)}`}>8.3%</span>
          </div>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-gray-400">Followers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold">{formatNumber(overview.totalFollowers)}</p>
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <div className="flex items-center gap-1 mt-2">
            {getChangeIcon(overview.growthRate)}
            <span className={`text-sm ${getChangeColor(overview.growthRate)}`}>
              {overview.growthRate}%
            </span>
          </div>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-gray-400">Posts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold">{overview.totalPosts}</p>
            <MessageSquare className="w-5 h-5 text-green-500" />
          </div>
          <div className="flex items-center gap-1 mt-2">
            {getChangeIcon(23)}
            <span className={`text-sm ${getChangeColor(23)}`}>23 this week</span>
          </div>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-gray-400">Engagement Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold">{overview.engagementRate}%</p>
            <Zap className="w-5 h-5 text-yellow-500" />
          </div>
          <Progress value={overview.engagementRate * 10} className="mt-2" />
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-gray-400">Growth Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold">{overview.growthRate}%</p>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <Progress value={overview.growthRate * 4} className="mt-2" />
        </CardContent>
      </Card>
    </div>
  );
}
