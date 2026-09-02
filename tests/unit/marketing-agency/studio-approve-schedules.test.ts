/**
 * g2 — approving a Client Content Studio draft creates a scheduled Post through
 * the ONE working scheduler (lib/social/schedule-via-post.ts → Post table →
 * /api/cron/publish-scheduled). Before this, approval flipped a status and
 * stopped: "approved" meant "will never publish".
 *
 * Everything is injected — no database, no network.
 */

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { studioContentDraft: {} },
  prisma: { studioContentDraft: {} },
}));
jest.mock('@/lib/social', () => ({
  isPlatformSupported: (platform: string) =>
    ['linkedin', 'facebook', 'twitter'].includes(platform),
}));
jest.mock('@/lib/social/schedule-via-post', () => ({
  scheduleViaPost: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  approveAndScheduleStudioDraft,
  buildStudioFunnelLink,
} from '@/lib/marketing-agency/studio/approve-and-schedule';
import type { StudioDraftDelegate } from '@/lib/marketing-agency/studio/draft-store';

const NOW = new Date('2026-09-02T14:00:00.000Z');

function draftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'd1',
    clientSlug: 'carsi',
    topic:
      'On this day: CARSI becomes the first evidence-gated client campaign',
    script: 'Body of the post.\n\nCTA: Save this checklist.',
    platforms: ['linkedin', 'blog'],
    videoUrl: null,
    metadata: {
      authorityCampaignId: 'carsi-restoration-training-authority-2026-06-11',
    },
    ...overrides,
  };
}

function harness(opts: { approveCount?: number; draft?: unknown } = {}) {
  const updateMany = jest
    .fn()
    .mockResolvedValueOnce({ count: opts.approveCount ?? 1 }) // the approval
    .mockResolvedValue({ count: 1 }); // the metadata record
  const findFirst = jest
    .fn()
    .mockResolvedValue(opts.draft === undefined ? draftRow() : opts.draft);
  const delegate = {
    updateMany,
    findFirst,
  } as unknown as StudioDraftDelegate;
  const schedule = jest.fn(async (input: { platform: string }) => ({
    id: `post-${input.platform}`,
    platform: input.platform,
    scheduledAt: NOW.toISOString(),
    status: 'scheduled' as const,
  }));
  return { delegate, updateMany, findFirst, schedule };
}

const CLIENT = { clientSlug: 'carsi', funnelUrl: 'https://carsi.au/courses' };

describe('approveAndScheduleStudioDraft', () => {
  it('creates one scheduled Post per schedulable platform, scoped to the DRAFT organisation', async () => {
    const h = harness();

    const result = await approveAndScheduleStudioDraft(
      {
        organizationId: 'org-carsi',
        id: 'd1',
        approvedBy: 'phill',
        client: CLIENT,
      },
      { delegate: h.delegate, schedule: h.schedule, now: () => NOW }
    );

    // The human-approval gate ran first, org-scoped, and only on awaiting_approval.
    expect(h.updateMany.mock.calls[0][0].where).toEqual({
      id: 'd1',
      organizationId: 'org-carsi',
      status: 'awaiting_approval',
    });

    // Exactly one Post: linkedin is schedulable, blog is not.
    expect(h.schedule).toHaveBeenCalledTimes(1);
    const input = h.schedule.mock.calls[0][0];
    expect(input).toMatchObject({
      userId: 'phill',
      platform: 'linkedin',
      content: 'Body of the post.\n\nCTA: Save this checklist.',
      scheduledTime: NOW,
      mediaUrls: [],
      // The draft's org — NOT the approver's active org.
      organizationId: 'org-carsi',
      metadata: {
        source: 'studio',
        studioDraftId: 'd1',
        clientSlug: 'carsi',
        authorityCampaignId: 'carsi-restoration-training-authority-2026-06-11',
        linkUrl:
          'https://carsi.au/courses?utm_source=linkedin&utm_medium=social&utm_campaign=carsi-restoration-training-authority-2026-06-11&utm_content=d1',
      },
    });

    expect(result).toEqual({
      approved: true,
      scheduled: [
        {
          platform: 'linkedin',
          postId: 'post-linkedin',
          scheduledAt: NOW.toISOString(),
          linkUrl:
            'https://carsi.au/courses?utm_source=linkedin&utm_medium=social&utm_campaign=carsi-restoration-training-authority-2026-06-11&utm_content=d1',
        },
      ],
      skipped: [{ platform: 'blog', reason: 'platform_not_schedulable' }],
    });
  });

  it('does nothing when the approval matched no row (wrong org / not awaiting / missing)', async () => {
    const h = harness({ approveCount: 0 });

    const result = await approveAndScheduleStudioDraft(
      {
        organizationId: 'org-other',
        id: 'd1',
        approvedBy: 'attacker',
        client: CLIENT,
      },
      { delegate: h.delegate, schedule: h.schedule, now: () => NOW }
    );

    expect(result).toEqual({ approved: false, scheduled: [], skipped: [] });
    expect(h.findFirst).not.toHaveBeenCalled();
    expect(h.schedule).not.toHaveBeenCalled();
    expect(h.updateMany).toHaveBeenCalledTimes(1);
  });

  it("refuses to schedule when the pack's owned-media rights gate is false", async () => {
    const h = harness({
      draft: draftRow({
        metadata: {
          ownedMediaGate: {
            allowed: false,
            blockers: ['asset_rights_unconfirmed'],
          },
        },
      }),
    });

    const result = await approveAndScheduleStudioDraft(
      {
        organizationId: 'org-carsi',
        id: 'd1',
        approvedBy: 'phill',
        client: CLIENT,
      },
      { delegate: h.delegate, schedule: h.schedule, now: () => NOW }
    );

    expect(result.approved).toBe(true);
    expect(h.schedule).not.toHaveBeenCalled();
    expect(result.scheduled).toEqual([]);
    expect(result.skipped).toEqual([
      { platform: 'linkedin', reason: 'owned_media_gate_blocked' },
      { platform: 'blog', reason: 'owned_media_gate_blocked' },
    ]);
  });

  it('attaches the rendered video as media and keeps the funnel link in the text where a card cannot carry it', async () => {
    const h = harness({
      draft: draftRow({
        platforms: ['linkedin'],
        videoUrl: 'https://cdn.example/carsi-d1.mp4',
        metadata: {},
      }),
    });

    await approveAndScheduleStudioDraft(
      {
        organizationId: 'org-carsi',
        id: 'd1',
        approvedBy: 'phill',
        client: CLIENT,
      },
      { delegate: h.delegate, schedule: h.schedule, now: () => NOW }
    );

    const input = h.schedule.mock.calls[0][0];
    expect(input.mediaUrls).toEqual(['https://cdn.example/carsi-d1.mp4']);
    // No authority campaign on this draft → the studio-<client> campaign tag.
    const link =
      'https://carsi.au/courses?utm_source=linkedin&utm_medium=social&utm_campaign=studio-carsi&utm_content=d1';
    expect(input.metadata.linkUrl).toBe(link);
    // LinkedIn ignores linkUrl when media is present, so the link must not be lost.
    expect(input.content.endsWith(`\n\n${link}`)).toBe(true);
  });

  it('records the approval and the schedule on the draft', async () => {
    const h = harness();

    await approveAndScheduleStudioDraft(
      {
        organizationId: 'org-carsi',
        id: 'd1',
        approvedBy: 'phill',
        client: CLIENT,
      },
      { delegate: h.delegate, schedule: h.schedule, now: () => NOW }
    );

    expect(h.updateMany).toHaveBeenCalledTimes(2);
    const record = h.updateMany.mock.calls[1][0];
    expect(record.where).toEqual({ id: 'd1', organizationId: 'org-carsi' });
    expect(record.data.metadata).toMatchObject({
      // Existing metadata is preserved, not overwritten.
      authorityCampaignId: 'carsi-restoration-training-authority-2026-06-11',
      externalPublishingAllowed: true,
      externalPublishApprovedBy: 'phill',
      externalPublishApprovedAt: NOW.toISOString(),
      studioSchedule: {
        scheduled: [{ platform: 'linkedin', postId: 'post-linkedin' }],
        skipped: [{ platform: 'blog', reason: 'platform_not_schedulable' }],
      },
    });
  });

  it('reports a scheduler failure on one platform instead of swallowing it', async () => {
    const h = harness({
      draft: draftRow({ platforms: ['facebook', 'linkedin'], metadata: {} }),
    });
    h.schedule.mockImplementation(async (input: { platform: string }) => {
      if (input.platform === 'facebook')
        throw new Error('campaign create failed');
      return {
        id: `post-${input.platform}`,
        platform: input.platform,
        scheduledAt: NOW.toISOString(),
        status: 'scheduled' as const,
      };
    });

    const result = await approveAndScheduleStudioDraft(
      {
        organizationId: 'org-carsi',
        id: 'd1',
        approvedBy: 'phill',
        client: CLIENT,
      },
      { delegate: h.delegate, schedule: h.schedule, now: () => NOW }
    );

    expect(result.scheduled.map(s => s.platform)).toEqual(['linkedin']);
    expect(result.skipped).toEqual([
      {
        platform: 'facebook',
        reason: 'schedule_failed: campaign create failed',
      },
    ]);
  });

  it('uses the caller-supplied scheduledAt and omits the link when the business has no funnel', async () => {
    const h = harness({
      draft: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });
    const later = new Date('2026-09-03T09:00:00.000Z');

    const result = await approveAndScheduleStudioDraft(
      {
        organizationId: 'org-carsi',
        id: 'd1',
        approvedBy: 'phill',
        client: { clientSlug: 'carsi', funnelUrl: null },
        scheduledAt: later,
      },
      { delegate: h.delegate, schedule: h.schedule, now: () => NOW }
    );

    const input = h.schedule.mock.calls[0][0];
    expect(input.scheduledTime).toEqual(later);
    expect(input.metadata.linkUrl).toBeUndefined();
    expect(input.content).toBe(
      'Body of the post.\n\nCTA: Save this checklist.'
    );
    expect(result.scheduled[0].linkUrl).toBeNull();
  });
});

describe('buildStudioFunnelLink', () => {
  it('tags the funnel with source / medium / campaign / content and preserves an existing query', () => {
    expect(
      buildStudioFunnelLink('https://restoreassist.com.au/pricing?ref=li', {
        platform: 'linkedin',
        clientSlug: 'restoreassist',
        draftId: 'd9',
      })
    ).toBe(
      'https://restoreassist.com.au/pricing?ref=li&utm_source=linkedin&utm_medium=social&utm_campaign=studio-restoreassist&utm_content=d9'
    );
  });

  it('returns null when there is no funnel', () => {
    expect(
      buildStudioFunnelLink(null, {
        platform: 'linkedin',
        clientSlug: 'x',
        draftId: 'd',
      })
    ).toBeNull();
  });
});
