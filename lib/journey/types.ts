/**
 * Client Journey Events — TypeScript types — SYN-660
 *
 * Mirrors the `client_journey_events` table created in
 * prisma/migration-2026-04-04-syn660-client-journey-events.sql.
 *
 * Priority order (highest first) for simultaneous event resolution:
 *   quarterly_milestone_review > geo_score_introduced > thirty_day_check_in
 *   > win_notification > personalisation_activated
 *
 * monthly_story events are low-ceremony and excluded from the 14-day throttle.
 */

// ── Event taxonomy ────────────────────────────────────────────────────────────

export type JourneyEventType =
  | 'personalisation_activated'
  | 'win_notification'
  | 'geo_score_introduced'
  | 'thirty_day_check_in'
  | 'quarterly_milestone_review'
  | 'monthly_story';

/** Priority order — index 0 = highest. Used when multiple events are eligible simultaneously. */
export const JOURNEY_EVENT_PRIORITY: JourneyEventType[] = [
  'quarterly_milestone_review',
  'geo_score_introduced',
  'thirty_day_check_in',
  'win_notification',
  'personalisation_activated',
  // monthly_story is not included — it never competes with major moments
];

// ── Table row ─────────────────────────────────────────────────────────────────

export interface ClientJourneyEvent {
  id: string;
  client_id: string;
  event_type: JourneyEventType;
  delivered_at: string; // ISO timestamp
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type ClientJourneyEventInsert = Omit<ClientJourneyEvent, 'id' | 'created_at'>;

// ── RPC return types ──────────────────────────────────────────────────────────

/**
 * Return type of `should_deliver_journey_event(client_id, event_type)`.
 * True when no major journey event was delivered in the last 14 days.
 * (monthly_story does not count toward the 14-day window.)
 */
export type ShouldDeliverResult = boolean;

/**
 * Return type of `quarterly_review_ready(client_id)`.
 * Integer 0–5: count of data availability conditions met.
 * Callers gate on >= 3 before triggering the Quarterly Milestone Review.
 *
 * Conditions:
 *  1. Has published posts
 *  2. GEO Score: >= 4 data points
 *  3. Content profiles: >= 8 rows
 *  4. Attribution confidence >= 0.80
 *  5. Authority scores: >= 2 rows
 */
export type QuarterlyReviewReadinessScore = 0 | 1 | 2 | 3 | 4 | 5;

/** Threshold to trigger quarterly review send */
export const QUARTERLY_REVIEW_THRESHOLD = 3;

// ── Service helpers ───────────────────────────────────────────────────────────

/**
 * Check whether a journey event should be delivered for a client.
 * Calls the `should_deliver_journey_event` Supabase RPC.
 *
 * Returns false on RPC error (safe default — do not deliver if gate is uncertain).
 */
export async function shouldDeliverJourneyEvent(
  supabaseAdmin: { rpc: (fn: string, params: Record<string, string>) => PromiseLike<{ data: boolean | null; error: { message: string } | null }> },
  clientId: string,
  eventType: JourneyEventType
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('should_deliver_journey_event', {
    p_client_id: clientId,
    p_event_type: eventType,
  });

  if (error) {
    return false; // Safe default: don't deliver if gate is uncertain
  }

  return data === true;
}

/**
 * Check quarterly review data readiness for a client.
 * Returns 0 on RPC error (safe default — do not trigger if readiness is uncertain).
 */
export async function getQuarterlyReviewReadiness(
  supabaseAdmin: { rpc: (fn: string, params: Record<string, string>) => PromiseLike<{ data: number | null; error: { message: string } | null }> },
  clientId: string
): Promise<QuarterlyReviewReadinessScore> {
  const { data, error } = await supabaseAdmin.rpc('quarterly_review_ready', {
    p_client_id: clientId,
  });

  if (error || data === null) {
    return 0;
  }

  return Math.max(0, Math.min(5, data)) as QuarterlyReviewReadinessScore;
}
