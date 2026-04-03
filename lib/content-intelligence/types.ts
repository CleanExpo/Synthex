/**
 * Content Intelligence types — SYN-631
 *
 * Shared TypeScript shapes for the Content Learning Loop.
 * These mirror the JSON columns in ContentPerformanceProfile + IndustryBaseline.
 */

// ── Core scoring types ────────────────────────────────────────────────────────

/** A content topic with its avg engagement rate across all posts in a window */
export interface TopicScore {
  topic: string;
  avgEngagementRate: number;
  postCount: number;
}

/** Best UTC posting times per abbreviated day key */
export type OptimalTimes = Record<string, string[]>;

/** Format label to avg engagement rate */
export type ContentFormatScores = Record<ContentFormat, number>;

export type ContentFormat = 'video' | 'image' | 'carousel' | 'text';

// ── Profile shapes ────────────────────────────────────────────────────────────

/**
 * Normalised in-memory profile — maps directly to ContentPerformanceProfile
 * DB columns and to IndustryBaseline DB columns.
 */
export interface ContentProfile {
  topTopics: TopicScore[];
  optimalTimes: OptimalTimes;
  winningHashtags: string[];
  contentFormatScores: ContentFormatScores;
}

/**
 * Output of getContentIntelligence() — the blended profile returned to callers.
 * Includes the confidence level so callers can decide how heavily to weight it.
 */
export interface BlendedContentIntelligence extends ContentProfile {
  /** 0.0–1.0. Weight applied to org signals vs industry baseline. */
  confidenceLevel: number;
  /** Number of published posts analysed for this org. */
  postCount: number;
  /** Industry slug used for the baseline fallback. */
  industry: string;
}

// ── Topic extraction ──────────────────────────────────────────────────────────

/** Input post data for topic extraction */
export interface PostForClassification {
  id: string;
  content: string;
  hashtags: string[];
  engagementRate: number;
  format: ContentFormat;
  /** UTC ISO string */
  publishedAt: string;
}

/** Claude Haiku response per post */
export interface PostClassification {
  postId: string;
  topics: string[];
  format: ContentFormat;
  dayOfWeek: string;
  hourUtc: number;
  engagementRate: number;
  hashtags: string[];
}
