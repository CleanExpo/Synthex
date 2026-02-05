/**
 * Competitor Analysis Types
 *
 * Extracted from CompetitorAnalysis.tsx for better modularity
 */

export interface Competitor {
  id: string;
  name: string;
  domain: string;
  logo?: string;
  description: string;
  industry: string;
  size: 'small' | 'medium' | 'large' | 'enterprise';
  metrics: CompetitorMetrics;
  socialProfiles: SocialProfile[];
  contentStrategy: ContentStrategy;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  tracking: boolean;
}

export interface CompetitorMetrics {
  followers: PlatformMetrics;
  engagement: PlatformMetrics;
  postFrequency: PlatformMetrics;
  growthRate: number;
  sentimentScore: number;
  shareOfVoice: number;
  contentPerformance: ContentPerformance;
}

export interface PlatformMetrics {
  twitter?: number;
  instagram?: number;
  linkedin?: number;
  facebook?: number;
  youtube?: number;
  tiktok?: number;
  total: number;
}

export interface SocialProfile {
  platform: string;
  handle: string;
  url: string;
  verified: boolean;
}

export interface ContentStrategy {
  topContent: ContentItem[];
  postingTimes: string[];
  contentTypes: ContentTypeDistribution[];
  hashtagStrategy: string[];
  toneOfVoice: string;
}

export interface ContentItem {
  id: string;
  platform: string;
  content: string;
  engagement: number;
  reach: number;
  date: Date;
  type: string;
}

export interface ContentTypeDistribution {
  type: string;
  percentage: number;
}

export interface ContentPerformance {
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  viralPosts: number;
}

export interface CompetitorComparisonData {
  name: string;
  followers: number;
  engagement: number;
  growth: number;
  sentiment: number;
}
