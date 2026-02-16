/**
 * Pattern Scraper Service
 * Analyzes viral content patterns across social media platforms
 */

import { db } from '@/lib/supabase-client';

/** Content engagement metrics */
export interface ContentMetrics {
  impressions: number;
  engagement: number;
  shares: number;
  likes: number;
}

/** Mock content structure */
export interface MockContent {
  content: string;
  metrics: ContentMetrics;
  author: string;
  timestamp: string;
}

/** Pattern analysis result */
export interface PatternAnalysis {
  platform: string;
  content: string;
  metrics: ContentMetrics;
  author: string;
  timestamp: string;
  contentLength: number;
  wordCount: number;
  hasEmojis: boolean;
  hasHashtags: string[];
  hasMentions: string[];
  hasUrls: boolean;
  engagementRate: number;
  viralityScore: number;
  shareRatio: number;
  hookType: string;
  sentiment: number;
  contentType: string;
  postHour: number;
  postDay: number;
  isViral: boolean;
  performanceLevel: string;
}

/** Database pattern record */
export interface DatabasePattern {
  id?: string;
  platform: string;
  pattern_type: string;
  pattern_data: PatternAnalysis;
  engagement_score: number;
  discovered_at?: string;
}

/** Hook type with count */
interface HookTypeCount {
  type: string;
  count: number;
  percentage: number;
}

/** Best posting time data */
interface PostingTimeData {
  hour: number;
  count: number;
  avgScore: number;
}

/** Hashtag count */
interface HashtagCount {
  tag: string;
  count: number;
}

/** Content type distribution */
interface ContentTypeDistribution {
  type: string;
  count: number;
  percentage: number;
}

/** Platform performance stats */
interface PlatformPerformance {
  platform: string;
  count: number;
  avgScore: number;
}

// Platform API integrations not yet configured — pattern scraping requires
// real social media API connections to fetch trending/viral content.

export class PatternScraperService {
  private platforms = ['twitter', 'linkedin', 'tiktok', 'instagram', 'facebook'];

  /**
   * Scrape and analyze viral patterns from all platforms
   */
  async scrapeAllPlatforms(): Promise<PatternAnalysis[]> {
    const results: PatternAnalysis[] = [];

    for (const platform of this.platforms) {
      try {
        const patterns = await this.scrapePlatform(platform);
        results.push(...patterns);
      } catch (error) {
        console.error(`Error scraping ${platform}:`, error);
      }
    }

    return results;
  }

  /**
   * Scrape viral patterns from a specific platform.
   * Returns empty array until platform API integrations are configured.
   */
  async scrapePlatform(_platform: string): Promise<PatternAnalysis[]> {
    // Pattern scraping requires real social media API connections.
    // Returns empty results until platform integrations are configured.
    return [];
  }

  /**
   * Analyze content to extract patterns
   */
  private async analyzeContent(content: MockContent, platform: string): Promise<PatternAnalysis> {
    const analysis = {
      platform,
      content: content.content,
      metrics: content.metrics,
      author: content.author,
      timestamp: content.timestamp,
      
      // Content analysis
      contentLength: content.content.length,
      wordCount: content.content.split(/\s+/).length,
      hasEmojis: this.detectEmojis(content.content),
      hasHashtags: this.detectHashtags(content.content),
      hasMentions: this.detectMentions(content.content),
      hasUrls: this.detectUrls(content.content),
      
      // Engagement analysis
      engagementRate: this.calculateEngagementRate(content.metrics),
      viralityScore: this.calculateViralityScore(content.metrics, platform),
      shareRatio: content.metrics.shares / content.metrics.engagement,
      
      // Pattern detection
      hookType: this.detectHookType(content.content),
      sentiment: this.analyzeSentiment(content.content),
      contentType: this.detectContentType(content.content),
      
      // Timing analysis
      postHour: new Date(content.timestamp).getHours(),
      postDay: new Date(content.timestamp).getDay(),
      
      // Success indicators
      isViral: this.isViral(content.metrics, platform),
      performanceLevel: this.getPerformanceLevel(content.metrics, platform),
    };

    // Save pattern to database
    try {
      await this.savePattern(analysis);
    } catch (error) {
      console.error('Error saving pattern:', error);
    }

    return analysis;
  }

  /**
   * Detect emojis in content
   */
  private detectEmojis(content: string): boolean {
    return /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(content);
  }

  /**
   * Detect hashtags in content
   */
  private detectHashtags(content: string): string[] {
    const hashtags = content.match(/#\w+/g) || [];
    return hashtags.map(tag => tag.toLowerCase());
  }

  /**
   * Detect mentions in content
   */
  private detectMentions(content: string): string[] {
    const mentions = content.match(/@\w+/g) || [];
    return mentions;
  }

  /**
   * Detect URLs in content
   */
  private detectUrls(content: string): boolean {
    return /https?:\/\/\S+/.test(content);
  }

  /**
   * Calculate engagement rate
   */
  private calculateEngagementRate(metrics: ContentMetrics): number {
    if (metrics.impressions === 0) return 0;
    return (metrics.engagement / metrics.impressions) * 100;
  }

  /**
   * Calculate virality score
   */
  private calculateViralityScore(metrics: ContentMetrics, platform: string): number {
    // Platform-specific virality thresholds
    const thresholds = {
      twitter: { viral: 10000, superViral: 50000 },
      linkedin: { viral: 5000, superViral: 20000 },
      tiktok: { viral: 100000, superViral: 500000 },
      instagram: { viral: 30000, superViral: 100000 },
      facebook: { viral: 20000, superViral: 80000 },
    };

    const threshold = thresholds[platform as keyof typeof thresholds] || thresholds.twitter;
    
    if (metrics.engagement >= threshold.superViral) return 100;
    if (metrics.engagement >= threshold.viral) return 80;
    
    return Math.min((metrics.engagement / threshold.viral) * 80, 79);
  }

  /**
   * Detect hook type
   */
  private detectHookType(content: string): string {
    const hooks = {
      question: /^(why|what|how|when|where|who|did you know)/i,
      story: /^(just|today|yesterday|last week|story time)/i,
      controversy: /^(unpopular opinion|hot take|controversial)/i,
      data: /^(\d+%|studies show|research|statistics)/i,
      humor: /^(pov:|imagine|me when|mood:)/i,
      achievement: /^(just shipped|launched|proud|excited)/i,
      vulnerability: /^(failed|learned|mistake|struggling)/i,
      relatable: /^(anyone else|we all|who else)/i,
      educational: /^(here's how|tips|lessons|guide)/i,
      curiosity: /^(wait until|you won't believe|this will)/i,
    };

    for (const [type, pattern] of Object.entries(hooks)) {
      if (pattern.test(content)) return type;
    }

    return 'general';
  }

  /**
   * Analyze sentiment
   */
  private analyzeSentiment(content: string): number {
    const positive = ['amazing', 'awesome', 'love', 'great', 'excellent', 'best', 'fantastic', 'success', 'win', 'proud'];
    const negative = ['fail', 'bad', 'terrible', 'worst', 'hate', 'awful', 'disaster', 'problem', 'issue', 'struggle'];
    
    const lowerContent = content.toLowerCase();
    let positiveScore = 0;
    let negativeScore = 0;

    positive.forEach(word => {
      if (lowerContent.includes(word)) positiveScore++;
    });

    negative.forEach(word => {
      if (lowerContent.includes(word)) negativeScore++;
    });

    const total = positiveScore + negativeScore;
    if (total === 0) return 0.5;
    
    return positiveScore / total;
  }

  /**
   * Detect content type
   */
  private detectContentType(content: string): string {
    if (/\d+\.\s/.test(content)) return 'listicle';
    if (/^(pov:|imagine|me when)/i.test(content)) return 'meme';
    if (/thread|🧵/i.test(content)) return 'thread';
    if (/\?$/.test(content)) return 'question';
    if (/!$/.test(content)) return 'announcement';
    if (/https?:\/\//.test(content)) return 'link-share';
    if (/^".+"/.test(content)) return 'quote';
    
    return 'general';
  }

  /**
   * Check if content is viral
   */
  private isViral(metrics: ContentMetrics, platform: string): boolean {
    const viralThresholds = {
      twitter: 10000,
      linkedin: 5000,
      tiktok: 100000,
      instagram: 30000,
      facebook: 20000,
    };

    const threshold = viralThresholds[platform as keyof typeof viralThresholds] || 10000;
    return metrics.engagement >= threshold;
  }

  /**
   * Get performance level
   */
  private getPerformanceLevel(metrics: ContentMetrics, platform: string): string {
    const score = this.calculateViralityScore(metrics, platform);
    
    if (score >= 90) return 'exceptional';
    if (score >= 70) return 'high';
    if (score >= 50) return 'good';
    if (score >= 30) return 'average';
    return 'low';
  }

  /**
   * Save pattern to database
   */
  private async savePattern(analysis: PatternAnalysis): Promise<void> {
    try {
      await db.patterns.create({
        platform: analysis.platform,
        pattern_type: analysis.hookType,
        pattern_data: analysis as unknown as Record<string, unknown>,
        engagement_score: analysis.viralityScore,
      });
    } catch (error) {
      console.error('Error saving pattern to database:', error);
    }
  }

  /**
   * Get trending patterns
   */
  async getTrendingPatterns(platform?: string, limit = 10) {
    const patterns = await db.patterns.list(platform);
    
    // Sort by virality score and recency
    const sorted = patterns.sort((a: DatabasePattern, b: DatabasePattern) => {
      const scoreA = a.engagement_score || 0;
      const scoreB = b.engagement_score || 0;
      const dateA = new Date(a.discovered_at || Date.now()).getTime();
      const dateB = new Date(b.discovered_at || Date.now()).getTime();
      
      // Weight: 70% virality, 30% recency
      const weightedA = scoreA * 0.7 + (dateA / Date.now()) * 30;
      const weightedB = scoreB * 0.7 + (dateB / Date.now()) * 30;
      
      return weightedB - weightedA;
    });

    return sorted.slice(0, limit);
  }

  /**
   * Get pattern insights
   */
  async getInsights(platform?: string, timeRange = '7d') {
    const patterns = await db.patterns.list(platform);
    
    if (patterns.length === 0) {
      return {
        totalPatterns: 0,
        avgViralityScore: 0,
        topHookTypes: [],
        bestTimes: [],
        topHashtags: [],
      };
    }

    // Calculate insights
    const insights = {
      totalPatterns: patterns.length,
      avgViralityScore: patterns.reduce((sum: number, p: DatabasePattern) => sum + (p.engagement_score || 0), 0) / patterns.length,
      topHookTypes: this.getTopHookTypes(patterns),
      bestTimes: this.getBestPostingTimes(patterns),
      topHashtags: this.getTopHashtags(patterns),
      contentTypeDistribution: this.getContentTypeDistribution(patterns),
      platformPerformance: this.getPlatformPerformance(patterns),
    };

    return insights;
  }

  private getTopHookTypes(patterns: DatabasePattern[]): HookTypeCount[] {
    const hookCounts: Record<string, number> = {};
    
    patterns.forEach(p => {
      const hookType = p.pattern_data?.hookType || 'general';
      hookCounts[hookType] = (hookCounts[hookType] || 0) + 1;
    });

    return Object.entries(hookCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count, percentage: (count / patterns.length) * 100 }));
  }

  private getBestPostingTimes(patterns: DatabasePattern[]): PostingTimeData[] {
    const hourCounts: Record<number, { count: number; avgScore: number }> = {};
    
    patterns.forEach(p => {
      const hour = p.pattern_data?.postHour || 0;
      const score = p.engagement_score || 0;
      
      if (!hourCounts[hour]) {
        hourCounts[hour] = { count: 0, avgScore: 0 };
      }
      
      hourCounts[hour].count++;
      hourCounts[hour].avgScore = (hourCounts[hour].avgScore * (hourCounts[hour].count - 1) + score) / hourCounts[hour].count;
    });

    return Object.entries(hourCounts)
      .sort(([, a], [, b]) => b.avgScore - a.avgScore)
      .slice(0, 5)
      .map(([hour, data]) => ({ hour: parseInt(hour), ...data }));
  }

  private getTopHashtags(patterns: DatabasePattern[]): HashtagCount[] {
    const hashtagCounts: Record<string, number> = {};
    
    patterns.forEach(p => {
      const hashtags = p.pattern_data?.hasHashtags || [];
      hashtags.forEach((tag: string) => {
        hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
      });
    });

    return Object.entries(hashtagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));
  }

  private getContentTypeDistribution(patterns: DatabasePattern[]): ContentTypeDistribution[] {
    const typeCounts: Record<string, number> = {};
    
    patterns.forEach(p => {
      const type = p.pattern_data?.contentType || 'general';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    return Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count, percentage: (count / patterns.length) * 100 }));
  }

  private getPlatformPerformance(patterns: DatabasePattern[]): PlatformPerformance[] {
    const platformStats: Record<string, { count: number; avgScore: number }> = {};
    
    patterns.forEach(p => {
      const platform = p.platform;
      const score = p.engagement_score || 0;
      
      if (!platformStats[platform]) {
        platformStats[platform] = { count: 0, avgScore: 0 };
      }
      
      platformStats[platform].count++;
      platformStats[platform].avgScore = 
        (platformStats[platform].avgScore * (platformStats[platform].count - 1) + score) / 
        platformStats[platform].count;
    });

    return Object.entries(platformStats)
      .map(([platform, stats]) => ({ platform, ...stats }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }
}

// Export singleton instance
export const patternScraper = new PatternScraperService();