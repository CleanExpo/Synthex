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
// Score Accuracy Matcher (SYN-670)
// ============================================================================

/**
 * Metadata written by the score-accuracy-matcher pipeline validateOutput().
 * Status 'partial' if match_failures > 0.10 * events_queued.
 */
export interface ScoreAccuracyMatcherMetadata extends Record<string, unknown> {
  /** Total score_accuracy_events rows eligible for outcome matching this run */
  events_queued: number;
  /** Successfully matched and updated */
  events_matched: number;
  /** Failed to fetch outcome (platform data unavailable) */
  match_failures: number;
  /** Per-domain breakdown: { content: X, geo: Y, health: Z } */
  domain_breakdown: Record<string, number>;
}

// ============================================================================
// Knowledge Graph Builder (SYN-649)
// ============================================================================

/**
 * Metadata written by the Knowledge Graph build pipeline validateOutput().
 * Status 'partial' if orgs_processed == 0.
 */
export interface KnowledgeGraphBuildMetadata extends Record<string, unknown> {
  /** Total orgs processed in this run */
  orgs_processed: number;
  /** Orgs skipped (no data or failed) */
  orgs_skipped: number;
  /** Total entities created or updated across all orgs */
  total_entities: number;
  /** Total edges created or updated across all orgs */
  total_edges: number;
  /** Total OpenAI embedding tokens consumed */
  embedding_tokens: number;
  /** Total embedding cost in USD (text-embedding-3-small @ $0.02/1M tokens) */
  embedding_cost_usd: number;
  /** Number of orgs that exceeded the $0.10/run cost alert threshold */
  cost_alerts: number;
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
  /**
   * Average improvement rate across orgs with enough comparison data.
   * (informed_avg_engagement - baseline_avg_engagement) / baseline_avg_engagement.
   * null when no orgs have comparison data yet — SYN-632
   */
  avg_improvement_rate: number | null;
}

// ============================================================================
// Content Score Pipeline (SYN-664)
// ============================================================================

/**
 * Metadata written by the Content Score computation pipeline validateOutput().
 * Status 'partial' if orgs_processed == 0 or avg_score is outside 0-100.
 */
export interface ContentScoreMetadata extends Record<string, unknown> {
  /** Total orgs processed with a ContentPerformanceProfile in this run */
  orgs_processed: number;
  /** Orgs skipped (no ContentPerformanceProfile) */
  orgs_skipped: number;
  /** Average content score across all processed orgs (0-100) */
  avg_score: number;
  /**
   * True during the data-build phase when fewer than MIN_ENTITY_THRESHOLD
   * orgs have profiles — pipeline runs but scores are informational only.
   */
  dark_run_mode: boolean;
}
