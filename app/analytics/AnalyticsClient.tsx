'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { SkeletonChart } from '@/components/ui/skeleton';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Heart,
  Award,
  Target,
  Zap,
  BarChart3,
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  Video,
} from '@/components/icons';
import { toast } from 'sonner';

const EngagementTrendsChart = dynamic(
  () => import('@/components/analytics/EngagementTrendsChart'),
  { loading: () => <SkeletonChart />, ssr: false }
);

const PlatformDistributionChart = dynamic(
  () => import('@/components/analytics/PlatformDistributionChart'),
  { loading: () => <SkeletonChart />, ssr: false }
);

const PLATFORM_ICONS = {
  twitter: Twitter,
  linkedin: Linkedin,
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Video,
};

const PLATFORM_COLORS = {
  twitter: '#1DA1F2',
  linkedin: '#0077B5',
  instagram: '#E4405F',
  facebook: '#1877F2',
  tiktok: '#000000',
};

function formatNumber(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString()
    : '0';
}

/** Platform breakdown item */
interface PlatformBreakdown {
  platform: string;
  posts: number;
  engagement?: number;
  impressions?: number;
  clicks?: number;
}

/** Top content item */
interface TopContent {
  platform: string;
  content: string;
  engagement?: number;
  viralScore?: number;
  impressions?: number;
  publishedAt?: string;
}

/** Engagement data point */
interface EngagementDataPoint {
  date: string;
  likes: number;
  shares: number;
  comments: number;
}

/** Dashboard data from API */
interface DashboardData {
  overview: {
    totalPosts?: number;
    totalEngagement: number;
    averageEngagementRate?: number;
    avgEngagementRate?: number;
    contentGenerated?: number;
    postCount?: number;
    totalImpressions?: number;
    trend?: number;
  };
  platformBreakdown: PlatformBreakdown[];
  topContent: TopContent[];
  engagementData?: EngagementDataPoint[];
  engagementTrends?: Array<{ date: string; value: number }>;
  platformDistribution?: Array<{ name: string; value: number }>;
  trends?: {
    postsThisWeek: number;
    postsLastWeek: number;
    growthRate: number;
    trending: string;
  };
  recentActivity?: Array<{
    id: string;
    content: string;
    platform: string;
    status: string;
    createdAt: Date;
  }>;
}

export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null
  );
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [dateRange, setDateRange] = useState('7d');
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/analytics?type=dashboard&platform=${selectedPlatform}&range=${dateRange}`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load analytics');
      }

      const data = await response.json();
      setDashboardData(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Failed to load analytics data');
      // No invented figures: the page shows its empty state instead.
      setDashboardData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedPlatform, dateRange]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const refreshData = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
    toast.success('Analytics refreshed');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 animate-pulse mx-auto mb-4" />
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  const { overview, trends, platformBreakdown, engagementData, topContent } =
    dashboardData || {};

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Analytics Dashboard
            </h1>
            <p className="text-gray-400">
              Track your social media performance and engagement
            </p>
          </div>
          <div className="flex gap-3">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={refreshData} disabled={refreshing}>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Total Posts
                </CardTitle>
                <Activity className="h-4 w-4 text-gray-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {overview?.totalPosts ?? 0}
              </div>
              <div className="flex items-center mt-2">
                {trends?.trending === 'up' ? (
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                )}
                <span
                  className={`text-sm ${trends?.trending === 'up' ? 'text-green-500' : 'text-red-500'}`}
                >
                  {trends?.growthRate ?? 0}%
                </span>
                <span className="text-sm text-gray-500 ml-1">vs last week</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Total Engagement
                </CardTitle>
                <Heart className="h-4 w-4 text-gray-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {overview?.totalEngagement?.toLocaleString() ?? 0}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Likes, shares & comments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Engagement Rate
                </CardTitle>
                <Target className="h-4 w-4 text-gray-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {overview?.averageEngagementRate ?? 0}%
              </div>
              <Progress
                value={(overview?.averageEngagementRate ?? 0) * 10}
                className="mt-2"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  AI Content
                </CardTitle>
                <Zap className="h-4 w-4 text-gray-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {overview?.contentGenerated ?? 0}
              </div>
              <p className="text-sm text-gray-500 mt-2">Generated this month</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="engagement" className="space-y-6">
          <TabsList>
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
            <TabsTrigger value="platforms">Platforms</TabsTrigger>
            <TabsTrigger value="content">Top Content</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          {/* Engagement Tab */}
          <TabsContent value="engagement" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Engagement Trends</CardTitle>
                <CardDescription>
                  Daily engagement metrics over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EngagementTrendsChart data={engagementData || []} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Platforms Tab */}
          <TabsContent value="platforms" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Platform Distribution</CardTitle>
                <CardDescription>
                  Posts across different social media platforms
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PlatformDistributionChart data={platformBreakdown || []} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {platformBreakdown?.map(platform => {
                const Icon =
                  PLATFORM_ICONS[
                    platform.platform as keyof typeof PLATFORM_ICONS
                  ] || Activity;
                const color =
                  PLATFORM_COLORS[
                    platform.platform as keyof typeof PLATFORM_COLORS
                  ] || '#666';

                return (
                  <Card key={platform.platform}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-5 w-5" style={{ color }} />
                          <CardTitle className="text-sm font-medium capitalize">
                            {platform.platform}
                          </CardTitle>
                        </div>
                        <Badge variant="secondary">
                          {platform.posts} posts
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Progress
                        value={
                          overview?.totalPosts
                            ? (platform.posts / overview.totalPosts) * 100
                            : 0
                        }
                        className="h-2"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        {overview?.totalPosts
                          ? (
                              (platform.posts / overview.totalPosts) *
                              100
                            ).toFixed(1)
                          : 0}
                        % of total
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Top Content Tab */}
          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Content</CardTitle>
                <CardDescription>
                  Your best posts based on engagement
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topContent?.map((content, index) => {
                    const Icon =
                      PLATFORM_ICONS[
                        content.platform as keyof typeof PLATFORM_ICONS
                      ] || Activity;

                    return (
                      <div key={index} className="p-4 bg-gray-800 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center w-8 h-8 bg-gray-700 rounded-full">
                              <span className="text-sm font-bold">
                                #{index + 1}
                              </span>
                            </div>
                            <Icon className="h-4 w-4" />
                            <Badge variant="secondary" className="capitalize">
                              {content.platform}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Award className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm">
                              Viral Score: {content.viralScore}/10
                            </span>
                          </div>
                        </div>
                        <p className="text-sm mb-2">{content.content}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>
                            {formatNumber(content.engagement)} engagements
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Insights Tab */}
          <TabsContent value="insights" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Key Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="p-3 bg-green-900/20 border border-green-500/20 rounded">
                      <p className="text-sm">
                        <strong>Growth Trend:</strong> Your engagement has
                        increased by {trends?.growthRate ?? 0}% this week
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
