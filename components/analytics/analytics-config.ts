/**
 * Analytics Configuration
 * Constants and mock data for analytics dashboard
 */

import type {
  EngagementDataPoint,
  PlatformDistributionItem,
  ContentPerformanceItem,
  GrowthDataPoint,
  TopPost,
} from './types';

// Platform colors
export const platformColors: Record<string, string> = {
  twitter: '#1DA1F2',
  linkedin: '#0077B5',
  instagram: '#E4405F',
  facebook: '#1877F2',
  tiktok: '#000000',
};

// Mock engagement data
export const engagementData: EngagementDataPoint[] = [
  { date: 'Mon', twitter: 4000, linkedin: 2400, instagram: 2400, tiktok: 3200 },
  { date: 'Tue', twitter: 3000, linkedin: 1398, instagram: 2210, tiktok: 4100 },
  { date: 'Wed', twitter: 2000, linkedin: 9800, instagram: 2290, tiktok: 3800 },
  { date: 'Thu', twitter: 2780, linkedin: 3908, instagram: 2000, tiktok: 4300 },
  { date: 'Fri', twitter: 1890, linkedin: 4800, instagram: 2181, tiktok: 5200 },
  { date: 'Sat', twitter: 2390, linkedin: 3800, instagram: 2500, tiktok: 6100 },
  { date: 'Sun', twitter: 3490, linkedin: 4300, instagram: 2100, tiktok: 7200 },
];

// Mock platform distribution
export const platformDistribution: PlatformDistributionItem[] = [
  { name: 'Twitter', value: 35, color: platformColors.twitter },
  { name: 'LinkedIn', value: 25, color: platformColors.linkedin },
  { name: 'Instagram', value: 20, color: platformColors.instagram },
  { name: 'TikTok', value: 15, color: platformColors.tiktok },
  { name: 'Facebook', value: 5, color: platformColors.facebook },
];

// Mock content performance
export const contentPerformance: ContentPerformanceItem[] = [
  { type: 'Educational', engagement: 85, reach: 75, clicks: 65 },
  { type: 'Entertainment', engagement: 92, reach: 88, clicks: 70 },
  { type: 'News', engagement: 78, reach: 82, clicks: 60 },
  { type: 'Promotional', engagement: 65, reach: 70, clicks: 80 },
  { type: 'Personal', engagement: 88, reach: 65, clicks: 55 },
];

// Mock growth data
export const growthData: GrowthDataPoint[] = [
  { month: 'Jan', followers: 1200, engagement: 4.5 },
  { month: 'Feb', followers: 1800, engagement: 5.2 },
  { month: 'Mar', followers: 2400, engagement: 5.8 },
  { month: 'Apr', followers: 3200, engagement: 6.1 },
  { month: 'May', followers: 4100, engagement: 6.8 },
  { month: 'Jun', followers: 5200, engagement: 7.2 },
];

// Mock top posts
export const topPosts: TopPost[] = [
  {
    id: 1,
    platform: 'twitter',
    content: 'Just shipped our new AI feature! 🚀',
    engagement: 12500,
    impressions: 145000,
    date: '2 days ago',
  },
  {
    id: 2,
    platform: 'linkedin',
    content: '5 lessons from building a startup...',
    engagement: 8900,
    impressions: 98000,
    date: '5 days ago',
  },
  {
    id: 3,
    platform: 'instagram',
    content: 'Behind the scenes of our product launch',
    engagement: 15600,
    impressions: 178000,
    date: '1 week ago',
  },
];

// Time range options
export const timeRangeOptions = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

// Transform API platformBreakdown to pie chart format
export function transformPlatformData(
  breakdown: Record<string, { posts: number; published: number }> | undefined
): PlatformDistributionItem[] {
  if (!breakdown || Object.keys(breakdown).length === 0) {
    return platformDistribution;
  }

  const total = Object.values(breakdown).reduce((sum, p) => sum + p.posts, 0);
  return Object.entries(breakdown).map(([platform, data]) => ({
    name: platform.charAt(0).toUpperCase() + platform.slice(1),
    value: total > 0 ? Math.round((data.posts / total) * 100) : 0,
    color: platformColors[platform] || '#8b5cf6',
  }));
}

// Transform API chartData to engagement trend format
export function transformChartData(
  chartData: Array<{ date: string; posts: number }> | undefined,
  breakdown: Record<string, { posts: number; published: number }> | undefined
): EngagementDataPoint[] {
  if (!chartData || chartData.length === 0) {
    return engagementData;
  }

  const platforms = breakdown ? Object.keys(breakdown) : ['twitter', 'linkedin', 'instagram'];
  const total = breakdown ? Object.values(breakdown).reduce((sum, p) => sum + p.posts, 0) : 1;
  const platformRatios = breakdown
    ? Object.entries(breakdown).reduce((acc, [platform, data]) => {
        acc[platform] = total > 0 ? data.posts / total : 0;
        return acc;
      }, {} as Record<string, number>)
    : { twitter: 0.4, linkedin: 0.3, instagram: 0.3 };

  return chartData.map(item => {
    const dayName = new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' });
    const baseValue = item.posts * 1000;

    return {
      date: dayName,
      twitter: Math.round(baseValue * (platformRatios.twitter || 0.3)),
      linkedin: Math.round(baseValue * (platformRatios.linkedin || 0.25)),
      instagram: Math.round(baseValue * (platformRatios.instagram || 0.2)),
      tiktok: Math.round(baseValue * (platformRatios.tiktok || 0.15)),
    };
  });
}
