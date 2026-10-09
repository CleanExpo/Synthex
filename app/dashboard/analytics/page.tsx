'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DateRange } from 'react-day-picker';
import { AnalyticsSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
import { PageHeader } from '@/components/dashboard/page-header';
import {
  usePerformanceAnalytics,
  useRealtimeAnalytics,
  useFollowerGrowth,
} from '@/hooks/use-dashboard';
import { FIRST_WEEK_GUIDANCE } from '@/lib/dashboard/first-week-guidance';
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

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState('30d');
  const [platform, setPlatform] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedPost, setSelectedPost] = useState<TopPostDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

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
  const { data: realtimeData } = useRealtimeAnalytics();
  const { data: followerGrowthData } = useFollowerGrowth({
    period: timeRange,
    platform,
  });

  const handleRetry = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleTimeRangeChange = useCallback((value: string) => {
    setTimeRange(value);
    if (value !== 'custom') setDateRange(undefined);
  }, []);

  const displayData: DisplayData = useMemo(
    () => ({
      reach: performanceData?.overview?.totalReach ?? 0,
      engagement: performanceData?.overview?.totalEngagement ?? 0,
      engagementRate: performanceData?.overview?.averageEngagementRate ?? 0,
      followerGrowth: followerGrowthData?.growth?.current ?? 0,
      followerChangePercent: followerGrowthData?.growth?.changePercent ?? 0,
      followerDataCollecting: followerGrowthData
        ? !followerGrowthData.hasEnoughData
        : true,
      growth: performanceData?.growth,
    }),
    [performanceData, followerGrowthData]
  );

  const chartPlatformDistribution = useMemo(() => {
    if (!performanceData?.platforms?.length) return [];
    const byEngagement = performanceData.platforms.reduce(
      (s, p) => s + p.engagement,
      0
    );
    const byPosts = performanceData.platforms.reduce((s, p) => s + p.posts, 0);
    const total = byEngagement > 0 ? byEngagement : byPosts;
    return performanceData.platforms.map(p => ({
      name: titleCase(p.platform),
      value:
        total > 0
          ? Math.round(
              ((byEngagement > 0 ? p.engagement : p.posts) / total) * 100
            )
          : 0,
      color: platformColors[p.platform] ?? 'rgb(249 115 22)',
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
        month: new Date(pt.date).toLocaleDateString('en-AU', {
          month: 'short',
          day: 'numeric',
        }),
        followers: pt.followers,
        engagement: engByDay.get(pt.date) ?? 0,
      }));
    }
    return transformTimelineToGrowth(performanceData?.timeline).map(p => ({
      ...p,
      followers: 0,
    }));
  }, [followerGrowthData?.series, performanceData?.timeline]);

  const collectingFollowerData = followerGrowthData
    ? !followerGrowthData.hasEnoughData
    : true;

  const chartTopPosts = useMemo(
    () => transformTopContent(performanceData?.topContent),
    [performanceData?.topContent]
  );

  const overviewTableData = useMemo(() => {
    if (!performanceData?.platforms?.length) return undefined;
    return performanceData.platforms.map(p => ({
      platform: titleCase(p.platform),
      followers: 0,
      posts: p.posts,
      engagement: p.engagementRate,
      reach: p.reach ?? 0,
      growth: p.growthPercent ?? 0,
    }));
  }, [performanceData?.platforms]);

  const engagementTableData = useMemo(() => {
    if (!performanceData?.platforms?.length) return undefined;
    return performanceData.platforms.map(p => ({
      platform: titleCase(p.platform),
      likes: p.likes ?? 0,
      comments: p.comments ?? 0,
      shares: p.shares ?? 0,
      total: p.engagement,
    }));
  }, [performanceData?.platforms]);

  const contentTableData = useMemo(() => {
    if (!performanceData?.platforms?.length) return undefined;
    return performanceData.platforms.map(p => ({
      platform: titleCase(p.platform),
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
        if (timeRange !== 'custom') params.set('period', timeRange);
        if (platform !== 'all') params.set('platforms', platform);
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);

        const res = await fetch(`/api/analytics/export?${params}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(
            (e as { message?: string }).message ??
              `Export failed (${res.status})`
          );
        }
        const blob = await res.blob();
        const cd = res.headers.get('Content-Disposition') ?? '';
        const filename =
          cd.match(/filename="(.+?)"/)?.[1] ??
          `analytics-${timeRange}.${format}`;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
      } finally {
        isExportingRef.current = false;
        setIsExporting(false);
      }
    },
    [timeRange, platform, startDate, endDate]
  );

  const handleViewPostDetails = useCallback(
    (postIndex: number) => {
      const raw = performanceData?.topContent?.[postIndex - 1];
      if (!raw) return;
      setSelectedPost({
        id: raw.id,
        content: raw.content,
        platform: raw.platform,
        engagement: raw.engagement,
        engagementRate: raw.engagementRate,
        publishedAt: raw.publishedAt,
      });
      setIsDetailOpen(true);
    },
    [performanceData?.topContent]
  );

  const handleViewAllPosts = useCallback(() => {
    router.push('/dashboard/content');
  }, [router]);

  const liveEvents = realtimeData?.impressions ?? 0;
  const noPublishedSignal =
    (performanceData?.overview?.totalReach ?? 0) === 0 &&
    (performanceData?.overview?.totalEngagement ?? 0) === 0 &&
    !(performanceData?.topContent && performanceData.topContent.length > 0) &&
    (performanceData?.overview?.totalPosts ?? 0) === 0;

  if (isLoading) return <AnalyticsSkeleton />;

  if (error) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Measure"
          title="Analytics"
          description={`${FIRST_WEEK_GUIDANCE.analytics.what} ${FIRST_WEEK_GUIDANCE.analytics.why}`}
        />
        <APIErrorCard
          title="Analytics could not load"
          message={error.message}
          onRetry={handleRetry}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Measure"
        title="Analytics"
        description={`${FIRST_WEEK_GUIDANCE.analytics.what} ${FIRST_WEEK_GUIDANCE.analytics.why}`}
      />

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

      {noPublishedSignal ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-12 text-center">
          <h2 className="text-lg font-light text-white">
            Nothing published in this window
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/40">
            {FIRST_WEEK_GUIDANCE.analytics.empty}
          </p>
          <Link
            href={FIRST_WEEK_GUIDANCE.analytics.nextHref}
            className="mt-4 inline-block text-sm text-orange-400 hover:text-orange-300"
          >
            {FIRST_WEEK_GUIDANCE.analytics.nextLabel}
          </Link>
        </div>
      ) : (
        <>
          <AnalyticsStats data={displayData} growth={performanceData?.growth} />

          {liveEvents > 0 && (
            <div className="flex flex-wrap items-center gap-5 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-xs">
              <span className="uppercase tracking-[0.18em] text-emerald-400">
                Last 24 hours
              </span>
              <span className="text-white/45">
                <span className="font-medium tabular-nums text-white/80">
                  {liveEvents.toLocaleString('en-AU')}
                </span>{' '}
                events
              </span>
              <span className="text-white/45">
                <span className="font-medium tabular-nums text-white/80">
                  {(realtimeData?.engagement ?? 0).toLocaleString('en-AU')}
                </span>{' '}
                engagements
              </span>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <EngagementChart data={chartEngagementData} />
            {chartPlatformDistribution.length === 0 ? (
              <div className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-5">
                <p className="text-xs text-white/35">No platform split yet</p>
              </div>
            ) : (
              <PlatformChart data={chartPlatformDistribution} />
            )}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <GrowthChart
              data={chartGrowthData}
              collectingFollowerData={collectingFollowerData}
            />
            <TopPosts
              posts={chartTopPosts}
              onViewDetails={handleViewPostDetails}
              onViewAll={handleViewAllPosts}
            />
          </div>

          <MetricsTable
            data={overviewTableData}
            engagementData={engagementTableData}
            contentData={contentTableData}
          />
        </>
      )}

      <PostDetailSheet
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        post={selectedPost}
      />
    </div>
  );
}
