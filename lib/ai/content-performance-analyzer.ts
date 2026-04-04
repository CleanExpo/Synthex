/**
 * Content Performance Analyzer
 *
 * @description Analyzes historical post performance to identify patterns
 * in high-performing content and generate actionable insights.
 *
 * Key features:
 * - Pattern detection: best days, hours, hashtags, content length
 * - AI-powered insights via OpenRouter
 * - Content type categorization
 *
 * @module lib/ai/content-performance-analyzer
 */

import { OpenRouterClient } from './openrouter-client';
import { logger } from '@/lib/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface PostPerformance {
  postId: string;
  platform: string;
  content: string;
  hashtags: string[];
  publishedAt: Date;
  metrics: {
    likes: number;
    comments: number;
    shares: number;
    impressions: number;
    engagementRate: number;
  };
}

export interface PerformanceInsight {
  type: 'topic' | 'format' | 'timing' | 'hashtag' | 'length';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  recommendation: string;
  evidence: string[];
}

export interface ContentPerformanceAnalysis {
  summary: {
    totalPosts: number;
    avgEngagement: number;
    topPerforming: PostPerformance[];
    lowPerforming: PostPerformance[];
  };
  patterns: {
    bestDays: Array<{ day: string; avgEngagement: number }>;
    bestHours: Array<{ hour: number; avgEngagement: number }>;
    bestLength: { min: number; max: number; avgEngagement: number };
    topHashtags: Array<{ tag: string; avgEngagement: number; count: number }>;
  };
  insights: PerformanceInsight[];
  contentTypes: Array<{
    type: string;
    count: number;
    avgEngagement: number;
    trend: 'up' | 'down' | 'stable';
  }>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const CONTENT_TYPE_PATTERNS: Array<{ type: string; patterns: RegExp[] }> = [
  { type: 'question', patterns: [/\?$/, /^(what|how|why|when|where|who|which|do you|have you|can you)/i] },
  { type: 'list', patterns: [/^\d+[\.\)]/m, /^[-•]/m, /\d+\s+(tips|ways|reasons|things|steps)/i] },
  { type: 'story', patterns: [/^(i |my |we |our )/i, /(happened|learned|realized|discovered)/i] },
  { type: 'announcement', patterns: [/^(introducing|announcing|new|launch|excited to)/i, /🎉|🚀|📣/] },
  { type: 'educational', patterns: [/^(how to|guide|tutorial|learn|tip:|pro tip)/i, /(here's how|did you know)/i] },
  { type: 'promotional', patterns: [/(sale|discount|offer|deal|limited time|link in bio)/i, /(use code|shop now|buy now)/i] },
  { type: 'engagement', patterns: [/(tag someone|comment below|share this|double tap|let me know)/i] },
];

// =============================================================================
// HELPERS
// =============================================================================

function detectContentType(content: string): string {
  const lowerContent = content.toLowerCase();

  for (const { type, patterns } of CONTENT_TYPE_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(content) || pattern.test(lowerContent)) {
        return type;
      }
    }
  }

  return 'statement';
}

function getEngagementScore(metrics: PostPerformance['metrics']): number {
  // Use engagement rate if available, otherwise calculate from metrics
  if (metrics.engagementRate && metrics.engagementRate > 0) {
    return metrics.engagementRate;
  }

  // Fallback: weighted engagement calculation
  const totalEngagement = metrics.likes + (metrics.comments * 2) + (metrics.shares * 3);
  const impressions = metrics.impressions || 1;
  return (totalEngagement / impressions) * 100;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// =============================================================================
// ANALYZER CLASS
// =============================================================================

export class ContentPerformanceAnalyzer {
  private openRouter: OpenRouterClient;

  constructor() {
    this.openRouter = new OpenRouterClient();
  }

  /**
   * Analyze post performance patterns
   */
  async analyze(posts: PostPerformance[]): Promise<ContentPerformanceAnalysis> {
    if (posts.length === 0) {
      return this.emptyAnalysis();
    }

    // Calculate engagement scores
    const postsWithScores = posts.map((post) => ({
      ...post,
      engagementScore: getEngagementScore(post.metrics),
    }));

    // Sort by engagement
    const sorted = [...postsWithScores].sort((a, b) => b.engagementScore - a.engagementScore);

    // Get top/bottom 10%
    const top10Percent = Math.max(1, Math.ceil(posts.length * 0.1));
    const topPerforming = sorted.slice(0, top10Percent);
    const lowPerforming = sorted.slice(-top10Percent).reverse();

    // Calculate average engagement
    const avgEngagement =
      postsWithScores.reduce((sum, p) => sum + p.engagementScore, 0) / posts.length;

    // Analyze patterns
    const patterns = this.analyzePatterns(postsWithScores);

    // Categorize content types
    const contentTypes = this.analyzeContentTypes(postsWithScores);

    // Generate basic insights (non-AI)
    const insights = this.generateBasicInsights(patterns, contentTypes, avgEngagement);

    return {
      summary: {
        totalPosts: posts.length,
        avgEngagement: Math.round(avgEngagement * 100) / 100,
        topPerforming: topPerforming.map(({ engagementScore, ...post }) => post),
        lowPerforming: lowPerforming.map(({ engagementScore, ...post }) => post),
      },
      patterns,
      insights,
      contentTypes,
    };
  }

  /**
   * Generate AI-powered insights
   */
  async generateAIInsights(analysis: ContentPerformanceAnalysis): Promise<PerformanceInsight[]> {
    try {
      const prompt = this.buildAIPrompt(analysis);

      const response = await this.openRouter.complete({
        model: this.openRouter.models.balanced,
        messages: [
          {
            role: 'system',
            content: `You are a social media performance analyst. Analyze the provided data and return exactly 3-5 actionable insights in JSON format. Each insight should have: type (topic|format|timing|hashtag|length), title (short), description (1-2 sentences), impact (high|medium|low), recommendation (specific action), evidence (2-3 data points).`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content || '[]';

      // Parse JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as PerformanceInsight[];
        return parsed.slice(0, 5);
      }

      return [];
    } catch (error) {
      logger.error('Failed to generate AI insights:', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private emptyAnalysis(): ContentPerformanceAnalysis {
    return {
      summary: {
        totalPosts: 0,
        avgEngagement: 0,
        topPerforming: [],
        lowPerforming: [],
      },
      patterns: {
        bestDays: [],
        bestHours: [],
        bestLength: { min: 0, max: 0, avgEngagement: 0 },
        topHashtags: [],
      },
      insights: [],
      contentTypes: [],
    };
  }

  private analyzePatterns(
    posts: Array<PostPerformance & { engagementScore: number }>
  ): ContentPerformanceAnalysis['patterns'] {
    // Best days
    const dayEngagements: Record<string, number[]> = {};
    DAYS_OF_WEEK.forEach((day) => (dayEngagements[day] = []));

    // Best hours
    const hourEngagements: Record<number, number[]> = {};
    for (let h = 0; h < 24; h++) hourEngagements[h] = [];

    // Hashtag performance
    const hashtagEngagements: Record<string, { total: number; count: number }> = {};

    // Content length analysis
    const lengthEngagements: Array<{ length: number; engagement: number }> = [];

    for (const post of posts) {
      const date = new Date(post.publishedAt);
      const day = DAYS_OF_WEEK[date.getDay()];
      const hour = date.getHours();

      dayEngagements[day].push(post.engagementScore);
      hourEngagements[hour].push(post.engagementScore);

      // Track hashtags
      for (const tag of post.hashtags) {
        const normalized = tag.toLowerCase().replace(/^#/, '');
        if (!hashtagEngagements[normalized]) {
          hashtagEngagements[normalized] = { total: 0, count: 0 };
        }
        hashtagEngagements[normalized].total += post.engagementScore;
        hashtagEngagements[normalized].count += 1;
      }

      // Track content length
      lengthEngagements.push({
        length: post.content.length,
        engagement: post.engagementScore,
      });
    }

    // Calculate averages for days
    const bestDays = DAYS_OF_WEEK.map((day) => ({
      day,
      avgEngagement:
        dayEngagements[day].length > 0
          ? Math.round(
              (dayEngagements[day].reduce((a, b) => a + b, 0) / dayEngagements[day].length) * 100
            ) / 100
          : 0,
    })).sort((a, b) => b.avgEngagement - a.avgEngagement);

    // Calculate averages for hours
    const bestHours = Object.entries(hourEngagements)
      .map(([hour, engagements]) => ({
        hour: parseInt(hour),
        avgEngagement:
          engagements.length > 0
            ? Math.round((engagements.reduce((a, b) => a + b, 0) / engagements.length) * 100) / 100
            : 0,
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement);

    // Calculate top hashtags
    const topHashtags = Object.entries(hashtagEngagements)
      .filter(([, data]) => data.count >= 2) // Min 2 uses
      .map(([tag, data]) => ({
        tag,
        avgEngagement: Math.round((data.total / data.count) * 100) / 100,
        count: data.count,
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 10);

    // Calculate best length range (top 25% performers)
    const sortedByEngagement = [...lengthEngagements].sort((a, b) => b.engagement - a.engagement);
    const top25 = sortedByEngagement.slice(0, Math.ceil(sortedByEngagement.length * 0.25));
    const lengths = top25.map((l) => l.length);
    const bestLength = {
      min: lengths.length > 0 ? Math.min(...lengths) : 0,
      max: lengths.length > 0 ? Math.max(...lengths) : 0,
      avgEngagement:
        top25.length > 0
          ? Math.round((top25.reduce((sum, l) => sum + l.engagement, 0) / top25.length) * 100) / 100
          : 0,
    };

    return { bestDays, bestHours, bestLength, topHashtags };
  }

  private analyzeContentTypes(
    posts: Array<PostPerformance & { engagementScore: number }>
  ): ContentPerformanceAnalysis['contentTypes'] {
    const typeData: Record<string, { engagements: number[]; recent: number[]; older: number[] }> = {};

    const midpoint = posts.length / 2;
    const sortedByDate = [...posts].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    sortedByDate.forEach((post, index) => {
      const type = detectContentType(post.content);
      if (!typeData[type]) {
        typeData[type] = { engagements: [], recent: [], older: [] };
      }
      typeData[type].engagements.push(post.engagementScore);
      if (index < midpoint) {
        typeData[type].recent.push(post.engagementScore);
      } else {
        typeData[type].older.push(post.engagementScore);
      }
    });

    return Object.entries(typeData)
      .map(([type, data]) => {
        const avgEngagement =
          data.engagements.length > 0
            ? Math.round((data.engagements.reduce((a, b) => a + b, 0) / data.engagements.length) * 100) / 100
            : 0;

        const recentAvg =
          data.recent.length > 0
            ? data.recent.reduce((a, b) => a + b, 0) / data.recent.length
            : 0;
        const olderAvg =
          data.older.length > 0 ? data.older.reduce((a, b) => a + b, 0) / data.older.length : 0;

        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (data.recent.length >= 2 && data.older.length >= 2) {
          const diff = recentAvg - olderAvg;
          if (diff > avgEngagement * 0.1) trend = 'up';
          else if (diff < -avgEngagement * 0.1) trend = 'down';
        }

        return {
          type,
          count: data.engagements.length,
          avgEngagement,
          trend,
        };
      })
      .sort((a, b) => b.avgEngagement - a.avgEngagement);
  }

  private generateBasicInsights(
    patterns: ContentPerformanceAnalysis['patterns'],
    contentTypes: ContentPerformanceAnalysis['contentTypes'],
    avgEngagement: number
  ): PerformanceInsight[] {
    const insights: PerformanceInsight[] = [];

    // Best day insight
    if (patterns.bestDays.length > 0) {
      const best = patterns.bestDays[0];
      const worst = patterns.bestDays[patterns.bestDays.length - 1];
      if (best.avgEngagement > worst.avgEngagement * 1.2) {
        insights.push({
          type: 'timing',
          title: `${best.day} is your best day`,
          description: `Posts on ${best.day} get ${Math.round((best.avgEngagement / worst.avgEngagement - 1) * 100)}% more engagement than ${worst.day}.`,
          impact: best.avgEngagement > avgEngagement * 1.3 ? 'high' : 'medium',
          recommendation: `Schedule your most important content for ${best.day}.`,
          evidence: [
            `${best.day}: ${best.avgEngagement}% avg engagement`,
            `${worst.day}: ${worst.avgEngagement}% avg engagement`,
          ],
        });
      }
    }

    // Best hour insight
    if (patterns.bestHours.length > 0) {
      const topHours = patterns.bestHours.slice(0, 3);
      if (topHours[0].avgEngagement > avgEngagement * 1.2) {
        const hourStr = topHours
          .map((h) => `${h.hour % 12 || 12}${h.hour < 12 ? 'am' : 'pm'}`)
          .join(', ');
        insights.push({
          type: 'timing',
          title: 'Optimal posting hours identified',
          description: `Your audience is most active around ${hourStr}.`,
          impact: 'medium',
          recommendation: `Schedule posts between ${topHours[0].hour}:00 and ${(topHours[0].hour + 1) % 24}:00 for best results.`,
          evidence: topHours.map((h) => `${h.hour}:00 - ${h.avgEngagement}% avg engagement`),
        });
      }
    }

    // Top hashtags insight
    if (patterns.topHashtags.length >= 3) {
      const topTags = patterns.topHashtags.slice(0, 3);
      insights.push({
        type: 'hashtag',
        title: 'High-performing hashtags found',
        description: `These hashtags consistently drive engagement above average.`,
        impact: topTags[0].avgEngagement > avgEngagement * 1.5 ? 'high' : 'medium',
        recommendation: `Include #${topTags[0].tag} in your posts when relevant.`,
        evidence: topTags.map((t) => `#${t.tag}: ${t.avgEngagement}% avg (${t.count} uses)`),
      });
    }

    // Content type insight
    const topType = contentTypes[0];
    if (topType && topType.count >= 3 && topType.avgEngagement > avgEngagement * 1.2) {
      insights.push({
        type: 'format',
        title: `${topType.type.charAt(0).toUpperCase() + topType.type.slice(1)} content works best`,
        description: `Your ${topType.type} posts outperform other content types.`,
        impact: topType.avgEngagement > avgEngagement * 1.5 ? 'high' : 'medium',
        recommendation: `Create more ${topType.type}-style content to boost engagement.`,
        evidence: [
          `${topType.type}: ${topType.avgEngagement}% avg engagement`,
          `${topType.count} posts analyzed`,
          `Trend: ${topType.trend}`,
        ],
      });
    }

    // Content length insight
    if (patterns.bestLength.max > 0) {
      insights.push({
        type: 'length',
        title: 'Optimal content length',
        description: `Posts between ${patterns.bestLength.min}-${patterns.bestLength.max} characters perform best.`,
        impact: 'low',
        recommendation: `Aim for ${Math.round((patterns.bestLength.min + patterns.bestLength.max) / 2)} characters in your posts.`,
        evidence: [
          `Best performing range: ${patterns.bestLength.min}-${patterns.bestLength.max} chars`,
          `Avg engagement in range: ${patterns.bestLength.avgEngagement}%`,
        ],
      });
    }

    return insights;
  }

  private buildAIPrompt(analysis: ContentPerformanceAnalysis): string {
    return `Analyze this social media performance data and provide actionable insights:

SUMMARY:
- Total posts analyzed: ${analysis.summary.totalPosts}
- Average engagement: ${analysis.summary.avgEngagement}%

BEST PERFORMING DAYS:
${analysis.patterns.bestDays.slice(0, 3).map((d) => `- ${d.day}: ${d.avgEngagement}%`).join('\n')}

BEST PERFORMING HOURS:
${analysis.patterns.bestHours.slice(0, 5).map((h) => `- ${h.hour}:00: ${h.avgEngagement}%`).join('\n')}

TOP HASHTAGS:
${analysis.patterns.topHashtags.slice(0, 5).map((t) => `- #${t.tag}: ${t.avgEngagement}% (${t.count} uses)`).join('\n')}

CONTENT TYPES:
${analysis.contentTypes.slice(0, 5).map((t) => `- ${t.type}: ${t.avgEngagement}% avg, ${t.count} posts, trend: ${t.trend}`).join('\n')}

OPTIMAL LENGTH:
- Best range: ${analysis.patterns.bestLength.min}-${analysis.patterns.bestLength.max} characters

Based on this data, provide 3-5 specific, actionable insights that will help improve content performance. Focus on patterns that show clear opportunities for improvement. Return as JSON array.`;
  }
}

export default ContentPerformanceAnalyzer;
