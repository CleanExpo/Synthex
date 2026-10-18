/**
 * Competitive Intelligence Service
 *
 * @description Analyze competitors and benchmark performance
 *
 * FAILURE MODE: the competitors table (and its competitor_profiles,
 * competitor_content and competitor_metrics companions) is not in
 * prisma/schema.prisma, so every method throws
 * CompetitiveIntelNotProvisionedError. Nothing is read or saved; no method
 * returns empty results in place of a failed read.
 */

import {
  FEATURE_NOT_PROVISIONED,
  notProvisionedBody,
} from '@/lib/api/not-provisioned';

export type Platform =
  | 'instagram'
  | 'twitter'
  | 'tiktok'
  | 'linkedin'
  | 'facebook'
  | 'youtube';

export interface Competitor {
  id: string;
  userId: string;
  name: string;
  handles: Record<Platform, string>;
  website?: string;
  industry?: string;
  notes?: string;
  isActive: boolean;
  addedAt: Date;
  lastAnalyzedAt?: Date;
}

export interface CompetitorProfile {
  competitorId: string;
  platform: Platform;
  handle: string;
  displayName?: string;
  bio?: string;
  followers: number;
  following: number;
  totalPosts: number;
  avgEngagementRate: number;
  postingFrequency: number; // Posts per week
  topHashtags: string[];
  topMentions: string[];
  contentMix: {
    type: string;
    percentage: number;
  }[];
  peakPostingTimes: {
    dayOfWeek: number;
    hour: number;
    engagement: number;
  }[];
  growthRate: {
    followers: number;
    engagement: number;
  };
  lastUpdated: Date;
}

export interface ContentAnalysis {
  competitorId: string;
  platform: Platform;
  postId: string;
  postedAt: Date;
  contentType: 'image' | 'video' | 'carousel' | 'text' | 'story' | 'reel';
  caption?: string;
  hashtags: string[];
  mentions: string[];
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    saves?: number;
    views?: number;
  };
  engagementRate: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  themes: string[];
  callToAction?: string;
  performanceScore: number; // 0-100 relative to their average
}

export interface BenchmarkReport {
  userId: string;
  generatedAt: Date;
  period: { start: Date; end: Date };
  competitors: string[];
  platforms: Platform[];
  metrics: {
    your: MetricSet;
    industryAvg: MetricSet;
    topPerformer: MetricSet;
    bottomPerformer: MetricSet;
  };
  rankings: {
    metric: string;
    yourRank: number;
    totalCompetitors: number;
    percentile: number;
  }[];
  gaps: {
    metric: string;
    yourValue: number;
    benchmarkValue: number;
    gap: number;
    gapPercent: number;
    priority: 'high' | 'medium' | 'low';
    recommendations: string[];
  }[];
  opportunities: string[];
  threats: string[];
}

interface MetricSet {
  followers: number;
  followersGrowth: number;
  avgEngagementRate: number;
  postsPerWeek: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  videoViews?: number;
  reachRate?: number;
}

export interface HashtagAnalysis {
  hashtag: string;
  usedByCompetitors: string[];
  totalUses: number;
  avgEngagement: number;
  trend: 'rising' | 'stable' | 'declining';
  recommendation: 'adopt' | 'monitor' | 'avoid';
  reason: string;
}

export interface ContentGap {
  topic: string;
  competitorsCovering: string[];
  avgEngagement: number;
  yourCoverage: boolean;
  opportunity: 'high' | 'medium' | 'low';
  suggestedApproach: string;
}

export interface SentimentComparison {
  competitor: string;
  platform: Platform;
  overallSentiment: number; // -1 to 1
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  topPositiveThemes: string[];
  topNegativeThemes: string[];
  responseRate: number;
  avgResponseTime: number; // hours
}

export class CompetitiveIntelNotProvisionedError extends Error {
  readonly code = FEATURE_NOT_PROVISIONED;
  readonly table = 'competitors';

  constructor() {
    super(
      notProvisionedBody('competitors', 'Competitive intelligence').message
    );
    this.name = 'CompetitiveIntelNotProvisionedError';
  }
}

const competitorsUnavailable = (): Promise<never> =>
  Promise.reject(new CompetitiveIntelNotProvisionedError());

class CompetitiveIntelligence {
  async addCompetitor(
    userId: string,
    data: {
      name: string;
      handles: Partial<Record<Platform, string>>;
      website?: string;
      industry?: string;
      notes?: string;
    }
  ): Promise<Competitor> {
    return competitorsUnavailable();
  }

  async getCompetitors(
    userId: string,
    options: {
      activeOnly?: boolean;
      platform?: Platform;
    } = {}
  ): Promise<Competitor[]> {
    return competitorsUnavailable();
  }

  async getCompetitorProfile(
    competitorId: string,
    platform: Platform
  ): Promise<CompetitorProfile | null> {
    return competitorsUnavailable();
  }

  async analyzeCompetitorContent(
    competitorId: string,
    platform: Platform,
    options: {
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<ContentAnalysis[]> {
    return competitorsUnavailable();
  }

  async generateBenchmarkReport(
    userId: string,
    options: {
      competitorIds?: string[];
      platforms?: Platform[];
      period?: { start: Date; end: Date };
    } = {}
  ): Promise<BenchmarkReport> {
    return competitorsUnavailable();
  }

  async analyzeHashtags(
    userId: string,
    platform: Platform,
    options: {
      competitorIds?: string[];
      limit?: number;
    } = {}
  ): Promise<HashtagAnalysis[]> {
    return competitorsUnavailable();
  }

  async identifyContentGaps(
    userId: string,
    platform: Platform,
    options: {
      competitorIds?: string[];
    } = {}
  ): Promise<ContentGap[]> {
    return competitorsUnavailable();
  }

  async compareSentiment(
    userId: string,
    platform: Platform,
    options: {
      competitorIds?: string[];
    } = {}
  ): Promise<SentimentComparison[]> {
    return competitorsUnavailable();
  }

  async getStrategicInsights(
    userId: string,
    options: {
      platforms?: Platform[];
    } = {}
  ): Promise<{
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
    actionItems: { priority: 'high' | 'medium' | 'low'; action: string }[];
  }> {
    return competitorsUnavailable();
  }
}

export const competitiveIntel = new CompetitiveIntelligence();
