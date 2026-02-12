'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { AnalyticsSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';

import {
  type AnalyticsData,
  type DisplayData,
  contentPerformance,
  growthData,
  topPosts,
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

        if (token) {
          const response = await fetch(`/api/analytics?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });

          if (response.ok) {
            const { data } = await response.json();
            setAnalyticsData(data);
            setIsLoading(false);
            return;
          }
        }

        setAnalyticsData(null);
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

      if (token) {
        const response = await fetch(`/api/analytics?${params.toString()}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (response.ok) {
          const { data } = await response.json();
          setAnalyticsData(data);
          setIsLoading(false);
          return;
        }
      }
      setAnalyticsData(null);
      setIsLoading(false);
    } catch {
      setError('Failed to load analytics data');
      setIsLoading(false);
    }
  }, [timeRange, platform]);

  // Use real data if available, otherwise fall back to mock
  const displayData: DisplayData = useMemo(() => ({
    reach: analyticsData?.totals?.reach ?? 2400000,
    engagement: analyticsData?.totals?.engagement ?? 184500,
    engagementRate: analyticsData?.totals?.engagementRate ?? 7.8,
    followerGrowth: 12400,
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

      <PerformanceChart data={contentPerformance} />

      <div className="grid gap-6 lg:grid-cols-2">
        <GrowthChart data={growthData} />
        <TopPosts
          posts={topPosts}
          onViewDetails={handleViewPostDetails}
          onViewAll={handleViewAllPosts}
        />
      </div>

      <MetricsTable />
    </div>
  );
}
