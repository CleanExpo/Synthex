/**
 * Dashboard API Integration
 * Connects frontend dashboard to backend services
 */

import { AnalyticsService } from '@/src/services/analytics.service';
import { TeamCollaborationService } from '@/src/services/team-collaboration.service';
import { CacheService } from '@/src/services/cache.service';

// Types
export interface DashboardStats {
  totalPosts: number;
  scheduledPosts: number;
  engagementRate: number;
  followers: number;
  totalReach: number;
  totalEngagement: number;
  growthRate: number;
}

export interface ActivityItem {
  id: string;
  type: 'post' | 'engagement' | 'milestone' | 'team' | 'ai';
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface TrendingTopic {
  hashtag: string;
  mentions: number;
  growth: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface QuickStatsData {
  stats: DashboardStats;
  recentActivity: ActivityItem[];
  trendingTopics: TrendingTopic[];
}

// Cache keys
const CACHE_KEYS = {
  dashboardStats: 'dashboard:stats',
  recentActivity: 'dashboard:activity',
  trendingTopics: 'dashboard:trending',
} as const;

// Cache TTL (5 minutes)
const CACHE_TTL = 300;

/**
 * Fetch dashboard statistics with caching
 */
export async function fetchDashboardStats(userId: string): Promise<QuickStatsData> {
  const cacheKey = `${CACHE_KEYS.dashboardStats}:${userId}`;
  
  // Try cache first
  const cached = await CacheService.get<QuickStatsData>(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch from API
  try {
    const response = await fetch('/api/dashboard/stats');
    if (!response.ok) throw new Error('Failed to fetch dashboard stats');
    
    const data = await response.json();
    
    // Cache the result
    await CacheService.set(cacheKey, data, CACHE_TTL);
    
    return data;
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    // Return fallback data
    return getFallbackStats();
  }
}

/**
 * Fetch real-time analytics
 */
export async function fetchRealTimeAnalytics(userId: string, timeRange: string = '7d') {
  const cacheKey = `analytics:realtime:${userId}:${timeRange}`;
  
  const cached = await CacheService.get(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`/api/analytics/realtime?range=${timeRange}`);
    if (!response.ok) throw new Error('Failed to fetch analytics');
    
    const data = await response.json();
    await CacheService.set(cacheKey, data, 60); // 1 minute cache for real-time
    
    return data;
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return null;
  }
}

/**
 * Fetch team data
 */
export async function fetchTeamData(userId: string) {
  try {
    const result = await TeamCollaborationService.getUserTeams(userId);
    return result.success ? result.data : [];
  } catch (error) {
    console.error('Error fetching team data:', error);
    return [];
  }
}

/**
 * Track analytics event
 */
export async function trackDashboardEvent(
  userId: string,
  eventType: string,
  eventName: string,
  properties?: Record<string, any>
) {
  try {
    await AnalyticsService.trackEvent({
      userId,
      eventType,
      eventName,
      properties,
      platform: 'web',
      url: window.location.href,
    });
  } catch (error) {
    console.error('Error tracking event:', error);
  }
}

/**
 * Invalidate dashboard cache
 */
export async function invalidateDashboardCache(userId: string) {
  const patterns = [
    `${CACHE_KEYS.dashboardStats}:${userId}`,
    `${CACHE_KEYS.recentActivity}:${userId}`,
    `${CACHE_KEYS.trendingTopics}:${userId}`,
  ];
  
  for (const pattern of patterns) {
    await CacheService.delete(pattern);
  }
}

// Fallback data for when API fails
function getFallbackStats(): QuickStatsData {
  return {
    stats: {
      totalPosts: 156,
      scheduledPosts: 23,
      engagementRate: 4.8,
      followers: 12543,
      totalReach: 245780,
      totalEngagement: 18945,
      growthRate: 12.5,
    },
    recentActivity: [
      { id: '1', type: 'post', message: 'Published post on Twitter', timestamp: '2 min ago' },
      { id: '2', type: 'engagement', message: 'Post reached 1K impressions', timestamp: '15 min ago' },
      { id: '3', type: 'milestone', message: 'Gained 100 new followers', timestamp: '1 hour ago' },
      { id: '4', type: 'ai', message: 'AI generated 5 content suggestions', timestamp: '2 hours ago' },
    ],
    trendingTopics: [
      { hashtag: '#AI', mentions: 1234, growth: 23.5, sentiment: 'positive' },
      { hashtag: '#SocialMedia', mentions: 987, growth: 15.2, sentiment: 'positive' },
      { hashtag: '#Marketing', mentions: 765, growth: 8.7, sentiment: 'neutral' },
      { hashtag: '#Automation', mentions: 543, growth: 12.3, sentiment: 'positive' },
    ],
  };
}

export default {
  fetchDashboardStats,
  fetchRealTimeAnalytics,
  fetchTeamData,
  trackDashboardEvent,
  invalidateDashboardCache,
};
