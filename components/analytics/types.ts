/**
 * Analytics Types
 * Type definitions for analytics dashboard
 */

export interface AnalyticsData {
  totals: {
    posts: number;
    published: number;
    scheduled: number;
    draft: number;
    reach: number;
    engagement: number;
    impressions: number;
    clicks: number;
    engagementRate: number;
  };
  platformBreakdown: Record<string, { posts: number; published: number }>;
  chartData: Array<{ date: string; posts: number }>;
  recentActivity: Array<{ endpoint: string; status: string; createdAt: string }>;
}

export interface GrowthData {
  engagementChange: number;
  reachChange: number;
  postsChange: number;
  trend: 'up' | 'down' | 'stable';
}

export interface PerformanceData {
  overview: {
    totalPosts: number;
    totalEngagement: number;
    averageEngagementRate: number;
    totalReach: number;
    totalImpressions: number;
  };
  growth: GrowthData;
  timeline: Array<{
    date: string;
    engagement: number;
    reach: number;
    impressions: number;
    posts: number;
  }>;
  platforms: Array<{
    platform: string;
    engagement: number;
    engagementRate: number;
    posts: number;
    bestTime: string;
  }>;
  topContent: Array<{
    id: string;
    content: string;
    platform: string;
    engagement: number;
    engagementRate: number;
    publishedAt: Date | string;
  }>;
}

export interface DisplayData {
  reach: number;
  engagement: number;
  engagementRate: number;
  followerGrowth: number;
  growth?: GrowthData;
}

export interface EngagementDataPoint {
  date: string;
  twitter: number;
  linkedin: number;
  instagram: number;
  tiktok: number;
}

export interface PlatformDistributionItem {
  name: string;
  value: number;
  color: string;
}

export interface ContentPerformanceItem {
  type: string;
  engagement: number;
  reach: number;
  clicks: number;
}

export interface GrowthDataPoint {
  month: string;
  followers: number;
  engagement: number;
}

export interface TopPost {
  id: number;
  platform: string;
  content: string;
  engagement: number;
  impressions: number;
  date: string;
}
