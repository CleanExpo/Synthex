'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { AnalyticsSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';

import {
  type AnalyticsData,
  type DisplayData,
  type ContentPerformanceItem,
  type GrowthDataPoint,
  type TopPost,
  transformPlatformData,
  transformChartData,
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
  const [timeRange, setTimeRange] = useState('7d');
  const [platform, setPlatform] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);

  const getAuthToken = () => {
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || localStorage.getItem('token');
  };

  useEffect(() => {
    const loadAnalytics = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = getAuthToken();
        const params = new URLSearchParams({ timeRange });
        if (platform !== 'all') {
          params.append('platform', platform);
        }

        // Always attempt fetch with credentials: 'include' for httpOnly cookie auth
        {
          const response = await fetch(`/api/analytics?${params.toString()}`, {
            credentials: 'include',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          });

          if (response.ok) {
            const { data } = await response.json();
            setAnalyticsData(data);
            setIsLoading(false);
            return;
          }
        }

        setError('Failed to load analytics data');
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading analytics:', err);
        setError('Failed to load analytics data');
        setIsLoading(false);
      }
    };
    loadAnalytics();
  }, [timeRange, platform]);

  const handleRetry = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const token = getAuthToken();
      const params = new URLSearchParams({ timeRange });
      if (platform !== 'all') {
        params.append('platform', platform);
      }

      {
        const response = await fetch(`/api/analytics?${params.toString()}`, {
          credentials: 'include',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });

        if (response.ok) {
          const { data } = await response.json();
          setAnalyticsData(data);
          setIsLoading(false);
          return;
        }
      }
      setError('Failed to load analytics data');
      setIsLoading(false);
    } catch {
      setError('Failed to load analytics data');
      setIsLoading(false);
    }
  }, [timeRange, platform]);

  // Use real data if available, otherwise show zeros
  const displayData: DisplayData = useMemo(() => ({
    reach: analyticsData?.totals?.reach ?? 0,
    engagement: analyticsData?.totals?.engagement ?? 0,
    engagementRate: analyticsData?.totals?.engagementRate ?? 0,
    followerGrowth: 0,
  }), [analyticsData]);

  // Transform API data for charts
  const chartPlatformDistribution = useMemo(
    () => transformPlatformData(analyticsData?.platformBreakdown),
    [analyticsData?.platformBreakdown]
  );

  const chartEngagementData = useMemo(
    () => transformChartData(analyticsData?.chartData, analyticsData?.platformBreakdown),
    [analyticsData?.chartData, analyticsData?.platformBreakdown]
  );

  const handleFilter = useCallback(() => {
    alert('Filter options coming soon');
  }, []);

  const handleExport = useCallback(() => {
    const exportData = {
      analyticsData: analyticsData || null,
      engagementData: chartEngagementData,
      platformDistribution: chartPlatformDistribution,
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
  }, [analyticsData, chartEngagementData, chartPlatformDistribution, timeRange]);

  const handleViewPostDetails = useCallback((postId: number) => {
    alert(`Viewing details for post ${postId}`);
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
          message={error}
          onRetry={handleRetry}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnalyticsHeader
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        onFilter={handleFilter}
        onExport={handleExport}
      />

      <AnalyticsStats data={displayData} />

      <div className="grid gap-6 lg:grid-cols-2">
        <EngagementChart data={chartEngagementData} />
        <PlatformChart data={chartPlatformDistribution} />
      </div>

      <PerformanceChart data={[] as ContentPerformanceItem[]} />

      <div className="grid gap-6 lg:grid-cols-2">
        <GrowthChart data={[] as GrowthDataPoint[]} />
        <TopPosts
          posts={[] as TopPost[]}
          onViewDetails={handleViewPostDetails}
          onViewAll={handleViewAllPosts}
        />
      </div>

      <MetricsTable />
    </div>
  );
}
