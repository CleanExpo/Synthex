/**
 * Client Value Measurement Layer (CVML) — Event Schema — SYN-724 (Session 34)
 *
 * Single standardised event schema shared by every client-value feature shipped
 * on Synthex. Before this module existed, each feature emitted ad-hoc events
 * (`digest_viewed`, `calendar_slot_generated`, or nothing at all) which made a
 * like-for-like scorecard impossible (SYN-723).
 *
 * Every future client-value feature and every retrofit (SYN-726) must emit
 * through the `emit()` wrapper in `./emit` using these types.
 *
 * Canonical events (6):
 *   • view            — client loaded / saw the feature surface
 *   • interact        — client clicked / scrolled / engaged with feature internals
 *   • act_within_72h  — client took the feature's recommended action within 72h
 *   • convert         — feature drove a qualifying business outcome
 *   • dismiss         — client explicitly closed / hid / opted-out
 *   • share           — client exported, sent, or forwarded a feature artefact
 *
 * Feature IDs (7 shipped client-value features as of Session 34):
 *   weekly_digest · auto_calendar · review_intelligence · authority_hub ·
 *   seasonal_engine · first_win_notification · monthly_story
 *
 * NO PII in `metadata`. Emails, URLs, and business names must be hashed or
 * removed before being added to the payload — the emit() wrapper does NOT
 * scrub; callers are responsible.
 *
 * @module lib/measurement/client-value-events
 * @see lib/measurement/emit
 * @see board-cron/decisions/client-value-2026-04-17-0600.md
 */

// ============================================================================
// FEATURE IDS
// ============================================================================

/**
 * The 7 shipped client-value features tracked by CVML.
 *
 * This union is the single source of truth — adding a new client-value
 * feature requires extending this list and retrofitting the `client_value_scorecard`
 * materialised view (SYN-725).
 */
export type ClientValueFeatureId =
  | 'weekly_digest'
  | 'auto_calendar'
  | 'review_intelligence'
  | 'authority_hub'
  | 'seasonal_engine'
  | 'first_win_notification'
  | 'monthly_story';

/** Runtime-iterable list of every featureId (e.g. for tests / registration). */
export const CLIENT_VALUE_FEATURE_IDS: readonly ClientValueFeatureId[] = [
  'weekly_digest',
  'auto_calendar',
  'review_intelligence',
  'authority_hub',
  'seasonal_engine',
  'first_win_notification',
  'monthly_story',
] as const;

// ============================================================================
// EVENT TYPES (6 canonical events)
// ============================================================================

/**
 * The 6 canonical client-value events.
 *
 * Every client-value feature must emit all 6 events that apply to it. Features
 * where an event is impossible (e.g. `share` for an internal-only surface)
 * simply never fire it — they must NOT invent a substitute event type.
 */
export type ClientValueEventType =
  | 'view'
  | 'interact'
  | 'act_within_72h'
  | 'convert'
  | 'dismiss'
  | 'share';

/** Runtime-iterable list of every eventType (e.g. for tests / registration). */
export const CLIENT_VALUE_EVENT_TYPES: readonly ClientValueEventType[] = [
  'view',
  'interact',
  'act_within_72h',
  'convert',
  'dismiss',
  'share',
] as const;

// ============================================================================
// EVENT SHAPE
// ============================================================================

/**
 * The canonical CVML event shape.
 *
 * Strict discriminated union of `featureId` × `eventType`. Every field is
 * required — callers must not pass `undefined` for `userId` (use `null`).
 *
 * Field contract:
 *   • `featureId`  — which of the 7 shipped features emitted this
 *   • `eventType`  — which of the 6 canonical events occurred
 *   • `clientId`   — UUID of the client (tenant) the event belongs to
 *   • `userId`     — UUID of the acting user (null for system / unauthed events)
 *   • `timestamp`  — ISO 8601 string (use `new Date().toISOString()`)
 *   • `sessionId`  — opaque session identifier for journey joins (Session 15)
 *   • `metadata`   — feature-specific payload. NO PII. Values are `unknown` so
 *                    the scorecard materialised view (SYN-725) can unpack
 *                    per-feature columns via JSONB operators.
 */
export interface ClientValueEvent {
  readonly featureId: ClientValueFeatureId;
  readonly eventType: ClientValueEventType;
  readonly clientId: string;
  readonly userId: string | null;
  readonly timestamp: string;
  readonly sessionId: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Narrow `string` to `ClientValueFeatureId` at runtime.
 *
 * Used by the emit() wrapper and the scorecard retrofit audit (SYN-726) to
 * reject events with unknown featureIds before they hit `client_engagement_events`.
 */
export function isClientValueFeatureId(value: string): value is ClientValueFeatureId {
  return (CLIENT_VALUE_FEATURE_IDS as readonly string[]).includes(value);
}

/**
 * Narrow `string` to `ClientValueEventType` at runtime.
 */
export function isClientValueEventType(value: string): value is ClientValueEventType {
  return (CLIENT_VALUE_EVENT_TYPES as readonly string[]).includes(value);
}

/**
 * Build a canonical GA4 event name from a CVML event.
 *
 * Format: `cvml_{featureId}_{eventType}` — e.g. `cvml_weekly_digest_view`.
 *
 * GA4 event names must be ≤40 chars and `[a-z0-9_]`. The longest possible
 * name is `cvml_first_win_notification_act_within_72h` at 42 chars — so we
 * abbreviate `first_win_notification` → `fwn` and `act_within_72h` → `act72h`
 * in the GA4 event name while preserving the full form in the Supabase row
 * for analytic clarity.
 */
export function toGa4EventName(
  featureId: ClientValueFeatureId,
  eventType: ClientValueEventType
): string {
  const featureAbbrev: Record<ClientValueFeatureId, string> = {
    weekly_digest: 'weekly_digest',
    auto_calendar: 'auto_calendar',
    review_intelligence: 'review_intel',
    authority_hub: 'authority_hub',
    seasonal_engine: 'seasonal',
    first_win_notification: 'fwn',
    monthly_story: 'monthly_story',
  };
  const eventAbbrev: Record<ClientValueEventType, string> = {
    view: 'view',
    interact: 'interact',
    act_within_72h: 'act72h',
    convert: 'convert',
    dismiss: 'dismiss',
    share: 'share',
  };
  return `cvml_${featureAbbrev[featureId]}_${eventAbbrev[eventType]}`;
}
