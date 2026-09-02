/**
 * g2 — approving a Client Content Studio draft creates a scheduled Post through
 * the ONE working scheduler (lib/social/schedule-via-post.ts → Post table →
 * /api/cron/publish-scheduled). Before this, approval flipped a status and
 * stopped: "approved" meant "will never publish".
 *
 * Two rules from independent review (report synthex-3def7c867):
 *   - a draft carrying externalPublishingAllowed:false is deny-by-default; the
 *     pack's per-platform externalPublishBlocks must each be discharged
 *     (approval = this click; credentials = an active platform connection for
 *     the business; anything else = a recorded clearance) before a Post exists;
 *   - approval is never consumed when nothing was scheduled: the draft returns
 *     to awaiting_approval so it can be retried without duplicate Posts.
 *
 * Everything is injected — no database, no network.
 */

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { studioContentDraft: {}, platformConnection: {} },
  prisma: { studioContentDraft: {}, platformConnection: {} },
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
  APPROVAL_BLOCKER,
  CREDENTIALS_BLOCKER,
  InvalidClearanceError,
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

/** The exact shape scripts/seed-carsi-authority-studio-drafts.ts writes. */
const SEEDED_CARSI_METADATA = {
  authorityCampaignId: 'carsi-restoration-training-authority-2026-06-11',
  ownedMediaGate: { allowed: true, blockers: [], warnings: [] },
  externalPublishBlocks: {
    linkedin: [
      'platform_credentials_required',
      'human_or_client_approval_required',
      'final_asset_rights_check_required',
    ],
    facebook: [
      'platform_credentials_required',
      'human_or_client_approval_required',
      'final_asset_rights_check_required',
    ],
  },
  externalPublishingAllowed: false,
};

function harness(
  opts: {
    approveCount?: number;
    draft?: unknown;
    credentialsReady?: boolean;
  } = {}
) {
  const updateMany = jest
    .fn()
    .mockResolvedValueOnce({ count: opts.approveCount ?? 1 }) // the approval
    .mockResolvedValue({ count: 1 }); // the record / the revert
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
  const credentialsReady = jest.fn(async () => opts.credentialsReady ?? true);
  // No Post exists yet for any draft + platform unless a test says otherwise.
  const findScheduledStudioPost = jest.fn(async () => null);
  const deps = {
    delegate,
    schedule,
    credentialsReady,
    findScheduledStudioPost,
    now: () => NOW,
  };
  return {
    delegate,
    updateMany,
    findFirst,
    schedule,
    credentialsReady,
    findScheduledStudioPost,
    deps,
  };
}

const CLIENT = { clientSlug: 'carsi', funnelUrl: 'https://carsi.au/courses' };
const INPUT = {
  organizationId: 'org-carsi',
  id: 'd1',
  approvedBy: 'phill',
  client: CLIENT,
};

describe('approveAndScheduleStudioDraft', () => {
  it('creates one scheduled Post per schedulable platform, scoped to the DRAFT organisation', async () => {
    const h = harness();

    const result = await approveAndScheduleStudioDraft(INPUT, h.deps);

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
      outcome: 'approved',
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
      { ...INPUT, organizationId: 'org-other', approvedBy: 'attacker' },
      h.deps
    );

    expect(result).toEqual({
      approved: false,
      outcome: 'not_awaiting_approval',
      scheduled: [],
      skipped: [],
    });
    expect(h.findFirst).not.toHaveBeenCalled();
    expect(h.schedule).not.toHaveBeenCalled();
    expect(h.updateMany).toHaveBeenCalledTimes(1);
  });

  it("refuses to schedule when the pack's owned-media rights gate is false, and hands the draft back", async () => {
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

    const result = await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(h.schedule).not.toHaveBeenCalled();
    expect(result).toEqual({
      approved: false,
      outcome: 'blocked',
      scheduled: [],
      skipped: [
        { platform: 'linkedin', reason: 'owned_media_gate_blocked' },
        { platform: 'blog', reason: 'owned_media_gate_blocked' },
      ],
    });
    // Approval is not consumed: the draft is returned to awaiting_approval.
    const revert = h.updateMany.mock.calls[1][0];
    expect(revert.where).toEqual({
      id: 'd1',
      organizationId: 'org-carsi',
      status: 'approved',
    });
    expect(revert.data.status).toBe('awaiting_approval');
  });

  it('attaches the rendered video as media and keeps the funnel link in the text where a card cannot carry it', async () => {
    const h = harness({
      draft: draftRow({
        platforms: ['linkedin'],
        videoUrl: 'https://cdn.example/carsi-d1.mp4',
        metadata: {},
      }),
    });

    await approveAndScheduleStudioDraft(INPUT, h.deps);

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

    await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(h.updateMany).toHaveBeenCalledTimes(2);
    const record = h.updateMany.mock.calls[1][0];
    expect(record.where).toEqual({ id: 'd1', organizationId: 'org-carsi' });
    expect(record.data.status).toBeUndefined(); // stays approved
    expect(record.data.metadata).toMatchObject({
      // Existing metadata is preserved, not overwritten.
      authorityCampaignId: 'carsi-restoration-training-authority-2026-06-11',
      externalPublishingAllowed: true,
      externalPublishApprovedBy: 'phill',
      externalPublishApprovedAt: NOW.toISOString(),
      externalPublishClearances: {
        [APPROVAL_BLOCKER]: {
          clearedBy: 'phill',
          clearedAt: NOW.toISOString(),
          via: 'studio_approval',
        },
      },
      studioSchedule: {
        scheduled: [{ platform: 'linkedin', postId: 'post-linkedin' }],
        skipped: [{ platform: 'blog', reason: 'platform_not_schedulable' }],
      },
    });
  });

  it('reports a scheduler failure on one platform instead of swallowing it, keeping the approval when another platform scheduled', async () => {
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

    const result = await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(result.approved).toBe(true);
    expect(result.outcome).toBe('approved');
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
        ...INPUT,
        client: { clientSlug: 'carsi', funnelUrl: null },
        scheduledAt: later,
      },
      h.deps
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

describe("the campaign pack's external-publish blocks (review P1-CARSI-EXTERNAL-PUBLISH-BLOCKS-BYPASSED)", () => {
  it('denies the exact seeded CARSI shape: approval alone does not discharge credentials or rights', async () => {
    const h = harness({
      draft: draftRow({
        platforms: ['linkedin'],
        metadata: SEEDED_CARSI_METADATA,
      }),
      credentialsReady: false,
    });

    const result = await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(h.schedule).not.toHaveBeenCalled();
    expect(result).toEqual({
      approved: false,
      outcome: 'blocked',
      scheduled: [],
      skipped: [
        {
          platform: 'linkedin',
          reason:
            'external_publish_blocked: platform_credentials_required, final_asset_rights_check_required',
        },
      ],
    });

    // Handed back for retry, the denial left in place, the approval recorded.
    const revert = h.updateMany.mock.calls[1][0];
    expect(revert.where).toEqual({
      id: 'd1',
      organizationId: 'org-carsi',
      status: 'approved',
    });
    expect(revert.data.status).toBe('awaiting_approval');
    expect(revert.data.metadata.externalPublishingAllowed).toBe(false);
    expect(revert.data.metadata.externalPublishBlocks).toEqual(
      SEEDED_CARSI_METADATA.externalPublishBlocks
    );
    expect(
      revert.data.metadata.externalPublishClearances[APPROVAL_BLOCKER]
    ).toEqual({
      clearedBy: 'phill',
      clearedAt: NOW.toISOString(),
      via: 'studio_approval',
    });
    expect(revert.data.metadata.studioSchedule.skipped).toEqual(result.skipped);
  });

  it('schedules once credentials are live for the business and the rights check is explicitly cleared by the approver', async () => {
    const h = harness({
      draft: draftRow({
        platforms: ['linkedin'],
        metadata: SEEDED_CARSI_METADATA,
      }),
      credentialsReady: true,
    });

    const result = await approveAndScheduleStudioDraft(
      { ...INPUT, clearances: ['final_asset_rights_check_required'] },
      h.deps
    );

    expect(h.credentialsReady).toHaveBeenCalledWith('linkedin');
    expect(h.schedule).toHaveBeenCalledTimes(1);
    expect(result.approved).toBe(true);
    expect(result.outcome).toBe('approved');

    const record = h.updateMany.mock.calls[1][0];
    expect(record.data.status).toBeUndefined();
    expect(record.data.metadata.externalPublishingAllowed).toBe(true);
    expect(record.data.metadata.externalPublishClearances).toEqual({
      [APPROVAL_BLOCKER]: {
        clearedBy: 'phill',
        clearedAt: NOW.toISOString(),
        via: 'studio_approval',
      },
      final_asset_rights_check_required: {
        clearedBy: 'phill',
        clearedAt: NOW.toISOString(),
        via: 'studio_approval',
      },
    });
  });

  it('honours a clearance recorded on an earlier attempt', async () => {
    const h = harness({
      draft: draftRow({
        platforms: ['linkedin'],
        metadata: {
          ...SEEDED_CARSI_METADATA,
          externalPublishClearances: {
            final_asset_rights_check_required: {
              clearedBy: 'phill',
              clearedAt: '2026-09-01T00:00:00.000Z',
              via: 'studio_approval',
            },
          },
        },
      }),
      credentialsReady: true,
    });

    const result = await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(h.schedule).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe('approved');
  });

  it('never flips externalPublishingAllowed to true while a platform is still blocked', async () => {
    const h = harness({
      draft: draftRow({
        platforms: ['linkedin', 'facebook'],
        metadata: SEEDED_CARSI_METADATA,
      }),
    });
    // linkedin has credentials; facebook does not.
    h.credentialsReady.mockImplementation(
      async (platform: string) => platform === 'linkedin'
    );

    const result = await approveAndScheduleStudioDraft(
      { ...INPUT, clearances: ['final_asset_rights_check_required'] },
      h.deps
    );

    expect(result.outcome).toBe('approved');
    expect(result.scheduled.map(s => s.platform)).toEqual(['linkedin']);
    expect(result.skipped).toEqual([
      {
        platform: 'facebook',
        reason: `external_publish_blocked: ${CREDENTIALS_BLOCKER}`,
      },
    ]);
    const record = h.updateMany.mock.calls[1][0];
    expect(record.data.metadata.externalPublishingAllowed).toBe(false);
  });

  it('denies by default when externalPublishingAllowed is false and no blocker list exists to discharge', async () => {
    const h = harness({
      draft: draftRow({
        platforms: ['linkedin'],
        metadata: { externalPublishingAllowed: false },
      }),
    });

    const result = await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(h.schedule).not.toHaveBeenCalled();
    expect(result.outcome).toBe('blocked');
    expect(result.skipped).toEqual([
      { platform: 'linkedin', reason: 'external_publishing_denied' },
    ]);
  });
});

describe('approval is never consumed by a schedule that produced nothing (review P1-APPROVAL-CONSUMED-WITH-ZERO-SCHEDULED-POSTS)', () => {
  it('returns the draft to awaiting_approval on a total scheduler failure and reports it', async () => {
    const h = harness({
      draft: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });
    h.schedule.mockRejectedValue(new Error('database unavailable'));

    const result = await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(result).toEqual({
      approved: false,
      outcome: 'schedule_failed',
      scheduled: [],
      skipped: [
        {
          platform: 'linkedin',
          reason: 'schedule_failed: database unavailable',
        },
      ],
    });
    const revert = h.updateMany.mock.calls[1][0];
    expect(revert.where).toEqual({
      id: 'd1',
      organizationId: 'org-carsi',
      status: 'approved',
    });
    expect(revert.data).toMatchObject({
      status: 'awaiting_approval',
      approvedBy: null,
      approvedAt: null,
    });
    expect(revert.data.metadata.studioSchedule).toMatchObject({
      scheduled: [],
      skipped: result.skipped,
    });
  });

  it('can then be retried, producing exactly one Post and no duplicate', async () => {
    const first = harness({
      draft: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });
    first.schedule.mockRejectedValue(new Error('database unavailable'));
    const failed = await approveAndScheduleStudioDraft(INPUT, first.deps);
    expect(failed.outcome).toBe('schedule_failed');
    expect(first.schedule).toHaveBeenCalledTimes(1);

    // The draft is awaiting_approval again, so the org-scoped claim matches once more.
    const retry = harness({
      draft: draftRow({
        platforms: ['linkedin'],
        metadata: first.updateMany.mock.calls[1][0].data.metadata,
      }),
    });
    const ok = await approveAndScheduleStudioDraft(INPUT, retry.deps);

    expect(ok.outcome).toBe('approved');
    expect(retry.schedule).toHaveBeenCalledTimes(1);
    expect(ok.scheduled).toHaveLength(1);
  });

  it('keeps the approval when no platform is cron-schedulable at all (owned media only)', async () => {
    const h = harness({
      draft: draftRow({ platforms: ['blog', 'newsletter'], metadata: {} }),
    });

    const result = await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(h.schedule).not.toHaveBeenCalled();
    expect(result.approved).toBe(true);
    expect(result.outcome).toBe('approved');
    expect(result.skipped).toEqual([
      { platform: 'blog', reason: 'platform_not_schedulable' },
      { platform: 'newsletter', reason: 'platform_not_schedulable' },
    ]);
    expect(h.updateMany.mock.calls[1][0].data.status).toBeUndefined();
  });
});

describe('review round 2 — P1-CALLER-CAN-CLEAR-CREDENTIALS-BLOCKER', () => {
  it('refuses a request that names the credentials blocker, before any claim is made', async () => {
    const h = harness({
      draft: draftRow({
        platforms: ['linkedin'],
        metadata: SEEDED_CARSI_METADATA,
      }),
      credentialsReady: false,
    });

    await expect(
      approveAndScheduleStudioDraft(
        {
          ...INPUT,
          clearances: [
            CREDENTIALS_BLOCKER,
            'final_asset_rights_check_required',
          ],
        },
        h.deps
      )
    ).rejects.toBeInstanceOf(InvalidClearanceError);

    expect(h.updateMany).not.toHaveBeenCalled();
    expect(h.schedule).not.toHaveBeenCalled();
    expect(h.credentialsReady).not.toHaveBeenCalled();
  });

  it('refuses a request that names the approval blocker', async () => {
    const h = harness({
      draft: draftRow({
        platforms: ['linkedin'],
        metadata: SEEDED_CARSI_METADATA,
      }),
    });

    await expect(
      approveAndScheduleStudioDraft(
        { ...INPUT, clearances: [APPROVAL_BLOCKER] },
        h.deps
      )
    ).rejects.toBeInstanceOf(InvalidClearanceError);
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it('never lets a recorded credentials clearance stand in for a live connection', async () => {
    const h = harness({
      draft: draftRow({
        platforms: ['linkedin'],
        metadata: {
          ...SEEDED_CARSI_METADATA,
          externalPublishClearances: {
            [CREDENTIALS_BLOCKER]: {
              clearedBy: 'someone',
              clearedAt: '2026-09-01T00:00:00.000Z',
              via: 'unknown',
            },
            final_asset_rights_check_required: {
              clearedBy: 'phill',
              clearedAt: '2026-09-01T00:00:00.000Z',
              via: 'studio_approval',
            },
          },
        },
      }),
      credentialsReady: false,
    });

    const result = await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(h.credentialsReady).toHaveBeenCalledWith('linkedin');
    expect(h.schedule).not.toHaveBeenCalled();
    expect(result.outcome).toBe('blocked');
    expect(result.skipped).toEqual([
      {
        platform: 'linkedin',
        reason: `external_publish_blocked: ${CREDENTIALS_BLOCKER}`,
      },
    ]);
  });
});

describe('review round 2 — P1-SCHEDULE-RETRY-LACKS-IDEMPOTENCY', () => {
  type StoredPost = {
    id: string;
    platform: string;
    draftId: string;
    scheduledAt: string;
  };

  it('an ambiguous post-commit scheduler failure still leaves exactly one Post after a retry', async () => {
    // Persisted Post state shared across both attempts.
    const posts: StoredPost[] = [];
    const findScheduledStudioPost = jest.fn(
      async (draftId: string, platform: string) =>
        posts.find(p => p.draftId === draftId && p.platform === platform) ??
        null
    );

    const first = harness({
      draft: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });
    first.schedule.mockImplementation(
      async (input: {
        platform: string;
        metadata?: Record<string, unknown>;
      }) => {
        // The scheduler commits its Post, then the connection drops.
        posts.push({
          id: 'post-linkedin-1',
          platform: input.platform,
          draftId: String(input.metadata?.studioDraftId),
          scheduledAt: NOW.toISOString(),
        });
        throw new Error('connection lost after commit');
      }
    );
    const failed = await approveAndScheduleStudioDraft(INPUT, {
      ...first.deps,
      findScheduledStudioPost,
    });
    expect(failed.outcome).toBe('schedule_failed');
    expect(posts).toHaveLength(1);

    const retry = harness({
      draft: draftRow({
        platforms: ['linkedin'],
        metadata: first.updateMany.mock.calls[1][0].data.metadata,
      }),
    });
    const ok = await approveAndScheduleStudioDraft(INPUT, {
      ...retry.deps,
      findScheduledStudioPost,
    });

    // The existing Post is found and reused; no second Post is created.
    expect(retry.schedule).not.toHaveBeenCalled();
    expect(ok.outcome).toBe('approved');
    expect(ok.scheduled).toEqual([
      {
        platform: 'linkedin',
        postId: 'post-linkedin-1',
        scheduledAt: NOW.toISOString(),
        linkUrl:
          'https://carsi.au/courses?utm_source=linkedin&utm_medium=social&utm_campaign=studio-carsi&utm_content=d1',
        reused: true,
      },
    ]);
    expect(posts).toHaveLength(1);
  });

  it('treats a failing idempotency lookup as a schedule failure and hands the draft back (review round 3)', async () => {
    const h = harness({
      draft: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });
    const findScheduledStudioPost = jest
      .fn()
      .mockRejectedValue(new Error('lookup unavailable'));

    const result = await approveAndScheduleStudioDraft(INPUT, {
      ...h.deps,
      findScheduledStudioPost,
    });

    expect(h.schedule).not.toHaveBeenCalled();
    expect(result).toEqual({
      approved: false,
      outcome: 'schedule_failed',
      scheduled: [],
      skipped: [
        { platform: 'linkedin', reason: 'schedule_failed: lookup unavailable' },
      ],
    });
    const revert = h.updateMany.mock.calls[1][0];
    expect(revert.where).toEqual({
      id: 'd1',
      organizationId: 'org-carsi',
      status: 'approved',
    });
    expect(revert.data).toMatchObject({
      status: 'awaiting_approval',
      approvedBy: null,
      approvedAt: null,
    });
  });

  it('reports the status of a reused Post so a terminal one is not mislabelled as scheduled', async () => {
    const findScheduledStudioPost = jest.fn(async () => ({
      id: 'post-linkedin-old',
      platform: 'linkedin',
      scheduledAt: '2026-09-01T00:00:00.000Z',
      status: 'failed',
    }));
    const h = harness({
      draft: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });

    const result = await approveAndScheduleStudioDraft(INPUT, {
      ...h.deps,
      findScheduledStudioPost,
    });

    expect(h.schedule).not.toHaveBeenCalled();
    expect(result.scheduled[0]).toMatchObject({
      postId: 'post-linkedin-old',
      reused: true,
      status: 'failed',
    });
  });

  it('looks for an existing Post before every schedule and stamps a stable idempotency key', async () => {
    const findScheduledStudioPost = jest.fn(async () => null);
    const h = harness({
      draft: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });

    await approveAndScheduleStudioDraft(INPUT, {
      ...h.deps,
      findScheduledStudioPost,
    });

    expect(findScheduledStudioPost).toHaveBeenCalledWith('d1', 'linkedin');
    expect(h.schedule).toHaveBeenCalledTimes(1);
    expect(h.schedule.mock.calls[0][0].metadata.idempotencyKey).toBe(
      'studio:d1:linkedin'
    );
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
