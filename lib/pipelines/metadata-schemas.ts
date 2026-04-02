/**
 * Pipeline output metadata schemas — SYN-626
 *
 * TypeScript interfaces for the `output_metadata` JSONB field written by
 * each pipeline's validateOutput() hook to edge_function_logs.
 *
 * These interfaces make output_metadata queryable and type-safe.
 * Populate concrete fields as each pipeline implements validateOutput().
 *
 * Query example (attribution accuracy gate):
 *   SELECT AVG((output_metadata->>'accuracy_score')::float)
 *   FROM edge_function_logs
 *   WHERE function_name = 'attribution-validation'
 *     AND created_at > NOW() - INTERVAL '7 days';
 */

// ============================================================================
// AI Advisor Pipeline (SYN-593)
// ============================================================================

/**
 * Metadata written by the AI Advisor inference pipeline validateOutput().
 * Status 'partial' if any client receives < 3 recommendations or avg_confidence < 0.5.
 */
export interface AiAdvisorMetadata extends Record<string, unknown> {
  /** Total recommended actions generated across all clients */
  recommendation_count: number;
  /** Average confidence score across all recommendations (0.0–1.0) */
  avg_confidence: number;
  /** Days since the algorithm knowledge base was last refreshed */
  algorithm_freshness_days: number;
}

// ============================================================================
// Health Score Pipeline (SYN-611)
// ============================================================================

/**
 * Metadata written by the Health Score computation pipeline validateOutput().
 * Status 'partial' if any dimension score falls outside 0-100 bounds.
 */
export interface HealthScoreMetadata extends Record<string, unknown> {
  /** Per-dimension scores keyed by dimension name */
  dimension_scores: Record<string, number>;
  /** Composite weighted score (0-100) */
  composite_score: number;
  /** Number of clients with composite score below intervention threshold (35) */
  clients_below_threshold: number;
}

// ============================================================================
// Attribution Validation Pipeline (SYN-622)
// ============================================================================

/**
 * Metadata written by the Attribution validation pipeline validateOutput().
 * Status 'partial' if accuracy_score < 0.80 (the Sprint 6 ROI Dashboard gate).
 *
 * CI check blocks ROI Dashboard deployment if:
 *   AVG(output_metadata->>'accuracy_score') < 0.80 over last 7 days across 3 clients.
 */
export interface AttributionMetadata extends Record<string, unknown> {
  /** Fraction of events matched (0.0–1.0). Gate: >= 0.80 to unblock Sprint 6. */
  accuracy_score: number;
  /** Number of conversion events that matched tracked content */
  matched_events: number;
  /** Total conversion events in the validation window */
  total_events: number;
  /** Breakdown of why events didn't match */
  unmatched_reasons: Record<string, number>;
}

// ============================================================================
// Existing pipeline metadata (populated in SYN-628)
// ============================================================================

/**
 * Metadata written by the Auto-Calendar pipeline validateOutput().
 * Placeholder — populated when Auto-Calendar is migrated to runner factory.
 */
export interface AutoCalendarMetadata extends Record<string, unknown> {
  posts_scheduled: number;
  posts_failed: number;
  avg_content_length: number;
}

/**
 * Metadata written by the Review Intelligence pipeline validateOutput().
 * Migrated to runner factory in SYN-628.
 */
export interface ReviewIntelligenceMetadata extends Record<string, unknown> {
  reviews_processed: number;
  responses_drafted: number;
  avg_confidence: number;
}

/**
 * Metadata written by the Seasonal Engine pipeline validateOutput().
 * Migrated to runner factory in SYN-628.
 */
export interface SeasonalEngineMetadata extends Record<string, unknown> {
  signals_generated: number;
  avg_relevance: number;
  next_season_window: string;
}

// ============================================================================
// Content Learning Loop (SYN-631)
// ============================================================================

/**
 * Metadata written by the Content Profile computation pipeline validateOutput().
 * Status 'partial' if orgs_processed == 0.
 */
export interface ContentProfileMetadata extends Record<string, unknown> {
  /** Total orgs processed in this run */
  orgs_processed: number;
  /** Orgs skipped (no posts or not found) */
  orgs_skipped: number;
  /** Average confidence level across all computed profiles (0.0–1.0) */
  avg_confidence: number;
}
