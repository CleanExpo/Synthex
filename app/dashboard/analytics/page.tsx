'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { DateRange } from 'react-day-picker';
import { AnalyticsSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
import {
  usePerformanceAnalytics,
  useRealtimeAnalytics,
  useFollowerGrowth,
} from '@/hooks/use-dashboard';
import { HelpVideo } from '@/components/ui/HelpVideo';

import {
  type DisplayData,
  type TopPostDetail,
  platformColors,
  transformTimelineToEngagement,
  transformTimelineToGrowth,
  transformTopContent,
  AnalyticsHeader,
  AnalyticsStats,
  PostDetailSheet,
} from '@/components/analytics';
import type { ExportFormat } from '@/components/analytics/analytics-header';

// Dynamic imports for heavy chart components
const EngagementChart = dynamic(
  () => import('@/components/analytics').then(m => ({ default: m.EngagementChart })),
  { ssr: false }
);
const PlatformChart = dynamic(
  () => import('@/components/analytics').then(m => ({ default: m.PlatformChart })),
  { ssr: false }
);
const PerformanceChart = dynamic(
  () => import('@/components/analytics').then(m => ({ default: m.PerformanceChart })),
  { ssr: false }
);
const GrowthChart = dynamic(
  () => import('@/components/analytics').then(m => ({ default: m.GrowthChart })),
  { ssr: false }
);
const TopPosts = dynamic(
  () => import('@/components/analytics').then(m => ({ default: m.TopPosts })),
  { ssr: false }
);
const MetricsTable = dynamic(
  () => import('@/components/analytics').then(m => ({ default: m.MetricsTable })),
  { ssr: false }
);
const AnomalyAlerts = dynamic(
  () => import('@/components/analytics/AnomalyAlerts').then(m => ({ default: m.AnomalyAlerts })),
  { ssr: false }
);
const ContentPerformanceWidget = dynamic(
  () => import('@/components/analytics/ContentPerformanceWidget').then(m => ({ default: m.ContentPerformanceWidget })),
  { ssr: false }
);
const SentimentAnalysis = dynamic(
  () => import('@/components/SentimentAnalysis').then(m => ({ default: m.SentimentAnalysis })),
  { ssr: false }
);
const TrendPredictionsWidget = dynamic(
  () => import('@/components/analytics/TrendPredictionsWidget').then(m => ({ default: m.TrendPredictionsWidget })),
  { ssr: false }
);
const ReportPresetsPanel = dynamic(
  () => import('@/components/analytics/ReportPresetsPanel').then(m => ({ default: m.ReportPresetsPanel })),
  { ssr: false }
);

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('30d');
  const [platform, setPlatform] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedPost, setSelectedPost] = useState<TopPostDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const startDate =
    timeRange === 'custom' && dateRange?.from ? dateRange.from.toISOString() : undefined;
  const endDate =
    timeRange === 'custom' && dateRange?.to ? dateRange.to.toISOString() : undefined;

  const { data: responseData, isLoading, error, refetch } = usePerformanceAnalytics({
    period: timeRange,
    platform,
    granularity: 'day',
    startDate,
    endDate,
  });

  const performanceData = responseData?.data;
  const { data: realtimeData } = useRealtimeAnalytics();
  const { data: followerGrowthData } = useFollowerGrowth({ period: timeRange, platform });

  const handleRetry = useCallback(async () => { await refetch(); }, [refetch]);

  const handleTimeRangeChange = useCallback((value: string) => {
    setTimeRange(value);
    if (value !== 'custom') setDateRange(undefined);
  }, []);

  const displayData: DisplayData = useMemo(() => ({
    reach:                performanceData?.overview?.totalReach ?? 0,
    engagement:           performanceData?.overview?.totalEngagement ?? 0,
    engagementRate:       performanceData?.overview?.averageEngagementRate ?? 0,
    followerGrowth:       followerGrowthData?.growth?.current ?? 0,
    followerChangePercent:followerGrowthData?.growth?.changePercent ?? 0,
    followerDataCollecting: followerGrowthData ? !followerGrowthData.hasEnoughData : true,
    growth:               performanceData?.growth,
  }), [performanceData, followerGrowthData]);

  const chartPlatformDistribution = useMemo(() => {
    if (!performanceData?.platforms?.length) return [];
    const total = performanceData.platforms.reduce((s, p) => s + p.posts, 0);
    return performanceData.platforms.map(p => ({
      name:  p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
      value: total > 0 ? Math.round((p.posts / total) * 100) : 0,
      color: platformColors[p.platform] ?? '#FF6B35',
    }));
  }, [performanceData?.platforms]);

  const chartEngagementData = useMemo(
    () => transformTimelineToEngagement(performanceData?.timeline),
    [performanceData?.timeline]
  );

  const chartGrowthData = useMemo(() => {
    const series = followerGrowthData?.series;
    if (series?.length) {
      const engByDay = new Map<string, number>();
      for (const pt of performanceData?.timeline ?? []) {
        engByDay.set(pt.date.slice(0, 10), pt.engagement);
      }
      return series.map(pt => ({
        month:      new Date(pt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        followers:  pt.followers,
        engagement: engByDay.get(pt.date) ?? 0,
      }));
    }
    return transformTimelineToGrowth(performanceData?.timeline).map(p => ({ ...p, followers: 0 }));
  }, [followerGrowthData?.series, performanceData?.timeline]);

  const collectingFollowerData = followerGrowthData ? !followerGrowthData.hasEnoughData : true;

  const chartTopPosts = useMemo(
    () => transformTopContent(performanceData?.topContent),
    [performanceData?.topContent]
  );

  const chartPerformanceData = useMemo(() => {
    if (!performanceData?.platforms?.length) return [];
    return performanceData.platforms.map(p => ({
      type:       p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
      engagement: p.engagement,
      reach:      p.engagementRate,
      clicks:     p.posts,
    }));
  }, [performanceData?.platforms]);

  const overviewTableData = useMemo(() => {
    if (!performanceData?.platforms?.length) return undefined;
    return performanceData.platforms.map(p => ({
      platform:   p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
      followers:  0,
      posts:      p.posts,
      engagement: p.engagementRate,
      reach:      p.engagement,
      growth:     p.growthPercent ?? 0,
    }));
  }, [performanceData?.platforms]);

  const engagementTableData = useMemo(() => {
    if (!performanceData?.platforms?.length) return undefined;
    return performanceData.platforms.map(p => ({
      platform: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
      likes:    Math.round(p.engagement * 0.6),
      comments: Math.round(p.engagement * 0.25),
      shares:   Math.round(p.engagement * 0.15),
      total:    p.engagement,
    }));
  }, [performanceData?.platforms]);

  const contentTableData = useMemo(() => {
    if (!performanceData?.platforms?.length) return undefined;
    return performanceData.platforms.map(p => ({
      platform:          p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
      topPosts:          p.posts,
      avgEngagementRate: p.engagementRate,
      bestTime:          p.bestTime || '\u2014',
    }));
  }, [performanceData?.platforms]);

  const isExportingRef = useRef(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async (format: ExportFormat = 'csv') => {
    if (isExportingRef.current) return;
    isExportingRef.current = true;
    setIsExporting(true);
    try {
      const params = new URLSearchParams({ format });
      if (timeRange !== 'custom') params.set('period', timeRange);
      if (platform !== 'all')    params.set('platforms', platform);
      if (startDate)             params.set('startDate', startDate);
      if (endDate)               params.set('endDate', endDate);

      const res = await fetch(`/api/analytics/export?${params}`, { credentials: 'include' });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error((e as { message?: string }).message ?? `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const cd   = res.headers.get('Content-Disposition') ?? '';
      const filename = cd.match(/filename="(.+?)"/)?.[1] ?? `analytics-${timeRange}.${format}`;
      const url = window.URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Analytics export error:', err);
    } finally {
      isExportingRef.current = false;
      setIsExporting(false);
    }
  }, [timeRange, platform, startDate, endDate]);

  const handleViewPostDetails = useCallback((postIndex: number) => {
    const raw = performanceData?.topContent?.[postIndex - 1];
    if (!raw) return;
    setSelectedPost({
      id:            raw.id,
      content:       raw.content,
      platform:      raw.platform,
      engagement:    raw.engagement,
      engagementRate:raw.engagementRate,
      publishedAt:   raw.publishedAt,
    });
    setIsDetailOpen(true);
  }, [performanceData?.topContent]);

  const handleViewAllPosts = useCallback(() => {
    window.location.href = '/dashboard/content';
  }, []);

  if (isLoading) return <AnalyticsSkeleton />;

  if (error) {
    const isNoData =
      error.message?.includes('No analytics') ||
      error.message?.includes('no data') ||
      error.message?.includes('Failed to fetch performance') ||
      error.message?.includes('HTTP 500') ||
      error.message?.includes('404');

    return (
      <div className="p-6">
        {isNoData ? (
          <div className="border-[0.5px] border-white/6 bg-white/1 rounded-sm p-16 text-center">
            <div className="mx-auto mb-5 h-10 w-10 rounded-sm border-[0.5px] border-white/8 bg-white/2 flex items-center justify-center">
              <svg className="h-4.5 w-4.5 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-white/80 mb-1">No analytics data yet</h3>
            <p className="text-xs text-white/35 max-w-xs mx-auto">
              Connect a social platform and publish some posts to see performance data here.
            </p>
          </div>
        ) : (
          <APIErrorCard title="Analytics Error" message={error.message} onRetry={handleRetry} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header row */}
      <div className="flex items-start gap-4">
        <AnalyticsHeader
          timeRange={timeRange}
          onTimeRangeChange={handleTimeRangeChange}
          onExport={handleExport}
          isExporting={isExporting}
          platform={platform}
          onPlatformChange={setPlatform}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
        <div className="mt-1 shrink-0">
          <HelpVideo videoId="feature-tour-analytics" />
        </div>
      </div>

      {/* KPI cards */}
      <AnalyticsStats data={displayData} growth={performanceData?.growth} />

      {/* Realtime bar */}
      {realtimeData && (
        <div className="flex flex-wrap items-center gap-5 border-[0.5px] border-white/6 bg-white/1 rounded-sm px-4 py-3 text-xs">
          <div className="flex items-center gap-2 text-emerald-400 font-medium text-[10px] uppercase tracking-[0.18em]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            Live
          </div>
          <div className="flex flex-wrap gap-5 text-white/35">
            {[
              { label: 'impressions', value: realtimeData.impressions ?? 0 },
              { label: 'engagements', value: realtimeData.engagement  ?? 0 },
              { label: 'reach',       value: realtimeData.reach       ?? 0 },
              { label: 'clicks',      value: realtimeData.clicks      ?? 0 },
            ].map(({ label, value }) => (
              <span key={label}>
                <span className="font-mono font-medium text-white/70 tabular-nums">
                  {value.toLocaleString('en-AU')}
                </span>{' '}
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Anomaly + Sentiment (full-width) */}
      <AnomalyAlerts />
      <SentimentAnalysis />

      {/* Engagement + Platform distribution */}
      <div className="grid gap-5 lg:grid-cols-2">
        <EngagementChart data={chartEngagementData} />
        {chartPlatformDistribution.length === 0 ? (
          <div className="border-[0.5px] border-white/6 bg-white/1.5 rounded-sm p-5 flex items-center justify-center">
            <p className="text-xs text-white/25">No platform data yet</p>
          </div>
        ) : (
          <PlatformChart data={chartPlatformDistribution} />
        )}
      </div>

      {/* Radar — full width */}
      <PerformanceChart data={chartPerformanceData} />

      {/* Growth + Top posts */}
      <div className="grid gap-5 lg:grid-cols-2">
        <GrowthChart data={chartGrowthData} collectingFollowerData={collectingFollowerData} />
        <TopPosts
          posts={chartTopPosts}
          onViewDetails={handleViewPostDetails}
          onViewAll={handleViewAllPosts}
        />
      </div>

      {/* Content perf + Trend predictions */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ContentPerformanceWidget />
        <TrendPredictionsWidget />
      </div>

      {/* Detailed metrics table */}
      <MetricsTable
        data={overviewTableData}
        engagementData={engagementTableData}
        contentData={contentTableData}
      />

      {/* Report presets */}
      <ReportPresetsPanel />

      {/* Post detail sheet */}
      <PostDetailSheet
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        post={selectedPost}
      />
    </div>
  );
}
