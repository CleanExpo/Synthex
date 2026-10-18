/**
 * Unit tests — channel-selector.ts — SYN-619
 *
 * Tests:
 * 0. getPreferredChannel throws ChannelHistoryNotProvisionedError (no table)
 * 1. selectPreferredChannel returns email fallback when no events exist
 * 2. Returns email fallback when <5 events per channel
 * 3. Correctly scores a client with strong email engagement
 * 4. Returns sms when SMS has higher engagement score than email
 * 5. computeChannelScore: all positive events = 1.0
 * 6. computeChannelScore: all negative events = 0
 * 7. computeChannelScore: mixed events
 * 8. Confidence level assignment at 5, 8, 14, 15 events
 */

import {
  getPreferredChannel,
  selectPreferredChannel,
  computeChannelScore,
  inferChannelFromEventType,
  ChannelHistoryNotProvisionedError,
  ChannelEvent,
  ChannelPreference,
  JourneyEventRow,
} from '@/lib/interventions/channel-selector';

const EMAIL_FALLBACK: ChannelPreference = {
  channel: 'email',
  confidence: 'low',
  engagementRate: 0,
  reason: 'insufficient_data',
};

// ── NOT PROVISIONED ───────────────────────────────────────────────────────────

describe('getPreferredChannel — not provisioned', () => {
  it('throws ChannelHistoryNotProvisionedError instead of a fabricated email fallback', async () => {
    await expect(getPreferredChannel('org-any')).rejects.toBeInstanceOf(
      ChannelHistoryNotProvisionedError
    );
    await expect(getPreferredChannel('org-any')).rejects.toMatchObject({
      code: 'FEATURE_NOT_PROVISIONED',
      table: 'client_journey_events',
    });
  });
});

// ── EMAIL FALLBACK CASES ──────────────────────────────────────────────────────

describe('selectPreferredChannel — email fallback', () => {
  it('returns email fallback when client has no journey events', () => {
    expect(selectPreferredChannel([])).toEqual(EMAIL_FALLBACK);
  });

  it('returns email fallback when fewer than 5 events exist for every channel', () => {
    // 4 email events — one short of the threshold
    const result = selectPreferredChannel([
      {
        event_type: 'thirty_day_check_in',
        engagement_outcome: 'acted',
        metadata: null,
      },
      {
        event_type: 'thirty_day_check_in',
        engagement_outcome: 'clicked',
        metadata: null,
      },
      {
        event_type: 'win_notification',
        engagement_outcome: 'replied',
        metadata: null,
      },
      {
        event_type: 'monthly_story',
        engagement_outcome: 'ignored',
        metadata: null,
      },
    ]);

    expect(result).toEqual(EMAIL_FALLBACK);
  });

  it('returns email fallback when all events have null engagement_outcome (pre-SYN-677 rows)', () => {
    const result = selectPreferredChannel([
      {
        event_type: 'thirty_day_check_in',
        engagement_outcome: null,
        metadata: null,
      },
      {
        event_type: 'thirty_day_check_in',
        engagement_outcome: null,
        metadata: null,
      },
      {
        event_type: 'win_notification',
        engagement_outcome: null,
        metadata: null,
      },
      { event_type: 'monthly_story', engagement_outcome: null, metadata: null },
      { event_type: 'monthly_story', engagement_outcome: null, metadata: null },
    ]);

    expect(result).toEqual(EMAIL_FALLBACK);
  });
});

// ── STRONG EMAIL ENGAGEMENT ───────────────────────────────────────────────────

describe('selectPreferredChannel — email winning channel', () => {
  it('returns email when client has strong email engagement (5+ events)', () => {
    const result = selectPreferredChannel([
      {
        event_type: 'thirty_day_check_in',
        engagement_outcome: 'acted',
        metadata: null,
      },
      {
        event_type: 'quarterly_milestone_review',
        engagement_outcome: 'acted',
        metadata: null,
      },
      {
        event_type: 'win_notification',
        engagement_outcome: 'clicked',
        metadata: null,
      },
      {
        event_type: 'monthly_story',
        engagement_outcome: 'replied',
        metadata: null,
      },
      {
        event_type: 'geo_score_introduced',
        engagement_outcome: 'surveyed',
        metadata: null,
      },
    ]);

    expect(result.channel).toBe('email');
    expect(result.confidence).toBe('low'); // 5 events → low (< 8)
    expect(result.engagementRate).toBeGreaterThan(0.5);
    expect(result.reason).toContain('best_engagement_rate');
  });

  it('returns medium confidence with 8–14 email events', () => {
    const rows = Array.from({ length: 10 }, () => ({
      event_type: 'monthly_story',
      engagement_outcome: 'acted',
      metadata: null,
    }));
    const result = selectPreferredChannel(rows);

    expect(result.channel).toBe('email');
    expect(result.confidence).toBe('medium');
  });

  it('returns high confidence with 15+ email events', () => {
    const rows = Array.from({ length: 15 }, () => ({
      event_type: 'win_notification',
      engagement_outcome: 'acted',
      metadata: null,
    }));
    const result = selectPreferredChannel(rows);

    expect(result.channel).toBe('email');
    expect(result.confidence).toBe('high');
  });
});

// ── SMS WINNING CHANNEL ───────────────────────────────────────────────────────

describe('selectPreferredChannel — sms winning channel', () => {
  it('returns sms when SMS has higher engagement score than email', () => {
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

    const result = selectPreferredChannel([...emailRows, ...smsRows]);

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
      { engagement_outcome: 'acted' }, // +1.0
      { engagement_outcome: 'clicked' }, // +0.7
      { engagement_outcome: 'ignored' }, // -0.5
      { engagement_outcome: 'dismissed' }, // -0.3
    ];
    const score = computeChannelScore(events);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('returns a higher score for "replied" than for "delivered"', () => {
    const repliedScore = computeChannelScore([
      { engagement_outcome: 'replied' },
    ]);
    const deliveredScore = computeChannelScore([
      { engagement_outcome: 'delivered' },
    ]);
    expect(repliedScore).toBeGreaterThan(deliveredScore);
  });

  it('returns a higher score for "clicked" than for "dismissed"', () => {
    const clickedScore = computeChannelScore([
      { engagement_outcome: 'clicked' },
    ]);
    const dismissedScore = computeChannelScore([
      { engagement_outcome: 'dismissed' },
    ]);
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
  function buildEmailRows(count: number): JourneyEventRow[] {
    return Array.from({ length: count }, () => ({
      event_type: 'monthly_story',
      engagement_outcome: 'acted',
      metadata: null,
    }));
  }

  it('returns low confidence at exactly 5 events', () => {
    const result = selectPreferredChannel(buildEmailRows(5));
    expect(result.confidence).toBe('low');
  });

  it('returns low confidence at 7 events (below medium threshold)', () => {
    const result = selectPreferredChannel(buildEmailRows(7));
    expect(result.confidence).toBe('low');
  });

  it('returns medium confidence at exactly 8 events', () => {
    const result = selectPreferredChannel(buildEmailRows(8));
    expect(result.confidence).toBe('medium');
  });

  it('returns medium confidence at 14 events', () => {
    const result = selectPreferredChannel(buildEmailRows(14));
    expect(result.confidence).toBe('medium');
  });

  it('returns high confidence at exactly 15 events', () => {
    const result = selectPreferredChannel(buildEmailRows(15));
    expect(result.confidence).toBe('high');
  });

  it('returns high confidence at 20 events', () => {
    const result = selectPreferredChannel(buildEmailRows(20));
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
    expect(
      inferChannelFromEventType('monthly_story', { channel: 'in_app' })
    ).toBe('in_app');
  });

  it('ignores invalid channel values in metadata', () => {
    expect(inferChannelFromEventType('monthly_story', { channel: 'fax' })).toBe(
      'email'
    );
  });
});
