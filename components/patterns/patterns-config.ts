/**
 * Patterns Configuration
 * Mock data and constants
 */

import type { ViralPattern, HookType, EngagementDataPoint, RadarDataPoint } from './types';

export const viralPatterns: ViralPattern[] = [
  {
    id: 1,
    platform: 'Twitter',
    content: 'Just shipped a new feature that our users have been asking for! 🚀',
    type: 'Product Update',
    engagement: 45600,
    impressions: 234000,
    shares: 892,
    hookType: 'Achievement',
    timing: '2:00 PM EST',
    sentiment: 0.85,
    viralityScore: 92,
    growthRate: '+234%',
  },
  {
    id: 2,
    platform: 'LinkedIn',
    content: 'Here are 5 lessons I learned from failing my first startup...',
    type: 'Educational',
    engagement: 28900,
    impressions: 156000,
    shares: 567,
    hookType: 'Vulnerability',
    timing: '9:00 AM EST',
    sentiment: 0.72,
    viralityScore: 88,
    growthRate: '+189%',
  },
  {
    id: 3,
    platform: 'TikTok',
    content: 'POV: You finally understand how AI works',
    type: 'Entertainment',
    engagement: 128000,
    impressions: 890000,
    shares: 12400,
    hookType: 'Relatable',
    timing: '7:00 PM EST',
    sentiment: 0.91,
    viralityScore: 95,
    growthRate: '+567%',
  },
];

export const engagementData: EngagementDataPoint[] = [
  { hour: '12am', twitter: 2400, linkedin: 1200, tiktok: 3400, instagram: 2800 },
  { hour: '6am', twitter: 3200, linkedin: 2800, tiktok: 2200, instagram: 3100 },
  { hour: '12pm', twitter: 5600, linkedin: 4200, tiktok: 4800, instagram: 5200 },
  { hour: '6pm', twitter: 7800, linkedin: 3500, tiktok: 8900, instagram: 7600 },
  { hour: '11pm', twitter: 4200, linkedin: 1800, tiktok: 6200, instagram: 5400 },
];

export const hookTypes: HookType[] = [
  { name: 'Question', value: 30, color: '#06b6d4' },
  { name: 'Story', value: 25, color: '#ec4899' },
  { name: 'Controversy', value: 20, color: '#f59e0b' },
  { name: 'Data', value: 15, color: '#10b981' },
  { name: 'Humor', value: 10, color: '#3b82f6' },
];

export const radarData: RadarDataPoint[] = [
  { metric: 'Engagement', twitter: 85, linkedin: 78, tiktok: 95, instagram: 88 },
  { metric: 'Reach', twitter: 72, linkedin: 65, tiktok: 88, instagram: 82 },
  { metric: 'Virality', twitter: 90, linkedin: 70, tiktok: 92, instagram: 85 },
  { metric: 'Consistency', twitter: 75, linkedin: 85, tiktok: 70, instagram: 80 },
  { metric: 'Growth', twitter: 80, linkedin: 75, tiktok: 95, instagram: 90 },
];

export const platformOptions = [
  { value: 'all', label: 'All Platforms' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
];

export const timeRangeOptions = [
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
];

export function filterPatterns(
  patterns: ViralPattern[],
  platform: string,
  searchQuery: string
): ViralPattern[] {
  return patterns.filter((pattern) => {
    const matchesPlatform = platform === 'all' || pattern.platform.toLowerCase() === platform;
    const matchesSearch = pattern.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          pattern.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPlatform && matchesSearch;
  });
}

export function exportReport(
  patterns: ViralPattern[],
  platform: string,
  timeRange: string,
  searchQuery: string
): void {
  const reportData = {
    exportedAt: new Date().toISOString(),
    filters: {
      platform,
      timeRange,
      searchQuery: searchQuery || null,
    },
    summary: {
      avgViralityScore: 91.7,
      bestTimeToPost: '2-3 PM EST',
      topHookType: 'Questions',
      avgGrowthRate: '+327%',
    },
    patterns,
    hookTypeDistribution: hookTypes,
    engagementTimeline: engagementData,
  };

  const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `viral-patterns-report-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
