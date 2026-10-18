/**
 * P2 u12: `client_journey_events` has no Prisma model, so channel selection
 * must say it is unavailable instead of presenting the email fallback as data.
 */
import {
  ChannelHistoryNotProvisionedError,
  getPreferredChannel,
  selectPreferredChannel,
  type JourneyEventRow,
} from '@/lib/interventions/channel-selector';

describe('getPreferredChannel (NOT_PROVISIONED: client_journey_events)', () => {
  it('throws a typed FEATURE_NOT_PROVISIONED error', async () => {
    const result = getPreferredChannel('client-1');
    await expect(result).rejects.toBeInstanceOf(
      ChannelHistoryNotProvisionedError
    );
    await expect(result).rejects.toMatchObject({
      code: 'FEATURE_NOT_PROVISIONED',
      table: 'client_journey_events',
    });
  });
});

describe('selectPreferredChannel (pure scoring)', () => {
  it('returns the insufficient_data email fallback with no rows', () => {
    expect(selectPreferredChannel([])).toEqual({
      channel: 'email',
      confidence: 'low',
      engagementRate: 0,
      reason: 'insufficient_data',
    });
  });

  it('picks the best-engaged qualifying channel', () => {
    const rows: JourneyEventRow[] = [
      ...Array.from({ length: 5 }, () => ({
        event_type: 'sms_reminder',
        engagement_outcome: 'acted',
        metadata: null,
      })),
      ...Array.from({ length: 5 }, () => ({
        event_type: 'welcome',
        engagement_outcome: 'ignored',
        metadata: null,
      })),
    ];
    const pref = selectPreferredChannel(rows);
    expect(pref.channel).toBe('sms');
    expect(pref.reason).toBe('best_engagement_rate_across_2_channels');
  });
});
