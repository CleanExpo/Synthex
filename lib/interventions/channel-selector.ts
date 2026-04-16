/**
 * Data-Driven Channel Selector — SYN-619
 *
 * After the Engagement Telemetry Layer (SYN-660/677) accumulates per-client data,
 * this module selects the optimal intervention channel based on each client's
 * engagement history in `client_journey_events`.
 *
 * Channel inference from event_type (until an explicit `channel` column exists):
 *   - welcome | thirty_day_check_in | quarterly_milestone_review | win_notification
 *     | geo_score_introduced | personalisation_activated | monthly_story → 'email'
 *   - in_app_prompt → 'in_app'
 *   - sms_* prefix  → 'sms'
 *   - push_* prefix → 'push'
 *
 * Fallback:  ≤4 events on every channel → return email with low confidence and
 *            reason: 'insufficient_data'.
 *
 * Scoring weights (positive signal = acted, replied, clicked, surveyed;
 *                  neutral = delivered; negative = dismissed, ignored):
 *   acted    =  1.0
 *   replied  =  0.9
 *   clicked  =  0.7
 *   surveyed =  0.6
 *   delivered=  0.1
 *   dismissed= -0.3
 *   ignored  = -0.5
 *
 * Confidence thresholds (based on event count for the winning channel):
 *   high   ≥ 15 events
 *   medium   8–14 events
 *   low    < 8 events
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Channel = 'email' | 'sms' | 'push' | 'in_app';

export interface ChannelPreference {
  channel: Channel;
  confidence: 'low' | 'medium' | 'high';
  engagementRate: number; // 0–1, weighted score of the winning channel
  reason: string;
}

export type EngagementOutcome =
  | 'delivered'
  | 'clicked'
  | 'replied'
  | 'surveyed'
  | 'acted'
  | 'dismissed'
  | 'ignored';

/** Represents one row from client_journey_events with engagement data. */
export interface ChannelEvent {
  engagement_outcome: EngagementOutcome;
}

// ── Scoring weights ───────────────────────────────────────────────────────────

const OUTCOME_WEIGHTS: Record<EngagementOutcome, number> = {
  acted:     1.0,
  replied:   0.9,
  clicked:   0.7,
  surveyed:  0.6,
  delivered: 0.1,
  dismissed: -0.3,
  ignored:   -0.5,
};

// ── Thresholds ────────────────────────────────────────────────────────────────

const MIN_EVENTS_PER_CHANNEL = 5;
const CONFIDENCE_HIGH_THRESHOLD = 15;
const CONFIDENCE_MEDIUM_THRESHOLD = 8;

// ── Supabase admin singleton ──────────────────────────────────────────────────

let _admin: SupabaseClient | null = null;

function getAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _admin;
}

/** @internal — only used in tests to inject a mock Supabase client */
export function _resetAdminForTests(): void {
  _admin = null;
}

// ── Channel inference ─────────────────────────────────────────────────────────

/**
 * Derives the delivery channel from an event_type string.
 * Falls back to 'email' for all standard journey touchpoints.
 * Checks for an explicit `channel` field in metadata if present.
 */
export function inferChannelFromEventType(
  eventType: string,
  metadata?: Record<string, unknown> | null
): Channel {
  // If the event row carries an explicit channel field in metadata, trust it
  if (metadata && typeof metadata['channel'] === 'string') {
    const ch = metadata['channel'] as string;
    if (ch === 'sms' || ch === 'push' || ch === 'in_app' || ch === 'email') {
      return ch;
    }
  }

  if (eventType.startsWith('sms_')) return 'sms';
  if (eventType.startsWith('push_')) return 'push';
  if (eventType === 'in_app_prompt') return 'in_app';

  // All standard journey event types → email
  return 'email';
}

// ── Core scoring ──────────────────────────────────────────────────────────────

/**
 * Compute a normalised 0–1 score for a set of events on a single channel.
 * Score = sum(weights) mapped from [min_possible, max_possible] → [0, 1].
 *
 * Empty array → 0.
 */
export function computeChannelScore(events: ChannelEvent[]): number {
  if (events.length === 0) return 0;

  const rawSum = events.reduce(
    (acc, e) => acc + (OUTCOME_WEIGHTS[e.engagement_outcome] ?? 0),
    0
  );

  // Theoretical bounds per event: min = -0.5 (ignored), max = 1.0 (acted)
  const minPossible = events.length * OUTCOME_WEIGHTS.ignored;   // most negative
  const maxPossible = events.length * OUTCOME_WEIGHTS.acted;     // most positive

  if (maxPossible === minPossible) return 0;

  const normalised = (rawSum - minPossible) / (maxPossible - minPossible);
  return Math.min(1, Math.max(0, normalised));
}

// ── Confidence mapping ────────────────────────────────────────────────────────

function deriveConfidence(eventCount: number): 'low' | 'medium' | 'high' {
  if (eventCount >= CONFIDENCE_HIGH_THRESHOLD) return 'high';
  if (eventCount >= CONFIDENCE_MEDIUM_THRESHOLD) return 'medium';
  return 'low';
}

// ── Email fallback ────────────────────────────────────────────────────────────

const EMAIL_FALLBACK: ChannelPreference = {
  channel: 'email',
  confidence: 'low',
  engagementRate: 0,
  reason: 'insufficient_data',
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the channel the client responds to best, based on their
 * `client_journey_events` engagement history.
 *
 * If fewer than 5 events exist for every channel, returns the email fallback:
 *   { channel: 'email', confidence: 'low', engagementRate: 0, reason: 'insufficient_data' }
 */
export async function getPreferredChannel(clientId: string): Promise<ChannelPreference> {
  // Fetch all events with engagement_outcome for this client
  let rows: Array<{
    event_type: string;
    engagement_outcome: string | null;
    metadata: Record<string, unknown> | null;
  }>;

  try {
    const { data, error } = await (getAdmin() as ReturnType<typeof createClient<Record<string, unknown>>>)
      .from('client_journey_events')
      .select('event_type, engagement_outcome, metadata')
      .eq('client_id', clientId);

    if (error || !data) return EMAIL_FALLBACK;
    rows = data as typeof rows;
  } catch {
    return EMAIL_FALLBACK;
  }

  if (rows.length === 0) return EMAIL_FALLBACK;

  // Group events by inferred channel
  const channelBuckets = new Map<Channel, ChannelEvent[]>();

  for (const row of rows) {
    // Skip events without engagement_outcome (pre-SYN-677 rows)
    if (!row.engagement_outcome) continue;

    const outcome = row.engagement_outcome as EngagementOutcome;
    const channel = inferChannelFromEventType(row.event_type, row.metadata);

    if (!channelBuckets.has(channel)) {
      channelBuckets.set(channel, []);
    }
    channelBuckets.get(channel)!.push({ engagement_outcome: outcome });
  }

  // Filter channels that have at least MIN_EVENTS_PER_CHANNEL events
  const qualifyingChannels: Array<{ channel: Channel; score: number; count: number }> = [];

  for (const [channel, events] of channelBuckets.entries()) {
    if (events.length >= MIN_EVENTS_PER_CHANNEL) {
      qualifyingChannels.push({
        channel,
        score: computeChannelScore(events),
        count: events.length,
      });
    }
  }

  if (qualifyingChannels.length === 0) return EMAIL_FALLBACK;

  // Pick the channel with the highest score; tie-break: prefer email
  qualifyingChannels.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-break: email preferred
    if (a.channel === 'email') return -1;
    if (b.channel === 'email') return 1;
    return 0;
  });

  const winner = qualifyingChannels[0];

  return {
    channel: winner.channel,
    confidence: deriveConfidence(winner.count),
    engagementRate: winner.score,
    reason: `best_engagement_rate_across_${qualifyingChannels.length}_channel${qualifyingChannels.length === 1 ? '' : 's'}`,
  };
}
