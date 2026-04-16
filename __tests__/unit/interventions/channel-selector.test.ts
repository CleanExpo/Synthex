/**
 * Unit tests — channel-selector.ts — SYN-619
 *
 * Tests:
 * 1. Returns email fallback when no events exist
 * 2. Returns email fallback when <5 events per channel
 * 3. Correctly scores a client with strong email engagement
 * 4. Returns sms when SMS has higher engagement score than email
 * 5. computeChannelScore: all positive events = 1.0
 * 6. computeChannelScore: all negative events = 0
 * 7. computeChannelScore: mixed events
 * 8. Confidence level assignment at 5, 8, 14, 15 events
 */

// ── Mock Supabase ─────────────────────────────────────────────────────────────
//
// Strategy: use a stable closure variable (_queryResult) that the mock chain
// reads at call time. This is immune to jest's resetMocks/clearMocks because
// the implementations are plain functions defined inline, not jest.fn() chains
// set up with mockReturnValue/mockResolvedValue.
//
// jest.mock() is hoisted before imports. The factory uses a shared module-level
// object (__db) as a communication channel.

// Shared state — plain object, not jest.fn() dependent
const __db: {
  rows: Array<{ event_type: string; engagement_outcome: string | null; metadata: Record<string, unknown> | null }> | null;
  error: { message: string } | null;
} = { rows: [], error: null };

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: __db.rows, error: __db.error }),
      }),
    }),
  }),
}));

import {
  getPreferredChannel,
  computeChannelScore,
  inferChannelFromEventType,
  _resetAdminForTests,
  ChannelEvent,
  ChannelPreference,
} from '@/lib/interventions/channel-selector';

/** Helper — set what the next Supabase query will return. */
function mockSupabaseRows(
  rows: Array<{ event_type: string; engagement_outcome: string | null; metadata: Record<string, unknown> | null }> | null,
  error: { message: string } | null = null
) {
  __db.rows = rows;
  __db.error = error;
}

beforeEach(() => {
  // Force the channel-selector to call createClient again (picks up closure state)
  _resetAdminForTests();
  // Reset to empty result; individual tests call mockSupabaseRows() as needed
  __db.rows = [];
  __db.error = null;
  process.env.NEXT_PUBLIC_SUPABASE_URL  = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
});

// ── EMAIL FALLBACK CASES ──────────────────────────────────────────────────────

describe('getPreferredChannel — email fallback', () => {
  it('returns email fallback when client has no journey events', async () => {
    mockSupabaseRows([]);

    const result = await getPreferredChannel('org-no-events');

    expect(result).toEqual<ChannelPreference>({
      channel: 'email',
      confidence: 'low',
      engagementRate: 0,
      reason: 'insufficient_data',
    });
  });

  it('returns email fallback when Supabase returns null data', async () => {
    mockSupabaseRows(null);

    const result = await getPreferredChannel('org-null-data');

    expect(result).toEqual<ChannelPreference>({
      channel: 'email',
      confidence: 'low',
      engagementRate: 0,
      reason: 'insufficient_data',
    });
  });

  it('returns email fallback when Supabase returns an error', async () => {
    mockSupabaseRows(null, { message: 'DB error' });

    const result = await getPreferredChannel('org-db-error');

    expect(result).toEqual<ChannelPreference>({
      channel: 'email',
      confidence: 'low',
      engagementRate: 0,
      reason: 'insufficient_data',
    });
  });

  it('returns email fallback when fewer than 5 events exist for every channel', async () => {
    // 4 email events — one short of the threshold
    mockSupabaseRows([
      { event_type: 'thirty_day_check_in', engagement_outcome: 'acted',   metadata: null },
      { event_type: 'thirty_day_check_in', engagement_outcome: 'clicked', metadata: null },
      { event_type: 'win_notification',    engagement_outcome: 'replied', metadata: null },
      { event_type: 'monthly_story',       engagement_outcome: 'ignored', metadata: null },
    ]);

    const result = await getPreferredChannel('org-below-threshold');

    expect(result).toEqual<ChannelPreference>({
      channel: 'email',
      confidence: 'low',
      engagementRate: 0,
      reason: 'insufficient_data',
    });
  });

  it('returns email fallback when all events have null engagement_outcome (pre-SYN-677 rows)', async () => {
    mockSupabaseRows([
      { event_type: 'thirty_day_check_in', engagement_outcome: null, metadata: null },
      { event_type: 'thirty_day_check_in', engagement_outcome: null, metadata: null },
      { event_type: 'win_notification',    engagement_outcome: null, metadata: null },
      { event_type: 'monthly_story',       engagement_outcome: null, metadata: null },
      { event_type: 'monthly_story',       engagement_outcome: null, metadata: null },
    ]);

    const result = await getPreferredChannel('org-no-outcomes');

    expect(result).toEqual<ChannelPreference>({
      channel: 'email',
      confidence: 'low',
      engagementRate: 0,
      reason: 'insufficient_data',
    });
  });
});

// ── STRONG EMAIL ENGAGEMENT ───────────────────────────────────────────────────

describe('getPreferredChannel — email winning channel', () => {
  it('returns email when client has strong email engagement (5+ events)', async () => {
    mockSupabaseRows([
      { event_type: 'thirty_day_check_in',       engagement_outcome: 'acted',    metadata: null },
      { event_type: 'quarterly_milestone_review', engagement_outcome: 'acted',    metadata: null },
      { event_type: 'win_notification',           engagement_outcome: 'clicked',  metadata: null },
      { event_type: 'monthly_story',              engagement_outcome: 'replied',  metadata: null },
      { event_type: 'geo_score_introduced',       engagement_outcome: 'surveyed', metadata: null },
    ]);

    const result = await getPreferredChannel('org-strong-email');

    expect(result.channel).toBe('email');
    expect(result.confidence).toBe('low'); // 5 events → low (< 8)
    expect(result.engagementRate).toBeGreaterThan(0.5);
    expect(result.reason).toContain('best_engagement_rate');
  });

  it('returns medium confidence with 8–14 email events', async () => {
    const rows = Array.from({ length: 10 }, () => ({
      event_type: 'monthly_story',
      engagement_outcome: 'acted',
      metadata: null,
    }));
    mockSupabaseRows(rows);

    const result = await getPreferredChannel('org-medium-email');

    expect(result.channel).toBe('email');
    expect(result.confidence).toBe('medium');
  });

  it('returns high confidence with 15+ email events', async () => {
    const rows = Array.from({ length: 15 }, () => ({
      event_type: 'win_notification',
      engagement_outcome: 'acted',
      metadata: null,
    }));
    mockSupabaseRows(rows);

    const result = await getPreferredChannel('org-high-email');

    expect(result.channel).toBe('email');
    expect(result.confidence).toBe('high');
  });
});

// ── SMS WINNING CHANNEL ───────────────────────────────────────────────────────

describe('getPreferredChannel — sms winning channel', () => {
  it('returns sms when SMS has higher engagement score than email', async () => {
    // 5 email events with mostly ignored outcomes (low score)
    const emailRows = Array.from({ length: 5 }, () => ({
      event_type: 'thirty_day_check_in',
      engagement_outcome: 'ignored',
      metadata: null,
    }));

    // 5 sms events with acted outcomes (high score)
    const smsRows = Array.from({ length: 5 }, () => ({
      event_type: 'sms_notification',
      engagement_outcome: 'acted',
      metadata: null,
    }));

    mockSupabaseRows([...emailRows, ...smsRows]);

    const result = await getPreferredChannel('org-sms-winner');

    expect(result.channel).toBe('sms');
    expect(result.engagementRate).toBeGreaterThan(0.5);
  });
});

// ── computeChannelScore ───────────────────────────────────────────────────────

describe('computeChannelScore', () => {
  it('returns 0 for an empty event list', () => {
    expect(computeChannelScore([])).toBe(0);
  });

  it('returns 1.0 when all events are "acted" (maximum positive)', () => {
    const events: ChannelEvent[] = [
      { engagement_outcome: 'acted' },
      { engagement_outcome: 'acted' },
      { engagement_outcome: 'acted' },
    ];
    expect(computeChannelScore(events)).toBe(1);
  });

  it('returns 0 when all events are "ignored" (maximum negative)', () => {
    const events: ChannelEvent[] = [
      { engagement_outcome: 'ignored' },
      { engagement_outcome: 'ignored' },
      { engagement_outcome: 'ignored' },
    ];
    expect(computeChannelScore(events)).toBe(0);
  });

  it('returns a score greater than 0 and less than ignored for all-dismissed events', () => {
    // dismissed (-0.3) is less negative than ignored (-0.5), so it normalises above 0
    const dismissed: ChannelEvent[] = [
      { engagement_outcome: 'dismissed' },
      { engagement_outcome: 'dismissed' },
    ];
    const ignored: ChannelEvent[] = [
      { engagement_outcome: 'ignored' },
      { engagement_outcome: 'ignored' },
    ];
    const dismissedScore = computeChannelScore(dismissed);
    const ignoredScore = computeChannelScore(ignored);
    expect(dismissedScore).toBeGreaterThan(0);
    expect(dismissedScore).toBeGreaterThan(ignoredScore);
    // Sanity: should still be below neutral/positive territory
    expect(dismissedScore).toBeLessThan(0.5);
  });

  it('returns a value between 0 and 1 for mixed events', () => {
    const events: ChannelEvent[] = [
      { engagement_outcome: 'acted' },    // +1.0
      { engagement_outcome: 'clicked' },  // +0.7
      { engagement_outcome: 'ignored' },  // -0.5
      { engagement_outcome: 'dismissed' },// -0.3
    ];
    const score = computeChannelScore(events);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('returns a higher score for "replied" than for "delivered"', () => {
    const repliedScore = computeChannelScore([{ engagement_outcome: 'replied' }]);
    const deliveredScore = computeChannelScore([{ engagement_outcome: 'delivered' }]);
    expect(repliedScore).toBeGreaterThan(deliveredScore);
  });

  it('returns a higher score for "clicked" than for "dismissed"', () => {
    const clickedScore = computeChannelScore([{ engagement_outcome: 'clicked' }]);
    const dismissedScore = computeChannelScore([{ engagement_outcome: 'dismissed' }]);
    expect(clickedScore).toBeGreaterThan(dismissedScore);
  });

  it('outcome weight order: acted > replied > clicked > surveyed > delivered > dismissed > ignored', () => {
    const score = (o: ChannelEvent['engagement_outcome']) =>
      computeChannelScore([{ engagement_outcome: o }]);

    expect(score('acted')).toBeGreaterThan(score('replied'));
    expect(score('replied')).toBeGreaterThan(score('clicked'));
    expect(score('clicked')).toBeGreaterThan(score('surveyed'));
    expect(score('surveyed')).toBeGreaterThan(score('delivered'));
    expect(score('delivered')).toBeGreaterThan(score('dismissed'));
    expect(score('dismissed')).toBeGreaterThan(score('ignored'));
  });
});

// ── Confidence level boundary tests ──────────────────────────────────────────

describe('confidence level assignment by event count', () => {
  function buildEmailRows(count: number): Array<{
    event_type: string;
    engagement_outcome: string;
    metadata: null;
  }> {
    return Array.from({ length: count }, () => ({
      event_type: 'monthly_story',
      engagement_outcome: 'acted',
      metadata: null,
    }));
  }

  it('returns low confidence at exactly 5 events', async () => {
    mockSupabaseRows(buildEmailRows(5));
    const result = await getPreferredChannel('org-5-events');
    expect(result.confidence).toBe('low');
  });

  it('returns low confidence at 7 events (below medium threshold)', async () => {
    mockSupabaseRows(buildEmailRows(7));
    const result = await getPreferredChannel('org-7-events');
    expect(result.confidence).toBe('low');
  });

  it('returns medium confidence at exactly 8 events', async () => {
    mockSupabaseRows(buildEmailRows(8));
    const result = await getPreferredChannel('org-8-events');
    expect(result.confidence).toBe('medium');
  });

  it('returns medium confidence at 14 events', async () => {
    mockSupabaseRows(buildEmailRows(14));
    const result = await getPreferredChannel('org-14-events');
    expect(result.confidence).toBe('medium');
  });

  it('returns high confidence at exactly 15 events', async () => {
    mockSupabaseRows(buildEmailRows(15));
    const result = await getPreferredChannel('org-15-events');
    expect(result.confidence).toBe('high');
  });

  it('returns high confidence at 20 events', async () => {
    mockSupabaseRows(buildEmailRows(20));
    const result = await getPreferredChannel('org-20-events');
    expect(result.confidence).toBe('high');
  });
});

// ── inferChannelFromEventType ────────────────────────────────────────────────

describe('inferChannelFromEventType', () => {
  it('infers email for standard journey event types', () => {
    const emailEvents = [
      'thirty_day_check_in',
      'quarterly_milestone_review',
      'win_notification',
      'geo_score_introduced',
      'personalisation_activated',
      'monthly_story',
    ];
    for (const et of emailEvents) {
      expect(inferChannelFromEventType(et)).toBe('email');
    }
  });

  it('infers in_app for in_app_prompt', () => {
    expect(inferChannelFromEventType('in_app_prompt')).toBe('in_app');
  });

  it('infers sms for sms_* prefixed events', () => {
    expect(inferChannelFromEventType('sms_notification')).toBe('sms');
    expect(inferChannelFromEventType('sms_reminder')).toBe('sms');
  });

  it('infers push for push_* prefixed events', () => {
    expect(inferChannelFromEventType('push_alert')).toBe('push');
  });

  it('respects explicit channel in metadata over event_type inference', () => {
    // event_type would map to email, but metadata says in_app
    expect(inferChannelFromEventType('monthly_story', { channel: 'in_app' })).toBe('in_app');
  });

  it('ignores invalid channel values in metadata', () => {
    expect(inferChannelFromEventType('monthly_story', { channel: 'fax' })).toBe('email');
  });
});
