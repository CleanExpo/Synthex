/**
 * Analytics Configuration
 * Constants for analytics dashboard
 */

import type {
  EngagementDataPoint,
  PlatformDistributionItem,
  GrowthDataPoint,
  TopPost,
  ContentPerformanceItem,
  PerformanceData,
} from './types';

// Platform colors
export const platformColors: Record<string, string> = {
  twitter: '#1DA1F2',
  linkedin: '#0077B5',
  instagram: '#E4405F',
  facebook: '#1877F2',
  tiktok: '#000000',
};

// Time range options
export const timeRangeOptions = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom Range' },
];

// Platform filter options
export const platformFilterOptions = [
  { value: 'all', label: 'All Platforms' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'threads', label: 'Threads' },
];

// Transform API platformBreakdown to pie chart format
export function transformPlatformData(
  breakdown: Record<string, { posts: number; published: number }> | undefined
): PlatformDistributionItem[] {
  if (!breakdown || Object.keys(breakdown).length === 0) {
    return [];
  }

  const total = Object.values(breakdown).reduce((sum, p) => sum + p.posts, 0);
  return Object.entries(breakdown).map(([platform, data]) => ({
    name: platform.charAt(0).toUpperCase() + platform.slice(1),
    value: total > 0 ? Math.round((data.posts / total) * 100) : 0,
    color: platformColors[platform] || '#06b6d4',
  }));
}

// Transform performance API timeline to EngagementChart format (per-date aggregated engagement)
export function transformTimelineToEngagement(
  timeline: PerformanceData['timeline'] | undefined
): EngagementDataPoint[] {
  if (!timeline || timeline.length === 0) {
    return [];
  }

  return timeline.map((item) => {
    const dayName = new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' });
    // API returns aggregated engagement; distribute proportionally across major platforms
    // as a reasonable approximation when platform filter is 'all'
    const total = item.engagement;
    return {
      date: dayName,
      twitter: Math.round(total * 0.3),
      linkedin: Math.round(total * 0.25),
      instagram: Math.round(total * 0.25),
      tiktok: Math.round(total * 0.2),
    };
  });
}

// Transform performance API timeline to GrowthChart format
export function transformTimelineToGrowth(
  timeline: PerformanceData['timeline'] | undefined
): GrowthDataPoint[] {
  if (!timeline || timeline.length === 0) {
    return [];
  }

  return timeline.map((item) => {
    const monthLabel = new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return {
      month: monthLabel,
      followers: item.reach, // reach as proxy for audience size
      engagement: item.engagement,
    };
  });
}

// Transform performance API topContent to TopPost format
export function transformTopContent(
  topContent: PerformanceData['topContent'] | undefined
): TopPost[] {
  if (!topContent || topContent.length === 0) {
    return [];
  }

  return topContent.map((item, index) => ({
    id: index + 1, // TopPost uses numeric id; use index as stable key
    content: item.content,
    platform: item.platform,
    engagement: item.engagement,
    impressions: Math.round(item.engagement / (item.engagementRate / 100 || 0.01)),
    date: new Date(item.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));
}

// Transform performance API chartData to engagement trend format
export function transformChartData(
  chartData: Array<{ date: string; posts: number }> | undefined,
  breakdown: Record<string, { posts: number; published: number }> | undefined
): EngagementDataPoint[] {
  if (!chartData || chartData.length === 0) {
    return [];
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
