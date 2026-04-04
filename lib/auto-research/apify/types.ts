/**
 * Auto-Research Apify Types
 *
 * Typed data structures for scraped social media content.
 */

export type SupportedPlatform =
  | 'instagram'
  | 'tiktok'
  | 'linkedin'
  | 'twitter'
  | 'facebook'
  | 'google';

export type InsightCategory =
  | 'hook'
  | 'visual_style'
  | 'hashtag'
  | 'topic'
  | 'format'
  | 'cta';

/** A single post or piece of content scraped from a social platform */
export interface ScrapedPost {
  platform: SupportedPlatform;
  url: string;
  content: string;
  /** Total engagements (likes + comments + shares + saves) */
  engagementCount: number;
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  hashtags?: string[];
  timestamp: string; // ISO 8601
  authorHandle?: string;
  viewCount?: number;
}

/** A trending keyword or topic extracted from Google or social platforms */
export interface ScrapedTrend {
  keyword: string;
  volume?: number;
  platform: SupportedPlatform;
  timestamp: string; // ISO 8601
}
