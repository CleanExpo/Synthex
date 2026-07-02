import {
  CAMPAIGN_AUTHORITY_MANIFEST_KEY,
  type CampaignEvidenceManifest,
} from '@/lib/marketing-agency/campaign-authority-manifest';
import {
  CCW_EOFY_CAMPAIGN_SLUG,
  ccwEofyCampaignCalendar,
} from '@/lib/marketing-agency/ccw-eofy-calendar';
import {
  buildCcwEofyPublishingWeeks,
  buildCcwEofyPublishingCampaignMetadata,
  ccwEofyWeekStart,
  isCcwEofyPublishingSlot,
} from '@/lib/marketing-agency/ccw-eofy-publishing-package';

describe('CCW EOFY publishing package builder', () => {
  it('groups campaign slots into Monday-starting weeks', () => {
    expect(ccwEofyWeekStart('2026-06-03').toISOString().slice(0, 10)).toBe(
      '2026-06-01'
    );
    expect(ccwEofyWeekStart('2026-06-30').toISOString().slice(0, 10)).toBe(
      '2026-06-29'
    );
  });

  it('splits multi-platform campaign slots into platform-specific approved slots', () => {
    const weeks = buildCcwEofyPublishingWeeks({
      campaignId: 'campaign-ccw',
      approvedBy: 'founder@example.test',
      approvedAt: '2026-06-04T00:00:00.000Z',
    });

    const expectedExecutions = ccwEofyCampaignCalendar.reduce(
      (total, slot) => total + slot.platforms.length,
      0
    );
    const slots = weeks.flatMap(week => week.data.slots);

    expect(slots).toHaveLength(expectedExecutions);
    expect(slots.some(slot => slot.id.endsWith('-linkedin'))).toBe(true);
    expect(slots.some(slot => slot.id.endsWith('-facebook'))).toBe(true);
    expect(slots.every(slot => slot.status === 'approved')).toBe(true);
    expect(slots.every(slot => slot.captions.length === 1)).toBe(true);
  });

  it('attaches a human-approved authority manifest and allowed publish gate', () => {
    const [firstWeek] = buildCcwEofyPublishingWeeks({
      campaignId: 'campaign-ccw',
      approvedBy: 'founder@example.test',
      approvedAt: '2026-06-04T00:00:00.000Z',
    });
    const [slot] = firstWeek.data.slots;
    const manifest = slot[
      CAMPAIGN_AUTHORITY_MANIFEST_KEY
    ] as CampaignEvidenceManifest;

    expect(manifest.approval).toMatchObject({
      status: 'approved',
      humanApproved: true,
      approvedBy: 'founder@example.test',
    });
    expect(slot.publishGate.allowed).toBe(true);
    expect(slot.publishGate.blockers).toEqual([]);
  });

  it('identifies existing CCW EOFY publishing slots for idempotent replacement', () => {
    expect(
      isCcwEofyPublishingSlot({
        campaignSlug: CCW_EOFY_CAMPAIGN_SLUG,
      })
    ).toBe(true);
    expect(
      isCcwEofyPublishingSlot({
        id: `${CCW_EOFY_CAMPAIGN_SLUG}-example-instagram`,
      })
    ).toBe(true);
    expect(isCcwEofyPublishingSlot({ id: 'other-campaign-slot' })).toBe(
      false
    );
  });

  it('builds campaign settings metadata with the approved authority manifest and publish gate', () => {
    const metadata = buildCcwEofyPublishingCampaignMetadata({
      campaignId: 'campaign-ccw',
      approvedBy: 'founder@example.test',
      approvedAt: '2026-06-04T00:00:00.000Z',
      contentCalendars: [
        {
          calendarId: 'calendar-1',
          weekStart: '2026-06-01',
          weekEnd: '2026-06-07',
          slots: 5,
        },
      ],
      publishQueueItems: 4,
    });

    const manifest = metadata[
      CAMPAIGN_AUTHORITY_MANIFEST_KEY
    ] as CampaignEvidenceManifest;

    expect(metadata.ccwEofyPublishingPackage).toMatchObject({
      status: 'scheduled',
      campaignSlug: CCW_EOFY_CAMPAIGN_SLUG,
      approvedBy: 'founder@example.test',
      contentCalendars: [
        {
          calendarId: 'calendar-1',
          weekStart: '2026-06-01',
          weekEnd: '2026-06-07',
          slots: 5,
        },
      ],
      publishQueueItems: 4,
    });
    expect(manifest.approval).toMatchObject({
      status: 'approved',
      humanApproved: true,
      approvedBy: 'founder@example.test',
    });
    expect(metadata.publishGate).toEqual(
      expect.objectContaining({
        allowed: true,
        blockers: [],
      })
    );
  });
});
