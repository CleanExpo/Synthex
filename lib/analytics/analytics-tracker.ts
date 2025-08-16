/**
 * Comprehensive Analytics Tracking System
 * Records user interactions, post performance, and engagement metrics
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AnalyticsEvent {
  type: EventType;
  userId?: string;
  sessionId: string;
  timestamp: Date;
  metadata: Record<string, any>;
  platform?: string;
  contentId?: string;
  campaignId?: string;
}

export type EventType = 
  | 'page_view'
  | 'login'
  | 'logout'
  | 'signup'
  | 'content_generated'
  | 'content_posted'
  | 'content_scheduled'
  | 'content_edited'
  | 'content_deleted'
  | 'campaign_created'
  | 'campaign_updated'
  | 'dashboard_viewed'
  | 'profile_updated'
  | 'api_call'
  | 'error'
  | 'feature_used';

export interface EngagementMetrics {
  views: number;
  likes: number;
  shares: number;
  comments: number;
  clicks: number;
  impressions: number;
  reach: number;
  engagementRate: number;
  viralScore: number;
}

export interface UserAnalytics {
  userId: string;
  totalPosts: number;
  totalEngagement: number;
  averageEngagementRate: number;
  bestPerformingPlatform: string;
  bestPerformingTime: string;
  contentGenerated: number;
  campaignsCreated: number;
  lastActive: Date;
}

export interface PlatformAnalytics {
  platform: string;
  posts: number;
  engagement: EngagementMetrics;
  topContent: ContentPerformance[];
  bestTimes: string[];
  growthRate: number;
}

export interface ContentPerformance {
  contentId: string;
  content: string;
  platform: string;
  postedAt: Date;
  engagement: EngagementMetrics;
  hashtags: string[];
  viralScore: number;
}

export class AnalyticsTracker {
  private sessionId: string;
  private buffer: AnalyticsEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL = 30000; // 30 seconds
  private readonly BUFFER_SIZE = 50;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.startAutoFlush();
  }

  /**
   * Track a generic event
   */
  async track(event: Omit<AnalyticsEvent, 'sessionId' | 'timestamp'>): Promise<void> {
    const fullEvent: AnalyticsEvent = {
      ...event,
      sessionId: this.sessionId,
      timestamp: new Date()
    };

    this.buffer.push(fullEvent);

    // Flush if buffer is full
    if (this.buffer.length >= this.BUFFER_SIZE) {
      await this.flush();
    }
  }

  /**
   * Track page view
   */
  async trackPageView(
    page: string, 
    userId?: string, 
    referrer?: string
  ): Promise<void> {
    await this.track({
      type: 'page_view',
      userId,
      metadata: {
        page,
        referrer,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Track content generation
   */
  async trackContentGeneration(
    userId: string,
    platform: string,
    contentType: string,
    aiModel?: string
  ): Promise<void> {
    await this.track({
      type: 'content_generated',
      userId,
      platform,
      metadata: {
        contentType,
        aiModel,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Track content posting
   */
  async trackContentPost(
    userId: string,
    contentId: string,
    platforms: string[],
    campaignId?: string
  ): Promise<void> {
    await this.track({
      type: 'content_posted',
      userId,
      contentId,
      campaignId,
      metadata: {
        platforms,
        platformCount: platforms.length,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Track engagement metrics for a post
   */
  async trackEngagement(
    contentId: string,
    platform: string,
    metrics: Partial<EngagementMetrics>
  ): Promise<void> {
    try {
      // Update post with engagement metrics
      await prisma.post.update({
        where: { id: contentId },
        data: {
          analytics: {
            ...metrics,
            lastUpdated: new Date()
          }
        }
      });

      // Calculate engagement rate
      const engagementRate = this.calculateEngagementRate(metrics);

      // Track as event
      await this.track({
        type: 'feature_used',
        contentId,
        platform,
        metadata: {
          feature: 'engagement_update',
          metrics,
          engagementRate,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error tracking engagement:', error);
    }
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(userId: string): Promise<UserAnalytics> {
    try {
      // Get user's posts
      const posts = await prisma.post.findMany({
        where: { 
          campaign: { userId }
        },
        include: {
          campaign: true
        }
      });

      // Get user's campaigns
      const campaigns = await prisma.campaign.findMany({
        where: { userId }
      });

      // Calculate metrics
      const totalEngagement = posts.reduce((sum, post) => {
        const analytics = post.analytics as any;
        return sum + (analytics?.likes || 0) + (analytics?.shares || 0) + (analytics?.comments || 0);
      }, 0);

      const platformStats = this.aggregatePlatformStats(posts);
      const bestPlatform = this.findBestPlatform(platformStats);

      // Get AI content generation count
      const contentGenerated = await prisma.campaign.count({
        where: {
          userId
        }
      });

      return {
        userId,
        totalPosts: posts.length,
        totalEngagement,
        averageEngagementRate: posts.length > 0 ? totalEngagement / posts.length : 0,
        bestPerformingPlatform: bestPlatform,
        bestPerformingTime: this.findBestPostingTime(posts),
        contentGenerated,
        campaignsCreated: campaigns.length,
        lastActive: new Date()
      };
    } catch (error) {
      console.error('Error getting user analytics:', error);
      return this.getDefaultUserAnalytics(userId);
    }
  }

  /**
   * Get platform-specific analytics
   */
  async getPlatformAnalytics(
    userId: string,
    platform: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<PlatformAnalytics> {
    try {
      const where: any = {
        campaign: { userId },
        platform
      };

      if (dateRange) {
        where.createdAt = {
          gte: dateRange.start,
          lte: dateRange.end
        };
      }

      const posts = await prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      });

      // Calculate engagement metrics
      const engagement = this.aggregateEngagement(posts);
      
      // Get top performing content
      const topContent = this.getTopContent(posts, 5);
      
      // Find best posting times
      const bestTimes = this.analyzeBestTimes(posts);
      
      // Calculate growth rate
      const growthRate = await this.calculateGrowthRate(userId, platform);

      return {
        platform,
        posts: posts.length,
        engagement,
        topContent,
        bestTimes,
        growthRate
      };
    } catch (error) {
      console.error('Error getting platform analytics:', error);
      return this.getDefaultPlatformAnalytics(platform);
    }
  }

  /**
   * Get content performance metrics
   */
  async getContentPerformance(contentId: string): Promise<ContentPerformance | null> {
    try {
      const post = await prisma.post.findUnique({
        where: { id: contentId }
      });

      if (!post) return null;

      const analytics = post.analytics as any;
      const metadata = post.metadata as any;

      return {
        contentId: post.id,
        content: post.content,
        platform: post.platform,
        postedAt: post.publishedAt || post.createdAt,
        engagement: {
          views: analytics?.views || 0,
          likes: analytics?.likes || 0,
          shares: analytics?.shares || 0,
          comments: analytics?.comments || 0,
          clicks: analytics?.clicks || 0,
          impressions: analytics?.impressions || 0,
          reach: analytics?.reach || 0,
          engagementRate: this.calculateEngagementRate(analytics),
          viralScore: analytics?.viralScore || 0
        },
        hashtags: metadata?.hashtags || [],
        viralScore: analytics?.viralScore || 0
      };
    } catch (error) {
      console.error('Error getting content performance:', error);
      return null;
    }
  }

  /**
   * Get dashboard metrics
   */
  async getDashboardMetrics(userId: string): Promise<any> {
    try {
      const [userAnalytics, recentPosts, topPlatforms] = await Promise.all([
        this.getUserAnalytics(userId),
        this.getRecentPosts(userId, 10),
        this.getTopPlatforms(userId)
      ]);

      // Calculate trends
      const trends = await this.calculateTrends(userId);

      return {
        overview: {
          totalPosts: userAnalytics.totalPosts,
          totalEngagement: userAnalytics.totalEngagement,
          averageEngagementRate: userAnalytics.averageEngagementRate,
          contentGenerated: userAnalytics.contentGenerated
        },
        recentActivity: recentPosts,
        platformBreakdown: topPlatforms,
        trends,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error getting dashboard metrics:', error);
      return this.getDefaultDashboardMetrics();
    }
  }

  /**
   * Calculate engagement rate
   */
  private calculateEngagementRate(metrics: any): number {
    if (!metrics) return 0;
    
    const interactions = (metrics.likes || 0) + (metrics.shares || 0) + (metrics.comments || 0);
    const reach = metrics.reach || metrics.impressions || 1;
    
    return Math.round((interactions / reach) * 10000) / 100; // Percentage with 2 decimals
  }

  /**
   * Aggregate platform statistics
   */
  private aggregatePlatformStats(posts: any[]): Map<string, any> {
    const stats = new Map();
    
    for (const post of posts) {
      const platform = post.platform;
      if (!stats.has(platform)) {
        stats.set(platform, {
          posts: 0,
          engagement: 0,
          avgEngagement: 0
        });
      }
      
      const platformStats = stats.get(platform);
      platformStats.posts++;
      
      const analytics = post.analytics as any;
      if (analytics) {
        platformStats.engagement += (analytics.likes || 0) + (analytics.shares || 0) + (analytics.comments || 0);
      }
    }
    
    // Calculate averages
    for (const [platform, data] of stats) {
      data.avgEngagement = data.posts > 0 ? data.engagement / data.posts : 0;
    }
    
    return stats;
  }

  /**
   * Find best performing platform
   */
  private findBestPlatform(stats: Map<string, any>): string {
    let bestPlatform = '';
    let bestEngagement = 0;
    
    for (const [platform, data] of stats) {
      if (data.avgEngagement > bestEngagement) {
        bestEngagement = data.avgEngagement;
        bestPlatform = platform;
      }
    }
    
    return bestPlatform || 'twitter';
  }

  /**
   * Find best posting time
   */
  private findBestPostingTime(posts: any[]): string {
    const hourlyEngagement = new Map<number, { total: number; count: number }>();
    
    for (const post of posts) {
      const hour = new Date(post.publishedAt || post.createdAt).getHours();
      const analytics = post.analytics as any;
      const engagement = (analytics?.likes || 0) + (analytics?.shares || 0) + (analytics?.comments || 0);
      
      if (!hourlyEngagement.has(hour)) {
        hourlyEngagement.set(hour, { total: 0, count: 0 });
      }
      
      const hourData = hourlyEngagement.get(hour)!;
      hourData.total += engagement;
      hourData.count++;
    }
    
    let bestHour = 0;
    let bestAvgEngagement = 0;
    
    for (const [hour, data] of hourlyEngagement) {
      const avgEngagement = data.total / data.count;
      if (avgEngagement > bestAvgEngagement) {
        bestAvgEngagement = avgEngagement;
        bestHour = hour;
      }
    }
    
    return `${bestHour}:00`;
  }

  /**
   * Aggregate engagement metrics
   */
  private aggregateEngagement(posts: any[]): EngagementMetrics {
    const totals = {
      views: 0,
      likes: 0,
      shares: 0,
      comments: 0,
      clicks: 0,
      impressions: 0,
      reach: 0,
      engagementRate: 0,
      viralScore: 0
    };
    
    for (const post of posts) {
      const analytics = post.analytics as any;
      if (analytics) {
        totals.views += analytics.views || 0;
        totals.likes += analytics.likes || 0;
        totals.shares += analytics.shares || 0;
        totals.comments += analytics.comments || 0;
        totals.clicks += analytics.clicks || 0;
        totals.impressions += analytics.impressions || 0;
        totals.reach += analytics.reach || 0;
        totals.viralScore += analytics.viralScore || 0;
      }
    }
    
    totals.engagementRate = this.calculateEngagementRate(totals);
    totals.viralScore = posts.length > 0 ? totals.viralScore / posts.length : 0;
    
    return totals;
  }

  /**
   * Get top performing content
   */
  private getTopContent(posts: any[], limit: number): ContentPerformance[] {
    return posts
      .map(post => {
        const analytics = post.analytics as any;
        const metadata = post.metadata as any;
        const engagement = (analytics?.likes || 0) + (analytics?.shares || 0) + (analytics?.comments || 0);
        
        return {
          contentId: post.id,
          content: post.content.substring(0, 100) + '...',
          platform: post.platform,
          postedAt: post.publishedAt || post.createdAt,
          engagement: {
            views: analytics?.views || 0,
            likes: analytics?.likes || 0,
            shares: analytics?.shares || 0,
            comments: analytics?.comments || 0,
            clicks: analytics?.clicks || 0,
            impressions: analytics?.impressions || 0,
            reach: analytics?.reach || 0,
            engagementRate: this.calculateEngagementRate(analytics),
            viralScore: analytics?.viralScore || 0
          },
          hashtags: metadata?.hashtags || [],
          viralScore: analytics?.viralScore || 0,
          totalEngagement: engagement
        };
      })
      .sort((a: any, b: any) => b.totalEngagement - a.totalEngagement)
      .slice(0, limit)
      .map(({ totalEngagement, ...rest }) => rest);
  }

  /**
   * Analyze best posting times
   */
  private analyzeBestTimes(posts: any[]): string[] {
    const timeEngagement = new Map<string, { total: number; count: number }>();
    
    for (const post of posts) {
      const date = new Date(post.publishedAt || post.createdAt);
      const timeSlot = `${date.getHours()}:00`;
      const analytics = post.analytics as any;
      const engagement = (analytics?.likes || 0) + (analytics?.shares || 0) + (analytics?.comments || 0);
      
      if (!timeEngagement.has(timeSlot)) {
        timeEngagement.set(timeSlot, { total: 0, count: 0 });
      }
      
      const slotData = timeEngagement.get(timeSlot)!;
      slotData.total += engagement;
      slotData.count++;
    }
    
    // Sort by average engagement
    const sortedTimes = Array.from(timeEngagement.entries())
      .map(([time, data]) => ({
        time,
        avgEngagement: data.total / data.count
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 3)
      .map(item => item.time);
    
    return sortedTimes.length > 0 ? sortedTimes : ['9:00', '12:00', '18:00'];
  }

  /**
   * Calculate growth rate
   */
  private async calculateGrowthRate(userId: string, platform: string): Promise<number> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      
      const [currentPeriod, previousPeriod] = await Promise.all([
        prisma.post.count({
          where: {
            campaign: { userId },
            platform,
            createdAt: { gte: thirtyDaysAgo }
          }
        }),
        prisma.post.count({
          where: {
            campaign: { userId },
            platform,
            createdAt: {
              gte: sixtyDaysAgo,
              lt: thirtyDaysAgo
            }
          }
        })
      ]);
      
      if (previousPeriod === 0) return currentPeriod > 0 ? 100 : 0;
      
      return Math.round(((currentPeriod - previousPeriod) / previousPeriod) * 100);
    } catch (error) {
      console.error('Error calculating growth rate:', error);
      return 0;
    }
  }

  /**
   * Get recent posts
   */
  private async getRecentPosts(userId: string, limit: number): Promise<any[]> {
    try {
      const posts = await prisma.post.findMany({
        where: {
          campaign: { userId }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          campaign: {
            select: {
              name: true
            }
          }
        }
      });
      
      return posts.map(post => ({
        id: post.id,
        content: post.content.substring(0, 100) + '...',
        platform: post.platform,
        campaignName: post.campaign.name,
        status: post.status,
        createdAt: post.createdAt
      }));
    } catch (error) {
      console.error('Error getting recent posts:', error);
      return [];
    }
  }

  /**
   * Get top platforms
   */
  private async getTopPlatforms(userId: string): Promise<any[]> {
    try {
      const platforms = await prisma.post.groupBy({
        by: ['platform'],
        where: {
          campaign: { userId }
        },
        _count: {
          id: true
        }
      });
      
      return platforms
        .map(p => ({
          platform: p.platform,
          posts: p._count.id
        }))
        .sort((a, b) => b.posts - a.posts);
    } catch (error) {
      console.error('Error getting top platforms:', error);
      return [];
    }
  }

  /**
   * Calculate trends
   */
  private async calculateTrends(userId: string): Promise<any> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      
      const [currentWeek, previousWeek] = await Promise.all([
        prisma.post.count({
          where: {
            campaign: { userId },
            createdAt: { gte: sevenDaysAgo }
          }
        }),
        prisma.post.count({
          where: {
            campaign: { userId },
            createdAt: {
              gte: fourteenDaysAgo,
              lt: sevenDaysAgo
            }
          }
        })
      ]);
      
      const growthRate = previousWeek === 0 
        ? (currentWeek > 0 ? 100 : 0)
        : Math.round(((currentWeek - previousWeek) / previousWeek) * 100);
      
      return {
        postsThisWeek: currentWeek,
        postsLastWeek: previousWeek,
        growthRate,
        trending: growthRate > 0 ? 'up' : growthRate < 0 ? 'down' : 'stable'
      };
    } catch (error) {
      console.error('Error calculating trends:', error);
      return {
        postsThisWeek: 0,
        postsLastWeek: 0,
        growthRate: 0,
        trending: 'stable'
      };
    }
  }

  /**
   * Flush buffer to database
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    
    const events = [...this.buffer];
    this.buffer = [];
    
    try {
      // Store events in database
      await prisma.analyticsEvent.createMany({
        data: events.map(event => ({
          type: event.type,
          userId: event.userId,
          sessionId: event.sessionId,
          timestamp: event.timestamp,
          metadata: event.metadata,
          platform: event.platform,
          contentId: event.contentId,
          campaignId: event.campaignId
        }))
      });
    } catch (error) {
      console.error('Error flushing analytics buffer:', error);
      // Re-add events to buffer on failure
      this.buffer.unshift(...events);
    }
  }

  /**
   * Start auto-flush interval
   */
  private startAutoFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flush().catch(console.error);
    }, this.FLUSH_INTERVAL);
  }

  /**
   * Stop auto-flush interval
   */
  stopAutoFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get default user analytics
   */
  private getDefaultUserAnalytics(userId: string): UserAnalytics {
    return {
      userId,
      totalPosts: 0,
      totalEngagement: 0,
      averageEngagementRate: 0,
      bestPerformingPlatform: 'twitter',
      bestPerformingTime: '9:00',
      contentGenerated: 0,
      campaignsCreated: 0,
      lastActive: new Date()
    };
  }

  /**
   * Get default platform analytics
   */
  private getDefaultPlatformAnalytics(platform: string): PlatformAnalytics {
    return {
      platform,
      posts: 0,
      engagement: {
        views: 0,
        likes: 0,
        shares: 0,
        comments: 0,
        clicks: 0,
        impressions: 0,
        reach: 0,
        engagementRate: 0,
        viralScore: 0
      },
      topContent: [],
      bestTimes: ['9:00', '12:00', '18:00'],
      growthRate: 0
    };
  }

  /**
   * Get default dashboard metrics
   */
  private getDefaultDashboardMetrics(): any {
    return {
      overview: {
        totalPosts: 0,
        totalEngagement: 0,
        averageEngagementRate: 0,
        contentGenerated: 0
      },
      recentActivity: [],
      platformBreakdown: [],
      trends: {
        postsThisWeek: 0,
        postsLastWeek: 0,
        growthRate: 0,
        trending: 'stable'
      },
      lastUpdated: new Date()
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.stopAutoFlush();
    await this.flush();
    await prisma.$disconnect();
  }
}

// Export singleton instance
export const analyticsTracker = new AnalyticsTracker();