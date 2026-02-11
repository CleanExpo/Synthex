import { TierManager, TierLimits } from './tier-manager';
import { PostService } from './posts';
import { analyticsDashboard } from './analytics-dashboard';
import { z } from 'zod';

// ==================== INTERFACES ====================

export interface DashboardStats {
  user: {
    id: string;
    name: string;
    email: string;
    tier: string;
    joinedAt: Date;
  };
  posts: {
    total: number;
    published: number;
    scheduled: number;
    draft: number;
    thisMonth: number;
  };
  aiGenerations: {
    used: number;
    thisMonth: number;
    remaining: number | 'unlimited';
  };
  platforms: {
    connected: number;
    configured: string[];
    available: number | 'unlimited';
  };
  engagement: {
    totalImpressions: number;
    totalLikes: number;
    totalShares: number;
    totalComments: number;
    averageEngagementRate: number;
  };
  growth: {
    postsGrowth: number;
    engagementGrowth: number;
    followersGrowth: number;
  };
}

export interface RecentActivity {
  id: string;
  type: 'post_created' | 'post_published' | 'campaign_created' | 'ai_generated' | 'platform_connected' | 'analytics_synced';
  title: string;
  description: string;
  timestamp: Date;
  status: 'success' | 'warning' | 'error' | 'info';
  metadata?: {
    platform?: string;
    postId?: string;
    campaignId?: string;
    count?: number;
  };
}

export interface PerformanceMetrics {
  timeRange: string;
  platforms: {
    [platform: string]: {
      impressions: number;
      engagement: number;
      engagementRate: number;
      clicks: number;
      shares: number;
      comments: number;
      topPerformingPost?: {
        id: string;
        content: string;
        engagementRate: number;
        publishedAt: Date;
      };
    };
  };
  trends: {
    impressions: Array<{ date: string; value: number }>;
    engagement: Array<{ date: string; value: number }>;
    posts: Array<{ date: string; value: number }>;
  };
  benchmarks: {
    averageEngagementRate: number;
    industryAverage: number;
    bestPerformingHour: number;
    bestPerformingDay: string;
  };
}

export interface UsageVsTierLimits {
  tier: string;
  limits: TierLimits;
  usage: {
    platforms: { used: number; limit: number | 'unlimited'; percentage: number };
    postsPerMonth: { used: number; limit: number | 'unlimited'; percentage: number };
    aiGenerations: { used: number; limit: number | 'unlimited'; percentage: number };
    teamMembers: { used: number; limit: number | 'unlimited'; percentage: number };
    storageGB: { used: number; limit: number | 'unlimited'; percentage: number };
  };
  recommendations: {
    shouldUpgrade: boolean;
    suggestedTier?: string;
    reasons: string[];
    benefits: string[];
  };
}

export interface QuickInsight {
  id: string;
  type: 'success' | 'warning' | 'info' | 'tip';
  title: string;
  description: string;
  action?: {
    label: string;
    url: string;
  };
  priority: 'high' | 'medium' | 'low';
}

export interface QuickInsights {
  insights: QuickInsight[];
  summary: {
    topPerformingPlatform: string;
    engagementTrend: 'up' | 'down' | 'stable';
    nextOptimalPostTime: Date;
    contentRecommendation: string;
  };
}

// ==================== VALIDATION SCHEMAS ====================

const TimeRangeSchema = z.enum(['7d', '30d', '90d', '1y']);
const TierSchema = z.enum(['starter', 'professional', 'business', 'enterprise']);

// ==================== DASHBOARD SERVICE CLASS ====================

export class DashboardService {
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private static cache: Map<string, { data: any; timestamp: number }> = new Map();

  /**
   * Get comprehensive dashboard statistics for a user
   */
  static async getDashboardStats(userId: string): Promise<DashboardStats> {
    const cacheKey = `stats-${userId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      // In production, fetch from database
      // For now, using mock data with some real calculations
      const userStats = await this.fetchUserBasicInfo(userId);
      const postStats = await PostService.getStatistics(userId);
      
      const stats: DashboardStats = {
        user: {
          id: userId,
          name: userStats.name || 'Demo User',
          email: userStats.email || 'user@synthex.local',
          tier: userStats.tier || 'professional',
          joinedAt: userStats.joinedAt || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        },
        posts: {
          total: postStats.total,
          published: postStats.published,
          scheduled: postStats.scheduled,
          draft: postStats.draft,
          thisMonth: this.calculateThisMonthPosts(postStats.recentActivity)
        },
        aiGenerations: {
          used: Math.floor(Math.random() * 180) + 50, // Mock data
          thisMonth: Math.floor(Math.random() * 150) + 30,
          remaining: userStats.tier === 'enterprise' ? 'unlimited' : Math.max(0, 250 - (Math.floor(Math.random() * 180) + 50))
        },
        platforms: {
          connected: Object.keys(postStats.byPlatform).length,
          configured: Object.keys(postStats.byPlatform),
          available: TierManager.getTierLimits(userStats.tier || 'professional').platforms
        },
        engagement: {
          totalImpressions: postStats.totalImpressions,
          totalLikes: Math.floor(postStats.totalEngagement * 0.7),
          totalShares: Math.floor(postStats.totalEngagement * 0.15),
          totalComments: Math.floor(postStats.totalEngagement * 0.15),
          averageEngagementRate: postStats.totalImpressions > 0 ? 
            Number(((postStats.totalEngagement / postStats.totalImpressions) * 100).toFixed(2)) : 0
        },
        growth: {
          postsGrowth: this.calculateGrowthRate(postStats.recentActivity),
          engagementGrowth: Math.round((Math.random() - 0.3) * 50), // -15 to +35
          followersGrowth: Math.round((Math.random() - 0.2) * 25) // -5 to +20
        }
      };

      this.setCache(cacheKey, stats);
      return stats;
    } catch (error) {
      console.error('Failed to get dashboard stats:', error);
      throw new Error('Unable to retrieve dashboard statistics');
    }
  }

  /**
   * Get recent user activity with detailed information
   */
  static async getRecentActivity(userId: string, limit: number = 10): Promise<RecentActivity[]> {
    const cacheKey = `activity-${userId}-${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      // In production, fetch from activity logs table
      const activities: RecentActivity[] = [
        {
          id: '1',
          type: 'post_published' as const,
          title: 'Post Published',
          description: 'Your LinkedIn post about AI marketing trends went live',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          status: 'success' as const,
          metadata: { platform: 'linkedin', postId: 'post_123' }
        },
        {
          id: '2',
          type: 'ai_generated' as const,
          title: 'AI Content Generated',
          description: 'Generated 5 marketing variations for your campaign',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
          status: 'success' as const,
          metadata: { count: 5 }
        },
        {
          id: '3',
          type: 'campaign_created' as const,
          title: 'Campaign Created',
          description: 'New "Winter Product Launch" campaign created successfully',
          timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
          status: 'success' as const,
          metadata: { campaignId: 'camp_456' }
        },
        {
          id: '4',
          type: 'platform_connected' as const,
          title: 'Platform Connected',
          description: 'Successfully connected Instagram Business account',
          timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
          status: 'success' as const,
          metadata: { platform: 'instagram' }
        },
        {
          id: '5',
          type: 'analytics_synced' as const,
          title: 'Analytics Updated',
          description: 'Performance metrics synced from all connected platforms',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
          status: 'info' as const
        },
        {
          id: '6',
          type: 'post_created' as const,
          title: 'Post Drafted',
          description: 'Created draft post for Twitter about industry insights',
          timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000),
          status: 'info' as const,
          metadata: { platform: 'twitter', postId: 'post_789' }
        },
        {
          id: '7',
          type: 'post_published' as const,
          title: 'Post Failed to Publish',
          description: 'Facebook post failed due to API rate limit',
          timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000),
          status: 'error' as const,
          metadata: { platform: 'facebook' }
        }
      ].slice(0, limit);

      this.setCache(cacheKey, activities);
      return activities;
    } catch (error) {
      console.error('Failed to get recent activity:', error);
      throw new Error('Unable to retrieve recent activity');
    }
  }

  /**
   * Get detailed performance metrics across platforms
   */
  static async getPerformanceMetrics(userId: string, timeRange: string = '30d'): Promise<PerformanceMetrics> {
    const validatedTimeRange = TimeRangeSchema.parse(timeRange);
    const cacheKey = `metrics-${userId}-${timeRange}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      // Get analytics data
      const analyticsData = await analyticsDashboard.aggregateMetrics(
        ['instagram', 'twitter', 'linkedin', 'facebook'], 
        timeRange
      );

      const platforms = ['instagram', 'twitter', 'linkedin', 'facebook'];
      const performanceData: PerformanceMetrics = {
        timeRange: validatedTimeRange,
        platforms: {},
        trends: {
          impressions: this.generateTrendData(30, 1000, 5000),
          engagement: this.generateTrendData(30, 50, 300),
          posts: this.generateTrendData(30, 1, 8)
        },
        benchmarks: {
          averageEngagementRate: 2.3,
          industryAverage: 1.9,
          bestPerformingHour: 14, // 2 PM
          bestPerformingDay: 'Tuesday'
        }
      };

      // Generate platform-specific metrics
      for (const platform of platforms) {
        const impressions = Math.floor(Math.random() * 8000) + 2000;
        const engagement = Math.floor(Math.random() * 400) + 100;
        
        performanceData.platforms[platform] = {
          impressions,
          engagement,
          engagementRate: Number(((engagement / impressions) * 100).toFixed(2)),
          clicks: Math.floor(engagement * 0.3),
          shares: Math.floor(engagement * 0.2),
          comments: Math.floor(engagement * 0.1),
          topPerformingPost: {
            id: `post_${platform}_123`,
            content: `Top performing ${platform} post content...`,
            engagementRate: Math.round((Math.random() * 3 + 2) * 100) / 100,
            publishedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
          }
        };
      }

      this.setCache(cacheKey, performanceData);
      return performanceData;
    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      throw new Error('Unable to retrieve performance metrics');
    }
  }

  /**
   * Calculate usage against tier limits with upgrade recommendations
   */
  static async getUsageVsTierLimits(userId: string, tier?: string): Promise<UsageVsTierLimits> {
    const cacheKey = `usage-${userId}-${tier}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const userInfo = await this.fetchUserBasicInfo(userId);
      const currentTier = tier || userInfo.tier || 'professional';
      const validatedTier = TierSchema.parse(currentTier);
      
      const limits = TierManager.getTierLimits(validatedTier);
      const postStats = await PostService.getStatistics(userId);

      // Mock current usage data
      const currentUsage = {
        platforms: Object.keys(postStats.byPlatform).length,
        postsPerMonth: this.calculateThisMonthPosts(postStats.recentActivity),
        aiGenerations: Math.floor(Math.random() * 180) + 50,
        teamMembers: 1,
        storageGB: Math.round(Math.random() * 5 * 100) / 100
      };

      const usageData: UsageVsTierLimits = {
        tier: validatedTier,
        limits,
        usage: {
          platforms: this.calculateUsagePercentage(currentUsage.platforms, limits.platforms),
          postsPerMonth: this.calculateUsagePercentage(currentUsage.postsPerMonth, limits.postsPerMonth),
          aiGenerations: this.calculateUsagePercentage(currentUsage.aiGenerations, limits.aiGenerations),
          teamMembers: this.calculateUsagePercentage(currentUsage.teamMembers, limits.teamMembers),
          storageGB: this.calculateUsagePercentage(currentUsage.storageGB, limits.storageGB)
        },
        recommendations: TierManager.getUpgradeSuggestion(validatedTier, currentUsage)
      };

      // Add upgrade benefits
      usageData.recommendations.benefits = this.getUpgradeBenefits(validatedTier, usageData.recommendations.suggestedTier);

      this.setCache(cacheKey, usageData);
      return usageData;
    } catch (error) {
      console.error('Failed to get usage vs tier limits:', error);
      throw new Error('Unable to retrieve usage information');
    }
  }

  /**
   * Generate actionable insights for the user
   */
  static async getQuickInsights(userId: string): Promise<QuickInsights> {
    const cacheKey = `insights-${userId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const [stats, metrics, usage] = await Promise.all([
        this.getDashboardStats(userId),
        this.getPerformanceMetrics(userId, '30d'),
        this.getUsageVsTierLimits(userId)
      ]);

      const insights: QuickInsight[] = [];

      // Performance insights
      if (stats.engagement.averageEngagementRate > 3.0) {
        insights.push({
          id: 'high-engagement',
          type: 'success',
          title: 'Excellent Engagement!',
          description: `Your content is performing above average with ${stats.engagement.averageEngagementRate}% engagement rate.`,
          priority: 'high'
        });
      }

      // Growth insights
      if (stats.growth.postsGrowth > 20) {
        insights.push({
          id: 'posting-growth',
          type: 'success',
          title: 'Consistent Posting',
          description: `You've increased your posting frequency by ${stats.growth.postsGrowth}% this month.`,
          priority: 'medium'
        });
      }

      // Usage warnings
      if (usage.usage.postsPerMonth.percentage > 80) {
        insights.push({
          id: 'post-limit-warning',
          type: 'warning',
          title: 'Approaching Post Limit',
          description: `You've used ${usage.usage.postsPerMonth.percentage}% of your monthly post allowance.`,
          action: { label: 'Upgrade Plan', url: '/billing' },
          priority: 'high'
        });
      }

      // AI generation insights
      if (usage.usage.aiGenerations.percentage > 75) {
        insights.push({
          id: 'ai-limit-warning',
          type: 'warning',
          title: 'AI Generations Running Low',
          description: `${usage.usage.aiGenerations.used} of ${usage.usage.aiGenerations.limit} AI generations used this month.`,
          action: { label: 'Upgrade Plan', url: '/billing' },
          priority: 'high'
        });
      }

      // Content optimization tips
      const bestPlatform = this.getBestPerformingPlatform(metrics.platforms);
      insights.push({
        id: 'best-platform',
        type: 'tip',
        title: `${bestPlatform} is Your Top Platform`,
        description: `Consider creating more content for ${bestPlatform} - it shows the highest engagement rates.`,
        priority: 'medium'
      });

      // Timing recommendations
      insights.push({
        id: 'optimal-timing',
        type: 'info',
        title: 'Optimal Posting Time',
        description: `Posts perform best on ${metrics.benchmarks.bestPerformingDay}s at ${metrics.benchmarks.bestPerformingHour}:00.`,
        priority: 'low'
      });

      // Platform expansion
      if (stats.platforms.connected < 4) {
        insights.push({
          id: 'expand-platforms',
          type: 'tip',
          title: 'Expand Your Reach',
          description: 'Connect more social platforms to reach a wider audience and diversify your content strategy.',
          action: { label: 'Connect Platforms', url: '/settings/platforms' },
          priority: 'medium'
        });
      }

      const quickInsights: QuickInsights = {
        insights: insights.sort((a, b) => {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }),
        summary: {
          topPerformingPlatform: bestPlatform,
          engagementTrend: stats.growth.engagementGrowth > 0 ? 'up' : 
                          stats.growth.engagementGrowth < 0 ? 'down' : 'stable',
          nextOptimalPostTime: this.getNextOptimalPostTime(metrics.benchmarks),
          contentRecommendation: this.getContentRecommendation(metrics)
        }
      };

      this.setCache(cacheKey, quickInsights);
      return quickInsights;
    } catch (error) {
      console.error('Failed to generate quick insights:', error);
      throw new Error('Unable to generate insights');
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private static async fetchUserBasicInfo(userId: string): Promise<any> {
    // In production, fetch from user table
    // For now, return mock data with .local TLD to indicate non-production
    return {
      name: 'Demo User',
      email: 'user@synthex.local',
      tier: 'professional',
      joinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    };
  }

  private static calculateThisMonthPosts(recentActivity: Array<{ date: string; count: number }>): number {
    const thisMonth = new Date().getMonth();
    return recentActivity
      .filter(activity => new Date(activity.date).getMonth() === thisMonth)
      .reduce((sum, activity) => sum + activity.count, 0);
  }

  private static calculateGrowthRate(recentActivity: Array<{ date: string; count: number }>): number {
    if (recentActivity.length < 14) return 0;
    
    const thisWeek = recentActivity.slice(0, 7).reduce((sum, a) => sum + a.count, 0);
    const lastWeek = recentActivity.slice(7, 14).reduce((sum, a) => sum + a.count, 0);
    
    if (lastWeek === 0) return thisWeek > 0 ? 100 : 0;
    return Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  }

  private static calculateUsagePercentage(
    used: number, 
    limit: number | 'unlimited'
  ): { used: number; limit: number | 'unlimited'; percentage: number } {
    if (limit === 'unlimited') {
      return { used, limit: 'unlimited', percentage: 0 };
    }
    
    const percentage = Math.min(100, Math.round((used / limit) * 100));
    return { used, limit, percentage };
  }

  private static getUpgradeBenefits(currentTier: string, suggestedTier?: string): string[] {
    if (!suggestedTier) return [];
    
    const benefits: Record<string, string[]> = {
      professional: [
        'More AI generations per month',
        'Advanced analytics and insights',
        'Video content generation',
        'API access for integrations'
      ],
      business: [
        'Unlimited platforms',
        'More posts per month',
        'Priority customer support',
        'Custom branding options'
      ],
      enterprise: [
        'Unlimited everything',
        'Dedicated account manager',
        'Custom integrations',
        'Enterprise-grade security'
      ]
    };
    
    return benefits[suggestedTier] || [];
  }

  private static generateTrendData(days: number, min: number, max: number): Array<{ date: string; value: number }> {
    const data: Array<{ date: string; value: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const trend = Math.sin((i / days) * Math.PI) * (max - min) * 0.3;
      const noise = (Math.random() - 0.5) * (max - min) * 0.2;
      const value = Math.round(Math.max(min, min + trend + noise + (max - min) * 0.3));
      
      data.push({
        date: date.toISOString().split('T')[0],
        value
      });
    }
    return data;
  }

  private static getBestPerformingPlatform(platforms: { [platform: string]: any }): string {
    let bestPlatform = 'Instagram';
    let bestRate = 0;
    
    for (const [platform, metrics] of Object.entries(platforms)) {
      if (metrics.engagementRate > bestRate) {
        bestRate = metrics.engagementRate;
        bestPlatform = platform.charAt(0).toUpperCase() + platform.slice(1);
      }
    }
    
    return bestPlatform;
  }

  private static getNextOptimalPostTime(benchmarks: any): Date {
    const now = new Date();
    const nextOptimal = new Date();
    
    // Find the next occurrence of the best performing day and hour
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const targetDay = daysOfWeek.indexOf(benchmarks.bestPerformingDay);
    const currentDay = now.getDay();
    
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0 || (daysToAdd === 0 && now.getHours() >= benchmarks.bestPerformingHour)) {
      daysToAdd += 7;
    }
    
    nextOptimal.setDate(now.getDate() + daysToAdd);
    nextOptimal.setHours(benchmarks.bestPerformingHour, 0, 0, 0);
    
    return nextOptimal;
  }

  private static getContentRecommendation(metrics: any): string {
    const recommendations = [
      'Video content shows higher engagement rates',
      'Questions in posts increase comment rates by 50%',
      'Behind-the-scenes content builds authentic connections',
      'User-generated content drives 3x more engagement',
      'Carousel posts on Instagram perform 40% better'
    ];
    
    return recommendations[Math.floor(Math.random() * recommendations.length)];
  }

  private static getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  private static setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Clear cache for a specific user or all cache
   */
  static clearCache(userId?: string): void {
    if (userId) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.includes(userId));
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  static getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export default DashboardService;