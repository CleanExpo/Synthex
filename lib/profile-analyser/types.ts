/**
 * Profile Analyser — shared types.
 *
 * Supports LinkedIn and Facebook profiles scraped via Apify.
 */

export type ProfilePlatform = 'linkedin' | 'facebook';

export interface ProfileAnalysisRequest {
  platform: ProfilePlatform;
  /** Public profile URL or username */
  profileUrl: string;
}

export interface EngagementMetrics {
  averageLikes: number;
  averageComments: number;
  averageShares: number;
  /** Engagement rate as a percentage (0–100) */
  engagementRate: number;
  topPostType: string;
}

export interface ContentInsights {
  postingFrequency: string; // e.g. "3–4 times/week"
  primaryTopics: string[];
  contentMix: {
    text: number;
    image: number;
    video: number;
    link: number;
  };
  bestPostingTime: string;
  recommendedHashtags: string[];
}

export interface ProfileScore {
  overall: number; // 0–100
  profileCompleteness: number;
  contentConsistency: number;
  audienceEngagement: number;
  growthVelocity: number;
}

export interface ProfileAnalysisResult {
  platform: ProfilePlatform;
  profileUrl: string;
  scrapedAt: string;

  // Basic profile info
  displayName: string;
  headline?: string;
  followersCount: number;
  connectionsCount?: number; // LinkedIn only
  postsAnalysed: number;

  score: ProfileScore;
  engagement: EngagementMetrics;
  content: ContentInsights;

  /** Actionable recommendations ranked by impact */
  recommendations: string[];

  /** Raw posts for reference (capped at 10) */
  recentPosts: Array<{
    text: string;
    likes: number;
    comments: number;
    postedAt: string;
  }>;
}
