'use client';

/**
 * Audience Insights Dashboard
 *
 * @description Deep dive into follower demographics, behavior patterns,
 * and growth trends across all connected platforms.
 */

import { useState, useCallback } from 'react';
import { useAudienceInsights } from '@/hooks/useAudienceInsights';
import { DemographicsCharts } from '@/components/audience/DemographicsCharts';
import { BestTimesHeatmap } from '@/components/audience/BestTimesHeatmap';
import { PageHeader } from '@/components/dashboard/page-header';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  Users,
  TrendingUp,
  MapPin,
  Clock,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Activity,
} from '@/components/icons';
import { cn } from '@/lib/utils';

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
  trend?: number;
}

function StatCard({ icon: Icon, label, value, subValue, color, trend }: StatCardProps) {
  return (
    <div className="bg-gray-900/50 border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', `bg-${color}-500/10`)}>
          <Icon className={cn('w-5 h-5', `text-${color}-400`)} />
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-400">{label}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-white">{value}</p>
            {trend !== undefined && (
              <span
                className={cn(
                  'text-sm font-medium',
                  trend >= 0 ? 'text-emerald-400' : 'text-red-400'
                )}
              >
                {trend >= 0 ? '+' : ''}
                {trend}%
              </span>
            )}
          </div>
          {subValue && <p className="text-xs text-gray-500">{subValue}</p>}
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-900/50 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/5 rounded-lg animate-pulse" />
              <div className="space-y-2">
                <div className="w-20 h-3 bg-white/5 rounded animate-pulse" />
                <div className="w-16 h-6 bg-white/5 rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-gray-900/30 border border-white/10 rounded-xl p-4 h-[280px]">
            <div className="w-32 h-4 bg-white/5 rounded animate-pulse mb-4" />
            <div className="h-[200px] bg-white/5 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: { date: string; followers: number; gained: number; lost: number };
  }>;
  label?: string;
}

function GrowthTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-gray-900 border border-white/10 rounded-lg p-3 shadow-xl">
      <p className="text-sm text-gray-400 mb-2">{formatDate(data.date)}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-sm text-white">Total</span>
          <span className="text-sm font-medium text-white">{formatNumber(data.followers)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-sm text-emerald-400">Gained</span>
          <span className="text-sm font-medium text-emerald-400">+{formatNumber(data.gained)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-sm text-red-400">Lost</span>
          <span className="text-sm font-medium text-red-400">-{formatNumber(data.lost)}</span>
        </div>
      </div>
    </div>
  );
}

export default function AudienceInsightsPage() {
  const [platform, setPlatform] = useState<string>('all');
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  const { data, isLoading, error, refetch } = useAudienceInsights({ platform, period });

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Get top location
  const topLocation = data?.demographics?.topLocations?.[0];

  // Calculate avg engagement from best times
  const avgEngagement =
    data?.behavior?.bestPostingTimes?.length &&
    Math.round(
      data.behavior.bestPostingTimes.reduce((sum, t) => sum + t.engagement, 0) /
        data.behavior.bestPostingTimes.length
    );

  // Format growth trend for chart
  const growthData = data?.growth?.trend?.map((point) => ({
    ...point,
    date: point.date,
  }));

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title="Audience Insights" description="Understand your followers" />
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <div>
              <h3 className="text-lg font-semibold text-white">Failed to load audience data</h3>
              <p className="text-red-400">{error}</p>
            </div>
          </div>
          <Button onClick={handleRefresh} variant="outline" className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader
          title="Audience Insights"
          description="Demographics, behavior patterns, and growth trends"
        />
        <div className="flex items-center gap-3">
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="w-[140px] bg-gray-900/50 border-white/10">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="twitter">Twitter</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as '7d' | '30d' | '90d')}>
            <SelectTrigger className="w-[100px] bg-gray-900/50 border-white/10">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
            className="border-white/10"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Users}
              label="Total Followers"
              value={formatNumber(data?.growth?.current || 0)}
              trend={data?.growth?.changePercent}
              color="cyan"
            />
            <StatCard
              icon={TrendingUp}
              label="Growth"
              value={`${data?.growth?.changePercent && data.growth.changePercent >= 0 ? '+' : ''}${data?.growth?.changePercent || 0}%`}
              subValue={`${formatNumber(Math.abs(data?.growth?.change || 0))} ${(data?.growth?.change || 0) >= 0 ? 'gained' : 'lost'}`}
              color="emerald"
            />
            <StatCard
              icon={Activity}
              label="Avg Engagement"
              value={`${avgEngagement || 0}%`}
              subValue="Based on posting times"
              color="violet"
            />
            <StatCard
              icon={MapPin}
              label="Top Location"
              value={topLocation?.location || 'N/A'}
              subValue={topLocation ? `${topLocation.percentage}% of audience` : undefined}
              color="orange"
            />
          </div>

          {/* Demographics Section */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Demographics</h3>
            <DemographicsCharts
              demographics={data?.demographics || { ageRanges: [], genderSplit: [], topLocations: [], topLanguages: [] }}
              totalAudience={data?.growth?.current}
              isLoading={isLoading}
            />
          </div>

          {/* Behavior Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Best Posting Times</h3>
              <BestTimesHeatmap
                data={data?.behavior?.bestPostingTimes || []}
                isLoading={isLoading}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Active Hours</h3>
              <div className="bg-gray-900/30 border border-white/10 rounded-xl p-4">
                <div className="h-[280px]">
                  {data?.behavior?.activeHours?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={data.behavior.activeHours}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="activeHoursGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                          dataKey="hour"
                          stroke="#6b7280"
                          tick={{ fill: '#9ca3af', fontSize: 11 }}
                          tickLine={false}
                          tickFormatter={(h) => (h % 4 === 0 ? `${h}:00` : '')}
                        />
                        <YAxis
                          stroke="#6b7280"
                          tick={{ fill: '#9ca3af', fontSize: 11 }}
                          tickLine={false}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload as { hour: number; activity: number };
                            return (
                              <div className="bg-gray-900 border border-white/10 rounded-lg p-2 shadow-xl">
                                <p className="text-xs text-gray-400">{d.hour}:00</p>
                                <p className="text-sm font-medium text-white">{d.activity}% activity</p>
                              </div>
                            );
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="activity"
                          stroke="#06b6d4"
                          fill="url(#activeHoursGradient)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No active hours data
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Growth Section */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Follower Growth</h3>
            <div className="bg-gray-900/30 border border-white/10 rounded-xl p-4">
              <div className="h-[300px]">
                {growthData?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={growthData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        dataKey="date"
                        stroke="#6b7280"
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        tickLine={false}
                        tickFormatter={formatDate}
                      />
                      <YAxis
                        stroke="#6b7280"
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        tickLine={false}
                        tickFormatter={formatNumber}
                      />
                      <Tooltip content={<GrowthTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="followers"
                        stroke="#10b981"
                        fill="url(#growthGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    No growth data available
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
