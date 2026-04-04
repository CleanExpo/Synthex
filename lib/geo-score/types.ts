/**
 * GEO Score Types — SYN-656
 *
 * Types for the client_geo_scores table: monthly normalised GEO citation
 * scores per client organisation.
 *
 * A GEO score represents how frequently a client's content is cited by AI
 * search engines (Google AIO, ChatGPT, Perplexity, Bing Copilot). The score
 * is normalised to 0–100 from raw citation counts collected during GEO dark
 * runs against the GEOAnalysis / PromptTracker data.
 *
 * @module lib/geo-score/types
 */

// ─── Core Entity ───────────────────────────────────────────────────────────────

/** A persisted monthly GEO citation score for one client organisation. */
export interface ClientGeoScore {
  /** UUID primary key */
  id: string;
  /** Organisation ID — foreign key to organizations.id */
  clientId: string;
  /**
   * Normalised GEO citation score (0–100).
   * 0 = never cited, 100 = cited in every checked query across all platforms.
   */
  score: number;
  /** Breakdown of how the score was calculated */
  scoreBreakdown: GeoScoreBreakdown;
  /** Direction of change compared to the previous month */
  trend: GeoTrend;
  /**
   * Absolute point change versus the previous month.
   * Positive = improved, negative = declined, 0 = no prior month to compare.
   */
  trendDelta: number;
  /** ISO date string — always the first day of the month (e.g. "2026-04-01") */
  month: string;
  /** ISO timestamp of row creation */
  createdAt: string;
}

// ─── Score Breakdown ───────────────────────────────────────────────────────────

/**
 * Detailed breakdown stored as JSONB in score_breakdown.
 *
 * Built from GEO dark run data:
 * - totalQueriesChecked: total PromptTracker prompts run against AI engines
 * - citationsFound: how many responses included a brand citation
 * - platformBreakdown: per-platform citation count (google_aio, chatgpt, etc.)
 */
export interface GeoScoreBreakdown {
  /** Total number of AI search queries checked during the dark run */
  totalQueriesChecked: number;
  /** Number of queries where the client's brand/content was cited */
  citationsFound: number;
  /**
   * Per-platform citation counts.
   * Keys match GEOPlatform values: 'google_aio' | 'chatgpt' | 'perplexity' | 'bing_copilot'
   */
  platformBreakdown: Record<string, number>;
}

// ─── Trend ─────────────────────────────────────────────────────────────────────

/** Direction of month-over-month score change. */
export type GeoTrend = 'up' | 'down' | 'stable';

// ─── Upsert Input ──────────────────────────────────────────────────────────────

/**
 * Input shape for creating or updating a monthly GEO score.
 * Used by the score-calculation service before writing to the DB.
 */
export interface ClientGeoScoreInput {
  clientId: string;
  score: number;
  scoreBreakdown: GeoScoreBreakdown;
  trend: GeoTrend;
  trendDelta: number;
  /** First day of the month: YYYY-MM-01 */
  month: string;
}
