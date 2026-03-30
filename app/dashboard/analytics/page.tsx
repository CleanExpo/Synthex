'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { DateRange } from 'react-day-picker';
import { AnalyticsSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
import {
  usePerformanceAnalytics,
  useRealtimeAnalytics,
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

// Dynamic imports for heavy chart components (Recharts ~80KB)
const EngagementChart = dynamic(
  () =>
    import('@/components/analytics').then(m => ({
      default: m.EngagementChart,
    })),
  { ssr: false }
);
const PlatformChart = dynamic(
  () =>
    import('@/components/analytics').then(m => ({ default: m.PlatformChart })),
  { ssr: false }
);
const PerformanceChart = dynamic(
  () =>
    import('@/components/analytics').then(m => ({
      default: m.PerformanceChart,
    })),
  { ssr: false }
);
const GrowthChart = dynamic(
  () =>
    import('@/components/analytics').then(m => ({ default: m.GrowthChart })),
  { ssr: false }
);
const TopPosts = dynamic(
  () => import('@/components/analytics').then(m => ({ default: m.TopPosts })),
  { ssr: false }
);
const MetricsTable = dynamic(
  () =>
    import('@/components/analytics').then(m => ({ default: m.MetricsTable })),
  { ssr: false }
);
const AnomalyAlerts = dynamic(
  () =>
    import('@/components/analytics/AnomalyAlerts').then(m => ({
      default: m.AnomalyAlerts,
    })),
  { ssr: false }
);
const ContentPerformanceWidget = dynamic(
  () =>
    import('@/components/analytics/ContentPerformanceWidget').then(m => ({
      default: m.ContentPerformanceWidget,
    })),
  { ssr: false }
);
const SentimentAnalysis = dynamic(
  () =>
    import('@/components/SentimentAnalysis').then(m => ({
      default: m.SentimentAnalysis,
    })),
  { ssr: false }
);
const TrendPredictionsWidget = dynamic(
  () =>
    import('@/components/analytics/TrendPredictionsWidget').then(m => ({
      default: m.TrendPredictionsWidget,
    })),
  { ssr: false }
);
const ReportPresetsPanel = dynamic(
  () =>
    import('@/components/analytics/ReportPresetsPanel').then(m => ({
      default: m.ReportPresetsPanel,
    })),
  { ssr: false }
);

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('30d');
  const [platform, setPlatform] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedPost, setSelectedPost] = useState<TopPostDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Derive startDate/endDate ISO strings when custom range is active
  const startDate =
    timeRange === 'custom' && dateRange?.from
      ? dateRange.from.toISOString()
      : undefined;
  const endDate =
    timeRange === 'custom' && dateRange?.to
      ? dateRange.to.toISOString()
      : undefined;

  const {
    data: responseData,
    isLoading,
    error,
    refetch,
  } = usePerformanceAnalytics({
    period: timeRange,
    platform,
    granularity: 'day',
    startDate,
    endDate,
  });

  const performanceData = responseData?.data;

  // Realtime stats — polls /api/analytics/realtime every 30s
  const { data: realtimeData } = useRealtimeAnalytics();

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
  const displayData: DisplayData = useMemo(
    () => ({
      reach: performanceData?.overview?.totalReach ?? 0,
      engagement: performanceData?.overview?.totalEngagement ?? 0,
      engagementRate: performanceData?.overview?.averageEngagementRate ?? 0,
      followerGrowth: 0,
      growth: performanceData?.growth,
    }),
    [performanceData]
  );

  // Transform platform data for pie chart (from performance API platforms array)
  const chartPlatformDistribution = useMemo(() => {
    if (!performanceData?.platforms || performanceData.platforms.length === 0) {
      return [];
    }
    const total = performanceData.platforms.reduce(
      (sum, p) => sum + p.posts,
      0
    );
    return performanceData.platforms.map(p => ({
      name: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
      value: total > 0 ? Math.round((p.posts / total) * 100) : 0,
      color: platformColors[p.platform] ?? '#ffb87b',
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
    return performanceData.platforms.map(p => ({
      type: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
      engagement: p.engagement,
      reach: p.engagementRate, // engagementRate maps to reach axis (0-100 scale)
      clicks: p.posts,
    }));
  }, [performanceData?.platforms]);

  // Compute overviewData for MetricsTable Overview tab from platforms
  const overviewTableData = useMemo(() => {
    if (!performanceData?.platforms || performanceData.platforms.length === 0) {
      return undefined;
    }
    return performanceData.platforms.map(p => ({
      platform: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
      followers: 0, // Not available from performance API
      posts: p.posts,
      engagement: p.engagementRate,
      reach: p.engagement, // Total engagement as proxy for reach
      growth: 0, // Not available from performance API without period comparison
    }));
  }, [performanceData?.platforms]);

  // Compute engagementData for MetricsTable Engagement tab
  // API does not provide likes/comments/shares breakdown; derive proportionally
  const engagementTableData = useMemo(() => {
    if (!performanceData?.platforms || performanceData.platforms.length === 0) {
      return undefined;
    }
    return performanceData.platforms.map(p => ({
      platform: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
      likes: Math.round(p.engagement * 0.6),
      comments: Math.round(p.engagement * 0.25),
      shares: Math.round(p.engagement * 0.15),
      total: p.engagement,
    }));
  }, [performanceData?.platforms]);

  // Compute contentData for MetricsTable Content tab
  const contentTableData = useMemo(() => {
    if (!performanceData?.platforms || performanceData.platforms.length === 0) {
      return undefined;
    }
    return performanceData.platforms.map(p => ({
      platform: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
      topPosts: p.posts,
      avgEngagementRate: p.engagementRate,
      bestTime: p.bestTime || '\u2014',
    }));
  }, [performanceData?.platforms]);

  const isExportingRef = useRef(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(
    async (format: ExportFormat = 'csv') => {
      if (isExportingRef.current) return;
      isExportingRef.current = true;
      setIsExporting(true);

      try {
        const params = new URLSearchParams({ format });
        if (timeRange !== 'custom') {
          params.set('period', timeRange);
        }
        if (platform !== 'all') {
          params.set('platforms', platform);
        }
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);

        const res = await fetch(`/api/analytics/export?${params.toString()}`, {
          credentials: 'include',
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            (errData as { message?: string }).message ??
              `Export failed (${res.status})`
          );
        }

        const blob = await res.blob();
        const contentDisposition = res.headers.get('Content-Disposition') ?? '';
        const filenameMatch = contentDisposition.match(/filename="(.+?)"/);
        const filename =
          filenameMatch?.[1] ?? `analytics-${timeRange}.${format}`;

        const objectUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename;
        anchor.click();
        window.URL.revokeObjectURL(objectUrl);
      } catch (err) {
        console.error('Analytics export error:', err);
      } finally {
        isExportingRef.current = false;
        setIsExporting(false);
      }
    },
    [timeRange, platform, startDate, endDate]
  );

  const handleViewPostDetails = useCallback(
    (postIndex: number) => {
      const topContent = performanceData?.topContent;
      if (!topContent) return;
      // postIndex is 1-based (from transformTopContent's index + 1)
      const rawPost = topContent[postIndex - 1];
      if (!rawPost) return;
      setSelectedPost({
        id: rawPost.id,
        content: rawPost.content,
        platform: rawPost.platform,
        engagement: rawPost.engagement,
        engagementRate: rawPost.engagementRate,
        publishedAt: rawPost.publishedAt,
      });
      setIsDetailOpen(true);
    },
    [performanceData?.topContent]
  );

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
      <div className="flex items-start justify-between gap-3">
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
        <HelpVideo videoId="feature-tour-analytics" />
      </div>

      <AnalyticsStats data={displayData} growth={performanceData?.growth} />

      {/* Realtime stats bar — polls /api/analytics/realtime every 30s */}
      {realtimeData && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            LIVE
          </div>
          <div className="flex flex-wrap gap-4 text-slate-400">
            <span>
              <span className="text-white font-medium">
                {realtimeData.impressions.toLocaleString('en-AU')}
              </span>{' '}
              impressions
            </span>
            <span>
              <span className="text-white font-medium">
                {realtimeData.engagement.toLocaleString('en-AU')}
              </span>{' '}
              engagements
            </span>
            <span>
              <span className="text-white font-medium">
                {realtimeData.reach.toLocaleString('en-AU')}
              </span>{' '}
              reach
            </span>
            <span>
              <span className="text-white font-medium">
                {realtimeData.clicks.toLocaleString('en-AU')}
              </span>{' '}
              clicks
            </span>
          </div>
        </div>
      )}

      <AnomalyAlerts />
      <SentimentAnalysis />

      <div className="grid gap-6 lg:grid-cols-2">
        <EngagementChart data={chartEngagementData} />
        {chartPlatformDistribution.length === 0 ? (
          <p className="text-white/40 text-sm text-center py-8">
            No platform data yet
          </p>
        ) : (
          <PlatformChart data={chartPlatformDistribution} />
        )}
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

      <div className="grid gap-6 lg:grid-cols-2">
        <ContentPerformanceWidget />
        <TrendPredictionsWidget />
      </div>

      <MetricsTable
        data={overviewTableData}
        engagementData={engagementTableData}
        contentData={contentTableData}
      />

      <ReportPresetsPanel />

      <PostDetailSheet
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        post={selectedPost}
      />
    </div>
  );
}
