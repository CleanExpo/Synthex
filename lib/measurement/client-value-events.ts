/**
 * Client Value Measurement Layer — event schema — SYN-724
 *
 * Shared schema for measuring the value of Synthex's 7 shipped client-value
 * features. Previously each feature emitted ad-hoc events (`digest_viewed`,
 * `calendar_slot_generated`, no events at all for Monthly Story) — impossible
 * to compare features or compute a cross-feature scorecard.
 *
 * This module defines the canonical shape. Every client-value feature —
 * existing or new — emits through `emit()` in `./emit.ts` and uses the
 * literal unions below.
 *
 * No schema changes: events write into the existing
 * `client_engagement_events` table (SYN-612) with `eventType = 'cvml'` and
 * the feature + CVML-event details carried in `eventData`. The Weekly Slack
 * Scorecard (SYN-725) and client_value_scorecard materialised view
 * aggregate on those fields.
 */

/** All 7 shipped client-value features as of Sprint 5. */
export const CLIENT_VALUE_FEATURE_IDS = [
  'weekly_digest',
  'auto_calendar',
  'review_intelligence',
  'authority_hub',
  'seasonal_engine',
  'first_win_notification',
  'monthly_story',
] as const;

export type ClientValueFeatureId = (typeof CLIENT_VALUE_FEATURE_IDS)[number];

/**
 * Six canonical CVML event types. Every client-value feature emits these
 * and only these — no feature-specific event names. The scorecard view
 * treats a feature as "working" when the ratio of `act_within_72h` +
 * `convert` to `view` is non-trivial.
 */
export const CLIENT_VALUE_EVENT_TYPES = [
  /** Client loaded or was shown the feature's surface. */
  'view',
  /** Client clicked or scrolled inside the feature (not just render). */
  'interact',
  /** Client completed the feature's recommended action within 72h. */
  'act_within_72h',
  /** Feature drove a qualifying business outcome (booking, share, revenue). */
  'convert',
  /** Client explicitly closed, hid, or opted-out of the feature. */
  'dismiss',
  /** Client exported or forwarded a feature artefact externally. */
  'share',
] as const;

export type ClientValueEventType = (typeof CLIENT_VALUE_EVENT_TYPES)[number];

/**
 * Journey stages — SYN-768 / SYN-729 schema gate.
 *
 * Every CVML event optionally carries the journey moment context so the
 * Session 35 scorecard extension can roll engagement up by stage as well
 * as by feature.
 *
 * Two spec lineages converge here:
 *   - SYN-768 (Session 43, ship-CVML-schema sub-issue) enumerated:
 *       day_0_7, day_7_14, day_14_28, day_28_45, monthly, quarterly,
 *       milestone, retention_intervention
 *   - SYN-729 (Session 35, journey-moment retrofit parent) enumerated:
 *       day_0, day_7_21, post_conversion, day_28_45, monthly, quarterly,
 *       milestone, retention_intervention
 *
 * Both specs reference a `board-cron/templates/journey-moment-emitter.md`
 * file that does not exist in this repo, so the tie cannot be broken from
 * a template. Resolution: union both lists. Day-bucket grain is the
 * union of both spec choices; nothing is lost; downstream consumers
 * narrow to whichever subset they care about.
 *
 * Enum values are the canonical source of truth — they MUST match the
 * `journey_stage` column in the `client_journey_events` table.
 *
 * Backward-compat: fields below are optional. Existing emitters compile
 * without modification; only new emitters that opt into journey tracking
 * populate them.
 */
export const JOURNEY_STAGES = [
  // SYN-768 day-bucket grain
  'day_0_7',
  'day_7_14',
  'day_14_28',
  // SYN-729 day-bucket grain
  'day_0',
  'day_7_21',
  // Shared
  'day_28_45',
  // SYN-729 lifecycle stage
  'post_conversion',
  // Shared cadence stages
  'monthly',
  'quarterly',
  'milestone',
  'retention_intervention',
] as const;

export type JourneyStage = (typeof JOURNEY_STAGES)[number];

export function isJourneyStage(value: unknown): value is JourneyStage {
  return (
    typeof value === 'string' &&
    (JOURNEY_STAGES as readonly string[]).includes(value)
  );
}

/**
 * Canonical CVML event shape. Discriminated by `featureId` + `eventType` —
 * the combination uniquely identifies what happened. `metadata` is
 * feature-specific and must not contain PII (same rule as SYN-612).
 *
 * Journey moment context (SYN-768): optional fields that, when populated,
 * let the scorecard view roll events up by journey stage. Required for
 * any emitter SYN-638 (Enhanced Monthly Story) and later — events emitted
 * without these cannot be retroactively attributed to a journey moment.
 */
export interface ClientValueEvent {
  featureId: ClientValueFeatureId;
  eventType: ClientValueEventType;
  /** Internal client UUID (Organization.id). Never an email. */
  clientId: string;
  /** User who triggered the event. Null when emitted by server cron. */
  userId: string | null;
  /** ISO-8601 timestamp at the source — emitter never backfills. */
  timestamp: string;
  /** Feature-specific, no PII. */
  metadata: Record<string, unknown>;
  /** UUID that joins CVML events with journey and session analytics. */
  sessionId: string;
  /**
   * Journey moment row (`client_journey_events.id`) the event belongs to.
   * Optional — emitters that don't yet ship under a journey moment leave
   * it unset. SYN-638 onwards: required.
   */
  journey_moment_id?: string;
  /**
   * Time-bucket stage for the event relative to client onboarding.
   * Optional — see `journey_moment_id` notes.
   */
  journey_stage?: JourneyStage;
}

/** Narrow type guards — useful when ingesting CVML events from untrusted sources. */
export function isClientValueFeatureId(
  value: unknown
): value is ClientValueFeatureId {
  return (
    typeof value === 'string' &&
    (CLIENT_VALUE_FEATURE_IDS as readonly string[]).includes(value)
  );
}

export function isClientValueEventType(
  value: unknown
): value is ClientValueEventType {
  return (
    typeof value === 'string' &&
    (CLIENT_VALUE_EVENT_TYPES as readonly string[]).includes(value)
  );
}
