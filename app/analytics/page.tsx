'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { SkeletonChart } from '@/components/ui/skeleton';
import { 
  TrendingUp, TrendingDown, Activity,
  Heart, Share2, MessageCircle, MousePointer,
  Clock, Award, Target, Zap, BarChart3,
  Twitter, Linkedin, Instagram, Facebook, Video
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
  tiktok: Video
};

const PLATFORM_COLORS = {
  twitter: '#1DA1F2',
  linkedin: '#0077B5',
  instagram: '#E4405F',
  facebook: '#1877F2',
  tiktok: '#000000'
};

export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [dateRange, setDateRange] = useState('7d');
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/analytics?type=dashboard&userId=demo-user-001&platform=${selectedPlatform}&range=${dateRange}`,
        {
          credentials: 'include'
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
      // Set demo data
      setDashboardData(getDemoData());
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

  const getDemoData = () => ({
    overview: {
      totalPosts: 247,
      totalEngagement: 15420,
      averageEngagementRate: 3.8,
      contentGenerated: 89
    },
    recentActivity: [
      { id: '1', content: 'AI is transforming marketing...', platform: 'twitter', status: 'published', createdAt: new Date() },
      { id: '2', content: 'Check out our latest insights...', platform: 'linkedin', status: 'published', createdAt: new Date() }
    ],
    platformBreakdown: [
      { platform: 'twitter', posts: 89 },
      { platform: 'linkedin', posts: 67 },
      { platform: 'instagram', posts: 45 },
      { platform: 'facebook', posts: 31 },
      { platform: 'tiktok', posts: 15 }
    ],
    trends: {
      postsThisWeek: 32,
      postsLastWeek: 28,
      growthRate: 14.3,
      trending: 'up'
    },
    engagementData: [
      { date: 'Mon', likes: 145, shares: 89, comments: 34 },
      { date: 'Tue', likes: 167, shares: 92, comments: 41 },
      { date: 'Wed', likes: 189, shares: 103, comments: 47 },
      { date: 'Thu', likes: 203, shares: 98, comments: 52 },
      { date: 'Fri', likes: 234, shares: 112, comments: 58 },
      { date: 'Sat', likes: 198, shares: 95, comments: 43 },
      { date: 'Sun', likes: 176, shares: 87, comments: 39 }
    ],
    topContent: [
      { content: '🚀 AI is revolutionizing...', engagement: 1234, platform: 'twitter', viralScore: 8.5 },
      { content: 'Three lessons from implementing...', engagement: 987, platform: 'linkedin', viralScore: 7.8 },
      { content: '✨ Transform your marketing...', engagement: 856, platform: 'instagram', viralScore: 7.2 }
    ]
  });

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

  const { overview, trends, platformBreakdown, engagementData, topContent } = dashboardData;

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Analytics Dashboard</h1>
            <p className="text-gray-400">Track your social media performance and engagement</p>
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
                <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
                <Activity className="h-4 w-4 text-gray-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.totalPosts}</div>
              <div className="flex items-center mt-2">
                {trends.trending === 'up' ? (
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                )}
                <span className={`text-sm ${trends.trending === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                  {trends.growthRate}%
                </span>
                <span className="text-sm text-gray-500 ml-1">vs last week</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Total Engagement</CardTitle>
                <Heart className="h-4 w-4 text-gray-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.totalEngagement.toLocaleString()}</div>
              <p className="text-sm text-gray-500 mt-2">
                Likes, shares & comments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
                <Target className="h-4 w-4 text-gray-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.averageEngagementRate}%</div>
              <Progress value={overview.averageEngagementRate * 10} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">AI Content</CardTitle>
                <Zap className="h-4 w-4 text-gray-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.contentGenerated}</div>
              <p className="text-sm text-gray-500 mt-2">
                Generated this month
              </p>
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
                <CardDescription>Daily engagement metrics over time</CardDescription>
              </CardHeader>
              <CardContent>
                <EngagementTrendsChart data={engagementData || []} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Engagement Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Heart className="h-4 w-4 text-red-500" />
                        <span>Likes</span>
                      </div>
                      <span className="font-bold">8,234</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Share2 className="h-4 w-4 text-blue-500" />
                        <span>Shares</span>
                      </div>
                      <span className="font-bold">4,821</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-green-500" />
                        <span>Comments</span>
                      </div>
                      <span className="font-bold">2,365</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MousePointer className="h-4 w-4 text-purple-500" />
                        <span>Clicks</span>
                      </div>
                      <span className="font-bold">12,456</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Best Posting Times</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>9:00 AM</span>
                      </div>
                      <Badge>High Engagement</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>12:00 PM</span>
                      </div>
                      <Badge>Peak Time</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>6:00 PM</span>
                      </div>
                      <Badge>Good Reach</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Platforms Tab */}
          <TabsContent value="platforms" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Platform Distribution</CardTitle>
                <CardDescription>Posts across different social media platforms</CardDescription>
              </CardHeader>
              <CardContent>
                <PlatformDistributionChart data={platformBreakdown || []} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {platformBreakdown?.map((platform: any) => {
                const Icon = PLATFORM_ICONS[platform.platform as keyof typeof PLATFORM_ICONS] || Activity;
                const color = PLATFORM_COLORS[platform.platform as keyof typeof PLATFORM_COLORS] || '#666';
                
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
                        <Badge variant="secondary">{platform.posts} posts</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Progress 
                        value={(platform.posts / overview.totalPosts) * 100} 
                        className="h-2"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        {((platform.posts / overview.totalPosts) * 100).toFixed(1)}% of total
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
                <CardDescription>Your best posts based on engagement</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topContent?.map((content: any, index: number) => {
                    const Icon = PLATFORM_ICONS[content.platform as keyof typeof PLATFORM_ICONS] || Activity;
                    
                    return (
                      <div key={index} className="p-4 bg-gray-800 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center w-8 h-8 bg-gray-700 rounded-full">
                              <span className="text-sm font-bold">#{index + 1}</span>
                            </div>
                            <Icon className="h-4 w-4" />
                            <Badge variant="secondary" className="capitalize">{content.platform}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Award className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm">Viral Score: {content.viralScore}/10</span>
                          </div>
                        </div>
                        <p className="text-sm mb-2">{content.content}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{content.engagement.toLocaleString()} engagements</span>
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
                        <strong>Growth Trend:</strong> Your engagement has increased by {trends.growthRate}% this week
                      </p>
                    </div>
                    <div className="p-3 bg-blue-900/20 border border-blue-500/20 rounded">
                      <p className="text-sm">
                        <strong>Best Platform:</strong> Twitter is generating the highest engagement
                      </p>
                    </div>
                    <div className="p-3 bg-purple-900/20 border border-purple-500/20 rounded">
                      <p className="text-sm">
                        <strong>Optimal Time:</strong> Posts at 9 AM get 45% more engagement
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <span className="text-green-500">✓</span>
                      <p className="text-sm">Post more content on Twitter for maximum reach</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-500">✓</span>
                      <p className="text-sm">Schedule posts for 9 AM and 6 PM</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-500">✓</span>
                      <p className="text-sm">Use more visual content on Instagram</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-500">✓</span>
                      <p className="text-sm">Increase posting frequency on LinkedIn</p>
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
