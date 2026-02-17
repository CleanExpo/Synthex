'use client';

import { useState, useMemo, useCallback } from 'react';
import type { DateRange } from 'react-day-picker';
import { AnalyticsSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
import { usePerformanceAnalytics } from '@/hooks/use-dashboard';

import {
  type DisplayData,
  platformColors,
  transformTimelineToEngagement,
  transformTimelineToGrowth,
  transformTopContent,
  AnalyticsHeader,
  AnalyticsStats,
  EngagementChart,
  PlatformChart,
  PerformanceChart,
  GrowthChart,
  TopPosts,
  MetricsTable,
} from '@/components/analytics';

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('30d');
  const [platform, setPlatform] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Derive startDate/endDate ISO strings when custom range is active
  const startDate = timeRange === 'custom' && dateRange?.from
    ? dateRange.from.toISOString()
    : undefined;
  const endDate = timeRange === 'custom' && dateRange?.to
    ? dateRange.to.toISOString()
    : undefined;

  const { data: responseData, isLoading, error, refetch } = usePerformanceAnalytics({
    period: timeRange,
    platform,
    granularity: 'day',
    startDate,
    endDate,
  });

  const performanceData = responseData?.data;

  const handleRetry = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleTimeRangeChange = useCallback((value: string) => {
    setTimeRange(value);
    // Clear custom date range when switching away from 'custom'
    if (value !== 'custom') {
      setDateRange(undefined);
    }
  }, []);

  // Build displayData from performance API overview
  const displayData: DisplayData = useMemo(() => ({
    reach: performanceData?.overview?.totalReach ?? 0,
    engagement: performanceData?.overview?.totalEngagement ?? 0,
    engagementRate: performanceData?.overview?.averageEngagementRate ?? 0,
    followerGrowth: 0,
    growth: performanceData?.growth,
  }), [performanceData]);

  // Transform platform data for pie chart (from performance API platforms array)
  const chartPlatformDistribution = useMemo(() => {
    if (!performanceData?.platforms || performanceData.platforms.length === 0) {
      return [];
    }
    const total = performanceData.platforms.reduce((sum, p) => sum + p.posts, 0);
    return performanceData.platforms.map((p) => ({
      name: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
      value: total > 0 ? Math.round((p.posts / total) * 100) : 0,
      color: platformColors[p.platform] ?? '#06b6d4',
    }));
  }, [performanceData?.platforms]);

  // Transform timeline data for engagement chart
  const chartEngagementData = useMemo(
    () => transformTimelineToEngagement(performanceData?.timeline),
    [performanceData?.timeline]
  );

  // Transform timeline data for growth chart
  const chartGrowthData = useMemo(
    () => transformTimelineToGrowth(performanceData?.timeline),
    [performanceData?.timeline]
  );

  // Transform top content for TopPosts
  const chartTopPosts = useMemo(
    () => transformTopContent(performanceData?.topContent),
    [performanceData?.topContent]
  );

  // Transform platforms for PerformanceChart (radar chart axes: engagement, reach, clicks)
  const chartPerformanceData = useMemo(() => {
    if (!performanceData?.platforms || performanceData.platforms.length === 0) {
      return [];
    }
    return performanceData.platforms.map((p) => ({
      type: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
      engagement: p.engagement,
      reach: p.engagementRate, // engagementRate maps to reach axis (0-100 scale)
      clicks: p.posts,
    }));
  }, [performanceData?.platforms]);

  const handleExport = useCallback(() => {
    const exportData = {
      overview: performanceData?.overview ?? null,
      growth: performanceData?.growth ?? null,
      platforms: performanceData?.platforms ?? [],
      timeline: performanceData?.timeline ?? [],
      timeRange,
      exportedAt: new Date().toISOString(),
    };
    const data = JSON.stringify(exportData, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${timeRange}.json`;
    a.click();
  }, [performanceData, timeRange]);

  const handleViewPostDetails = useCallback((postId: number) => {
    window.location.href = `/dashboard/content?postId=${postId}`;
  }, []);

  const handleViewAllPosts = useCallback(() => {
    window.location.href = '/dashboard/content';
  }, []);

  if (isLoading) {
    return <AnalyticsSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6">
        <APIErrorCard
          title="Analytics Error"
          message={error.message}
          onRetry={handleRetry}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnalyticsHeader
        timeRange={timeRange}
        onTimeRangeChange={handleTimeRangeChange}
        onExport={handleExport}
        platform={platform}
        onPlatformChange={setPlatform}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      <AnalyticsStats data={displayData} growth={performanceData?.growth} />

      <div className="grid gap-6 lg:grid-cols-2">
        <EngagementChart data={chartEngagementData} />
        <PlatformChart data={chartPlatformDistribution} />
      </div>

      <PerformanceChart data={chartPerformanceData} />

      <div className="grid gap-6 lg:grid-cols-2">
        <GrowthChart data={chartGrowthData} />
        <TopPosts
          posts={chartTopPosts}
          onViewDetails={handleViewPostDetails}
          onViewAll={handleViewAllPosts}
        />
      </div>

      <MetricsTable />
    </div>
  );
}
