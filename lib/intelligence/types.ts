/**
 * Shared Intelligence Score types — SYN-669
 *
 * Establishes the shared TypeScript contract for all three Synthex scoring
 * systems (ContentScore, GEOScore, HealthScore) before any client-facing
 * surface is built. Prevents type incompatibility when the AI Advisor must
 * consume multiple scores simultaneously.
 *
 * Usage:
 *   import type { IntelligenceScore, ScoreCard, CalibrationState } from '@/lib/intelligence/types';
 */

// ── Score domain discriminant ─────────────────────────────────────────────────

/** The three client-visible scoring domains. */
export type ScoreDomain = 'content' | 'geo' | 'health';

// ── Signal ────────────────────────────────────────────────────────────────────

/**
 * A single measurable signal that contributed to a score.
 * Every score is decomposed into signals so the AI Advisor can cite evidence.
 */
export interface ScoreSignal {
  /** e.g. "data_availability", "overview_appearances", "review_responsiveness" */
  signalType: string;

  /** Proportion of total score this signal contributed (0–1, all weights sum ≤ 1) */
  weight: number;

  /** The raw measured value before normalisation */
  rawValue: number;

  /** Normalised value in 0–100 range (same scale as the composite score) */
  normalizedValue: number;

  /**
   * Data source identifier.
   * e.g. "content_performance_profiles", "geo_citations", "client_health_scores"
   */
  source: string;

  /**
   * How old is the underlying data?
   * - "fresh"       < 7 days
   * - "stale"       7–30 days
   * - "unavailable" no data found
   */
  staleness: 'fresh' | 'stale' | 'unavailable';
}

// ── Calibration ───────────────────────────────────────────────────────────────

/**
 * Describes how well-calibrated a score is — whether enough real data has
 * been collected to trust it, and what the historical accuracy rate is.
 *
 * Returned by `getScoreCalibration()` and embedded in every `IntelligenceScore`.
 */
export interface CalibrationState {
  /** Number of scored events with a measured outcome (accuracy_delta populated). */
  dataPoints: number;

  /** Whether `dataPoints` meets `thresholdRequired`. */
  meetsThreshold: boolean;

  /**
   * Minimum data points before the score is considered reliable.
   * Domain defaults: content = 10, geo = 5, health = 8.
   */
  thresholdRequired: number;

  /**
   * Fraction of past predictions within 15 percentile points of the actual
   * outcome. null when no outcomes have been measured yet.
   */
  accuracyRate: number | null;

  /** ISO-8601 timestamp of the first ever scored event for this client + domain. */
  firstScoredAt: string | null;

  /**
   * Non-empty plain-English description for client-facing UI.
   * Examples:
   *   "Based on 23 of your posts"                         (meetsThreshold = true)
   *   "Calibration in progress — collecting data from your posts"  (false)
   */
  calibrationSummary: string;
}

// ── Core score type ───────────────────────────────────────────────────────────

/**
 * The canonical representation of a Synthex intelligence score.
 *
 * Generic over the domain discriminant so callers get precise typing:
 *   const cs: IntelligenceScore<'content'> = ...
 *   const gs: IntelligenceScore<'geo'>     = ...
 *
 * A function that accepts any score:
 *   function consume(s: IntelligenceScore<string>) { ... }
 */
export interface IntelligenceScore<TDomain extends string = ScoreDomain> {
  /** Score domain — narrows the type at call sites. */
  domain: TDomain;

  /** Composite score 0–100. 0 may indicate insufficient data rather than failure. */
  value: number;

  /**
   * Confidence tier based on calibration data:
   * - "low"    < threshold data points, or accuracyRate < 0.40
   * - "medium" threshold met, accuracyRate 0.40–0.70
   * - "high"   threshold met, accuracyRate > 0.70
   */
  confidence: 'low' | 'medium' | 'high';

  /** The signals that composed this score. May be empty for cold-start clients. */
  signals: ScoreSignal[];

  /** Current calibration status for this client + domain. */
  calibration: CalibrationState;

  /** ISO-8601 timestamp when this score was computed. */
  generatedAt: string;
}

// ── ScoreCard — client-facing display layer ───────────────────────────────────

/**
 * Extends `IntelligenceScore` with display-ready fields for UI components
 * (ContentScoreCard, GEOScorePanel, HealthScoreDashboard).
 *
 * The `displayValue` and `displayLabel` are pre-formatted so UI components
 * don't need to implement formatting logic.
 */
export interface ScoreCard<TDomain extends string = ScoreDomain>
  extends IntelligenceScore<TDomain> {
  /**
   * Human-readable score for display.
   * e.g. "72", "N/A" (cold-start), "–" (unavailable)
   */
  displayValue: string;

  /**
   * Label shown beneath the score ring.
   * e.g. "Content Score", "GEO Score", "Health Score"
   */
  displayLabel: string;

  /**
   * Non-empty calibration summary for card subtitle.
   * Mirrors `calibration.calibrationSummary` — duplicated here for component convenience.
   */
  calibrationSummary: string;

  /**
   * True when the card is showing a score derived from insufficient data.
   * UI components should render a skeleton / "building data" state.
   */
  fallbackMode: boolean;
}

// ── Score issue params (used by accuracy-ledger) ──────────────────────────────

/**
 * Parameters passed to `recordScoreIssued()` in `accuracy-ledger.ts`.
 * Called as the final step in every scoring Edge Function / internal route.
 */
export interface ScoreIssueParams {
  /** Organization UUID — maps to `client_id` in score_accuracy_events. */
  clientId: string;

  domain: ScoreDomain;

  /** The composite score value that was issued (0–100). */
  scoreValue: number;

  confidence: 'low' | 'medium' | 'high';

  /** Number of data points the calibration state had at issue time. */
  calibrationDataPoints: number;

  /**
   * Domain-specific entity identifier for outcome look-up.
   * - content: organization_id (outcome measured from posts aggregate)
   * - geo:     location_id or organization_id
   * - health:  organization_id
   */
  entityId: string;

  /** Sprint version tag for regression analysis. e.g. "sprint-7" */
  sprintVersion?: string;
}
