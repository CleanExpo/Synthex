/**
 * g2 — approving a Client Content Studio draft creates a scheduled Post through
 * the ONE working scheduler (lib/social/schedule-via-post.ts → Post table →
 * /api/cron/publish-scheduled). Before this, approval flipped a status and
 * stopped: "approved" meant "will never publish".
 *
 * Rules from independent review (reports synthex-3def7c867 … synthex-f59792768):
 *   - a draft carrying externalPublishingAllowed:false is deny-by-default; the
 *     pack's per-platform externalPublishBlocks must each be discharged
 *     (approval = this click; credentials = an active platform connection for
 *     the business; anything else = a recorded clearance) before a Post exists;
 *   - approval is never consumed when nothing was scheduled: the claim and the
 *     schedule are ONE transaction, so a blocked or failed schedule rolls the
 *     claim back and the draft is still awaiting_approval. No compensating
 *     write exists to fail (round 5).
 *
 * Everything is injected — no database, no network. The draft table is an
 * in-memory row with a staged copy per transaction: writes made inside a
 * transaction reach the committed row only when the transaction returns
 * normally, which is exactly how Postgres behaves.
 */

import type { Prisma } from '@prisma/client';

// The default lookups read the Post and PlatformConnection tables through the
// transaction client; the default runner is prisma.$transaction. A fake
// two-organisation Post table lets the org-scoping test run the REAL default query.
const mockPostFindFirst = jest.fn();
const mockConnectionFindFirst = jest.fn();
const mockTransaction = jest.fn();
const mockGlobalDraftUpdateMany = jest.fn();
jest.mock('@/lib/prisma', () => {
  const client = {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    studioContentDraft: {
      updateMany: (...args: unknown[]) => mockGlobalDraftUpdateMany(...args),
    },
    platformConnection: {
      findFirst: (...args: unknown[]) => mockConnectionFindFirst(...args),
    },
    post: { findFirst: (...args: unknown[]) => mockPostFindFirst(...args) },
  };
  return { __esModule: true, default: client, prisma: client };
});
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

import { logger } from '@/lib/logger';
import {
  approveAndScheduleStudioDraft,
  buildStudioFunnelLink,
  APPROVAL_BLOCKER,
  CREDENTIALS_BLOCKER,
  InvalidClearanceError,
  type StudioTransactionRunner,
} from '@/lib/marketing-agency/studio/approve-and-schedule';
import type { StudioDraftDelegate } from '@/lib/marketing-agency/studio/draft-store';

const NOW = new Date('2026-09-02T14:00:00.000Z');

type Row = Record<string, unknown> & {
  id: string;
  organizationId: string;
  status: string;
};

function draftRow(overrides: Record<string, unknown> = {}): Row {
  return {
    id: 'd1',
    organizationId: 'org-carsi',
    status: 'awaiting_approval',
    approvedBy: null,
    approvedAt: null,
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

type Write = { where: Record<string, unknown>; data: Record<string, unknown> };

const matches = (row: Row, where: Record<string, unknown>) =>
  Object.entries(where).every(([key, value]) => row[key] === value);

/**
 * One draft row in a fake table with real transaction semantics: a transaction
 * works on a staged copy that replaces the committed row only when the
 * callback returns; a throw discards the copy. The outside delegate writes
 * straight to the committed row, as the real global client would.
 */
function harness(opts: { row?: Row | null; credentialsReady?: boolean } = {}) {
  const committed: Row[] = opts.row === null ? [] : [opts.row ?? draftRow()];
  let staged: Row[] = [];
  const txWrites: Write[] = [];
  const outsideWrites: Write[] = [];
  let rollbacks = 0;
  let txWriteFails: ((write: Write) => boolean) | null = null;

  const applyUpdate = (rows: Row[], write: Write) => {
    const hit = rows.filter(row => matches(row, write.where));
    for (const row of hit) Object.assign(row, write.data);
    return { count: hit.length };
  };

  const txDelegate = {
    updateMany: jest.fn(async (write: Write) => {
      if (txWriteFails?.(write)) throw new Error('draft record unavailable');
      txWrites.push(write);
      return applyUpdate(staged, write);
    }),
    findFirst: jest.fn(
      async ({
        where,
        select,
      }: {
        where: Record<string, unknown>;
        select?: Record<string, boolean>;
      }) => {
        const row = staged.find(candidate => matches(candidate, where));
        if (!row) return null;
        return select
          ? Object.fromEntries(Object.keys(select).map(key => [key, row[key]]))
          : { ...row };
      }
    ),
  };
  const tx = {
    studioContentDraft: txDelegate,
    post: { findFirst: (...args: unknown[]) => mockPostFindFirst(...args) },
    platformConnection: {
      findFirst: (...args: unknown[]) => mockConnectionFindFirst(...args),
    },
  } as unknown as Prisma.TransactionClient;

  const runInTransaction = jest.fn(
    async (fn: (client: Prisma.TransactionClient) => Promise<unknown>) => {
      staged = committed.map(row => ({ ...row }));
      let result: unknown;
      try {
        result = await fn(tx);
      } catch (error) {
        rollbacks += 1; // the staged copy is discarded
        throw error;
      }
      committed.splice(0, committed.length, ...staged);
      return result;
    }
  );

  const delegate = {
    updateMany: jest.fn(async (write: Write) => {
      outsideWrites.push(write);
      return applyUpdate(committed, write);
    }),
    findFirst: jest.fn(),
  };

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
    runInTransaction: runInTransaction as unknown as StudioTransactionRunner,
    delegate: delegate as unknown as StudioDraftDelegate,
    schedule,
    credentialsReady,
    findScheduledStudioPost,
    now: () => NOW,
  };
  return {
    deps,
    tx,
    txDelegate,
    runInTransaction,
    delegate,
    schedule,
    credentialsReady,
    findScheduledStudioPost,
    /** Draft-table writes made inside a transaction, committed or not. */
    txWrites,
    /** Draft-table writes made outside any transaction. */
    outsideWrites,
    /** The committed row, as the next request would read it. */
    draft: () => committed.find(row => row.id === 'd1') ?? null,
    rollbacks: () => rollbacks,
    failTxWrite: (predicate: (write: Write) => boolean) => {
      txWriteFails = predicate;
    },
  };
}

const CLIENT = { clientSlug: 'carsi', funnelUrl: 'https://carsi.au/courses' };
const INPUT = {
  organizationId: 'org-carsi',
  id: 'd1',
  approvedBy: 'phill',
  client: CLIENT,
};

const CLAIM_WHERE = {
  id: 'd1',
  organizationId: 'org-carsi',
  status: 'awaiting_approval',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('approveAndScheduleStudioDraft', () => {
  it('creates one scheduled Post per schedulable platform, scoped to the DRAFT organisation', async () => {
    const h = harness();

    const result = await approveAndScheduleStudioDraft(INPUT, h.deps);

    // The human-approval gate ran first, org-scoped, only on awaiting_approval,
    // inside the transaction.
    expect(h.runInTransaction).toHaveBeenCalledTimes(1);
    expect(h.txWrites[0].where).toEqual(CLAIM_WHERE);

    // Exactly one Post: linkedin is schedulable, blog is not.
    expect(h.schedule).toHaveBeenCalledTimes(1);
    const [input, client] = h.schedule.mock.calls[0] as unknown[];
    expect(client).toBe(h.tx); // the Post is created inside the same transaction
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
    expect(h.draft()).toMatchObject({
      status: 'approved',
      approvedBy: 'phill',
    });
    expect(h.rollbacks()).toBe(0);
  });

  it('does nothing when the approval matched no row (wrong org / not awaiting / missing)', async () => {
    const h = harness();

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
    expect(h.txDelegate.findFirst).not.toHaveBeenCalled();
    expect(h.schedule).not.toHaveBeenCalled();
    expect(h.txWrites).toHaveLength(1); // the claim, which matched nothing
    expect(h.outsideWrites).toHaveLength(0);
    expect(h.draft()).toMatchObject({
      status: 'awaiting_approval',
      approvedBy: null,
    });
  });

  it("refuses to schedule when the pack's owned-media rights gate is false, and the draft stays awaiting approval", async () => {
    const h = harness({
      row: draftRow({
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
    // Approval is not consumed: the claim rolled back, nothing wrote it back.
    expect(h.rollbacks()).toBe(1);
    expect(h.draft()).toMatchObject({
      status: 'awaiting_approval',
      approvedBy: null,
      approvedAt: null,
    });
    // The attempt is recorded afterwards, on the still-awaiting row, metadata only.
    expect(h.outsideWrites).toHaveLength(1);
    expect(h.outsideWrites[0].where).toEqual(CLAIM_WHERE);
    expect(h.outsideWrites[0].data.status).toBeUndefined();
    expect(h.outsideWrites[0].data.metadata).toMatchObject({
      studioSchedule: { scheduled: [], skipped: result.skipped },
    });
  });

  it('attaches the rendered video as media and keeps the funnel link in the text where a card cannot carry it', async () => {
    const h = harness({
      row: draftRow({
        platforms: ['linkedin'],
        videoUrl: 'https://cdn.example/carsi-d1.mp4',
        metadata: {},
      }),
    });

    await approveAndScheduleStudioDraft(INPUT, h.deps);

    const input = h.schedule.mock.calls[0][0] as {
      mediaUrls: string[];
      metadata: { linkUrl?: string };
      content: string;
    };
    expect(input.mediaUrls).toEqual(['https://cdn.example/carsi-d1.mp4']);
    // No authority campaign on this draft → the studio-<client> campaign tag.
    const link =
      'https://carsi.au/courses?utm_source=linkedin&utm_medium=social&utm_campaign=studio-carsi&utm_content=d1';
    expect(input.metadata.linkUrl).toBe(link);
    // LinkedIn ignores linkUrl when media is present, so the link must not be lost.
    expect(input.content.endsWith(`\n\n${link}`)).toBe(true);
  });

  it('records the approval and the schedule on the draft, inside the transaction', async () => {
    const h = harness();

    await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(h.txWrites).toHaveLength(2);
    expect(h.outsideWrites).toHaveLength(0);
    const record = h.txWrites[1];
    expect(record.where).toEqual({ id: 'd1', organizationId: 'org-carsi' });
    expect(record.data.status).toBeUndefined(); // stays approved
    expect(h.draft()?.metadata).toMatchObject({
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

  it('a scheduler failure on one platform rolls back every platform: nothing is scheduled and the draft is handed back', async () => {
    // Postgres aborts a transaction at its first failed statement, so a failure
    // on one platform cannot be swallowed and the loop continued — the Post
    // already created for the other platform rolls back with the claim.
    const h = harness({
      row: draftRow({ platforms: ['linkedin', 'facebook'], metadata: {} }),
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

    expect(h.schedule).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      approved: false,
      outcome: 'schedule_failed',
      scheduled: [],
      skipped: [
        { platform: 'linkedin', reason: 'rolled_back' },
        {
          platform: 'facebook',
          reason: 'schedule_failed: campaign create failed',
        },
      ],
    });
    expect(h.rollbacks()).toBe(1);
    expect(h.draft()).toMatchObject({
      status: 'awaiting_approval',
      approvedBy: null,
    });
    expect(h.outsideWrites[0].data.metadata).toMatchObject({
      studioSchedule: { scheduled: [], skipped: result.skipped },
    });
  });

  it('uses the caller-supplied scheduledAt and omits the link when the business has no funnel', async () => {
    const h = harness({
      row: draftRow({ platforms: ['linkedin'], metadata: {} }),
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

    const input = h.schedule.mock.calls[0][0] as {
      scheduledTime: Date;
      metadata: { linkUrl?: string };
      content: string;
    };
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
      row: draftRow({
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

    // Still awaiting approval, the denial left in place, the approval recorded.
    expect(h.draft()).toMatchObject({
      status: 'awaiting_approval',
      approvedBy: null,
    });
    const recorded = h.draft()?.metadata as Record<string, unknown>;
    expect(recorded.externalPublishingAllowed).toBe(false);
    expect(recorded.externalPublishBlocks).toEqual(
      SEEDED_CARSI_METADATA.externalPublishBlocks
    );
    expect(
      (recorded.externalPublishClearances as Record<string, unknown>)[
        APPROVAL_BLOCKER
      ]
    ).toEqual({
      clearedBy: 'phill',
      clearedAt: NOW.toISOString(),
      via: 'studio_approval',
    });
    expect((recorded.studioSchedule as { skipped: unknown }).skipped).toEqual(
      result.skipped
    );
  });

  it('schedules once credentials are live for the business and the rights check is explicitly cleared by the approver', async () => {
    const h = harness({
      row: draftRow({
        platforms: ['linkedin'],
        metadata: SEEDED_CARSI_METADATA,
      }),
      credentialsReady: true,
    });

    const result = await approveAndScheduleStudioDraft(
      { ...INPUT, clearances: ['final_asset_rights_check_required'] },
      h.deps
    );

    expect(h.credentialsReady.mock.calls[0][0]).toBe('linkedin');
    expect(h.credentialsReady.mock.calls[0][1]).toBe(h.tx);
    expect(h.schedule).toHaveBeenCalledTimes(1);
    expect(result.approved).toBe(true);
    expect(result.outcome).toBe('approved');

    expect(h.draft()?.status).toBe('approved');
    const recorded = h.draft()?.metadata as Record<string, unknown>;
    expect(recorded.externalPublishingAllowed).toBe(true);
    expect(recorded.externalPublishClearances).toEqual({
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
      row: draftRow({
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
      row: draftRow({
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
    const recorded = h.draft()?.metadata as Record<string, unknown>;
    expect(recorded.externalPublishingAllowed).toBe(false);
  });

  it('denies by default when externalPublishingAllowed is false and no blocker list exists to discharge', async () => {
    const h = harness({
      row: draftRow({
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
    expect(h.draft()?.status).toBe('awaiting_approval');
  });
});

describe('approval is never consumed by a schedule that produced nothing (review P1-APPROVAL-CONSUMED-WITH-ZERO-SCHEDULED-POSTS)', () => {
  it('leaves the draft awaiting approval on a total scheduler failure and reports it', async () => {
    const h = harness({
      row: draftRow({ platforms: ['linkedin'], metadata: {} }),
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
    expect(h.rollbacks()).toBe(1);
    expect(h.draft()).toMatchObject({
      status: 'awaiting_approval',
      approvedBy: null,
      approvedAt: null,
    });
    expect(h.outsideWrites[0].data.metadata).toMatchObject({
      studioSchedule: { scheduled: [], skipped: result.skipped },
    });
  });

  it('can then be retried on the same row, producing exactly one Post and no duplicate', async () => {
    const h = harness({
      row: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });
    h.schedule.mockRejectedValueOnce(new Error('database unavailable'));

    const failed = await approveAndScheduleStudioDraft(INPUT, h.deps);
    expect(failed.outcome).toBe('schedule_failed');
    expect(h.schedule).toHaveBeenCalledTimes(1);

    // The draft is awaiting_approval, so the org-scoped claim matches once more.
    const ok = await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(ok.outcome).toBe('approved');
    expect(h.schedule).toHaveBeenCalledTimes(2);
    expect(ok.scheduled).toHaveLength(1);
    expect(h.draft()?.status).toBe('approved');
    expect(h.runInTransaction).toHaveBeenCalledTimes(2);
  });

  it('keeps the approval when no platform is cron-schedulable at all (owned media only)', async () => {
    const h = harness({
      row: draftRow({ platforms: ['blog', 'newsletter'], metadata: {} }),
    });

    const result = await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(h.schedule).not.toHaveBeenCalled();
    expect(result.approved).toBe(true);
    expect(result.outcome).toBe('approved');
    expect(result.skipped).toEqual([
      { platform: 'blog', reason: 'platform_not_schedulable' },
      { platform: 'newsletter', reason: 'platform_not_schedulable' },
    ]);
    expect(h.txWrites[1].data.status).toBeUndefined();
    expect(h.draft()?.status).toBe('approved');
  });
});

describe('review round 2 — P1-CALLER-CAN-CLEAR-CREDENTIALS-BLOCKER', () => {
  it('refuses a request that names the credentials blocker, before any claim is made', async () => {
    const h = harness({
      row: draftRow({
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

    expect(h.runInTransaction).not.toHaveBeenCalled();
    expect(h.txWrites).toHaveLength(0);
    expect(h.schedule).not.toHaveBeenCalled();
    expect(h.credentialsReady).not.toHaveBeenCalled();
  });

  it('refuses a request that names the approval blocker', async () => {
    const h = harness({
      row: draftRow({
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
    expect(h.runInTransaction).not.toHaveBeenCalled();
  });

  it('never lets a recorded credentials clearance stand in for a live connection', async () => {
    const h = harness({
      row: draftRow({
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

    expect(h.credentialsReady.mock.calls[0][0]).toBe('linkedin');
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

  it('a Post that survived an earlier attempt is reused on retry, never duplicated', async () => {
    // Persisted Post state shared across both attempts: a Post written outside
    // this transaction (a scheduler that ignored the client, an older code
    // path) survives the rollback and must be found, not duplicated.
    const posts: StoredPost[] = [];
    const findScheduledStudioPost = jest.fn(
      async (draftId: string, platform: string) =>
        posts.find(p => p.draftId === draftId && p.platform === platform) ??
        null
    );
    const h = harness({
      row: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });
    h.schedule.mockImplementationOnce(
      async (input: {
        platform: string;
        metadata?: Record<string, unknown>;
      }) => {
        posts.push({
          id: 'post-linkedin-1',
          platform: input.platform,
          draftId: String(input.metadata?.studioDraftId),
          scheduledAt: NOW.toISOString(),
        });
        throw new Error('connection lost after the Post was written');
      }
    );
    const deps = { ...h.deps, findScheduledStudioPost };

    const failed = await approveAndScheduleStudioDraft(INPUT, deps);
    expect(failed.outcome).toBe('schedule_failed');
    expect(posts).toHaveLength(1);
    expect(h.draft()?.status).toBe('awaiting_approval');

    const ok = await approveAndScheduleStudioDraft(INPUT, deps);

    // The existing Post is found and reused; no second Post is created.
    expect(h.schedule).toHaveBeenCalledTimes(1);
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

  it('treats a failing idempotency lookup as a schedule failure and leaves the draft awaiting approval (review round 3)', async () => {
    const h = harness({
      row: draftRow({ platforms: ['linkedin'], metadata: {} }),
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
    expect(h.rollbacks()).toBe(1);
    expect(h.draft()).toMatchObject({
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
      status: 'published',
    }));
    const h = harness({
      row: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });

    const result = await approveAndScheduleStudioDraft(INPUT, {
      ...h.deps,
      findScheduledStudioPost,
    });

    expect(h.schedule).not.toHaveBeenCalled();
    expect(result.scheduled[0]).toMatchObject({
      postId: 'post-linkedin-old',
      reused: true,
      status: 'published',
    });
  });

  it('looks for an existing Post before every schedule, through the transaction, and stamps a stable idempotency key', async () => {
    const findScheduledStudioPost = jest.fn(async () => null);
    const h = harness({
      row: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });

    await approveAndScheduleStudioDraft(INPUT, {
      ...h.deps,
      findScheduledStudioPost,
    });

    expect(findScheduledStudioPost).toHaveBeenCalledWith(
      'd1',
      'linkedin',
      h.tx
    );
    expect(h.schedule).toHaveBeenCalledTimes(1);
    const input = h.schedule.mock.calls[0][0] as {
      metadata: { idempotencyKey: string };
    };
    expect(input.metadata.idempotencyKey).toBe('studio:d1:linkedin');
  });
});

describe('review round 4 — reuse is classified by status, every post-claim failure hands back, lookup is org-scoped', () => {
  function existingPost(status: string) {
    return jest.fn(async () => ({
      id: `post-${status}`,
      platform: 'linkedin',
      scheduledAt: '2026-09-01T00:00:00.000Z',
      status,
    }));
  }

  it('a terminal FAILED Post is not reused: a fresh Post is scheduled so the founder can retry', async () => {
    const h = harness({
      row: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });

    const result = await approveAndScheduleStudioDraft(INPUT, {
      ...h.deps,
      findScheduledStudioPost: existingPost('failed'),
    });

    expect(h.schedule).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe('approved');
    expect(result.scheduled).toHaveLength(1);
    expect(result.scheduled[0].postId).toBe('post-linkedin');
    expect(result.scheduled[0]).not.toHaveProperty('reused');
  });

  it.each(['pending_approval', 'draft'])(
    'a %s Post holds the draft back rather than duplicating or claiming success',
    async status => {
      const h = harness({
        row: draftRow({ platforms: ['linkedin'], metadata: {} }),
      });

      const result = await approveAndScheduleStudioDraft(INPUT, {
        ...h.deps,
        findScheduledStudioPost: existingPost(status),
      });

      expect(h.schedule).not.toHaveBeenCalled();
      expect(result).toEqual({
        approved: false,
        outcome: 'blocked',
        scheduled: [],
        skipped: [{ platform: 'linkedin', reason: `existing_post_${status}` }],
      });
      expect(h.draft()?.status).toBe('awaiting_approval');
    }
  );

  it.each(['scheduled', 'publishing', 'published'])(
    'a %s Post is reused and reported with its status',
    async status => {
      const h = harness({
        row: draftRow({ platforms: ['linkedin'], metadata: {} }),
      });

      const result = await approveAndScheduleStudioDraft(INPUT, {
        ...h.deps,
        findScheduledStudioPost: existingPost(status),
      });

      expect(h.schedule).not.toHaveBeenCalled();
      expect(result.outcome).toBe('approved');
      expect(result.scheduled[0]).toMatchObject({
        postId: `post-${status}`,
        reused: true,
        status,
      });
    }
  );

  it('an unknown Post status holds the draft back (never a duplicate on a status this code does not know)', async () => {
    const h = harness({
      row: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });

    const result = await approveAndScheduleStudioDraft(INPUT, {
      ...h.deps,
      findScheduledStudioPost: existingPost('archived'),
    });

    expect(h.schedule).not.toHaveBeenCalled();
    expect(result.outcome).toBe('blocked');
    expect(result.skipped).toEqual([
      { platform: 'linkedin', reason: 'existing_post_archived' },
    ]);
  });

  it('a rejected draft read after the claim rolls the claim back instead of escaping', async () => {
    const h = harness();
    h.txDelegate.findFirst.mockRejectedValueOnce(
      new Error('draft read unavailable')
    );

    const result = await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(h.schedule).not.toHaveBeenCalled();
    expect(result).toEqual({
      approved: false,
      outcome: 'schedule_failed',
      scheduled: [],
      skipped: [
        { platform: '*', reason: 'draft_read_failed: draft read unavailable' },
      ],
    });
    expect(h.rollbacks()).toBe(1);
    expect(h.draft()).toMatchObject({
      status: 'awaiting_approval',
      approvedBy: null,
      approvedAt: null,
    });
    // Nothing to record: the draft could not be read, so no metadata to merge.
    expect(h.outsideWrites).toHaveLength(0);
  });

  it('a draft that vanished after the claim is handed back too', async () => {
    const h = harness();
    h.txDelegate.findFirst.mockResolvedValueOnce(null);

    const result = await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(result).toEqual({
      approved: false,
      outcome: 'schedule_failed',
      scheduled: [],
      skipped: [{ platform: '*', reason: 'draft_unreadable_after_approval' }],
    });
    expect(h.draft()?.status).toBe('awaiting_approval');
  });

  it('the default idempotency lookup is scoped to the approving organisation and never reuses another org’s Post', async () => {
    // Two organisations, each with a Post carrying the same studioDraftId + platform.
    const table = [
      {
        id: 'post-other-org',
        platform: 'linkedin',
        scheduledAt: new Date('2026-09-01T00:00:00.000Z'),
        status: 'scheduled',
        deletedAt: null,
        metadata: { studioDraftId: 'd1' },
        campaign: { organizationId: 'org-other' },
      },
      {
        id: 'post-carsi',
        platform: 'linkedin',
        scheduledAt: new Date('2026-09-01T00:00:00.000Z'),
        status: 'scheduled',
        deletedAt: null,
        metadata: { studioDraftId: 'd1' },
        campaign: { organizationId: 'org-carsi' },
      },
    ];
    mockPostFindFirst.mockImplementation(
      async (args: {
        where: {
          platform: string;
          deletedAt: null;
          metadata: { equals: string };
          campaign?: { organizationId: string };
        };
      }) => {
        const w = args.where;
        const row = table.find(
          p =>
            p.platform === w.platform &&
            p.deletedAt === w.deletedAt &&
            p.metadata.studioDraftId === w.metadata.equals &&
            // Without the org clause this would return the other org's Post first.
            (w.campaign
              ? p.campaign.organizationId === w.campaign.organizationId
              : true)
        );
        return row
          ? {
              id: row.id,
              platform: row.platform,
              scheduledAt: row.scheduledAt,
              status: row.status,
            }
          : null;
      }
    );
    const h = harness({
      row: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });
    const { findScheduledStudioPost: _injected, ...depsWithDefaultLookup } =
      h.deps;

    const result = await approveAndScheduleStudioDraft(
      INPUT,
      depsWithDefaultLookup
    );

    expect(mockPostFindFirst).toHaveBeenCalledTimes(1);
    expect(mockPostFindFirst.mock.calls[0][0].where).toMatchObject({
      platform: 'linkedin',
      deletedAt: null,
      campaign: { organizationId: 'org-carsi' },
      metadata: { path: ['studioDraftId'], equals: 'd1' },
    });
    expect(h.schedule).not.toHaveBeenCalled();
    expect(result.scheduled[0]).toMatchObject({
      postId: 'post-carsi',
      reused: true,
    });
  });
});

describe('review round 5 — the claim and the schedule are one transaction (P1-NONTRANSACTIONAL-HAND-BACK-CAN-STILL-CONSUME-APPROVAL)', () => {
  it("a failed schedule cannot strand the draft as approved even when every later draft write fails (the reviewer's reproduction)", async () => {
    const h = harness({
      row: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });
    h.schedule.mockRejectedValue(new Error('scheduler unavailable'));
    // The same database incident that broke the schedule breaks every draft
    // write that is not the claim itself.
    h.delegate.updateMany.mockImplementation(async (write: Write) => {
      if (write.data.status === 'approved') return { count: 1 };
      throw new Error('compensation unavailable');
    });

    const result = await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(result).toEqual({
      approved: false,
      outcome: 'schedule_failed',
      scheduled: [],
      skipped: [
        {
          platform: 'linkedin',
          reason: 'schedule_failed: scheduler unavailable',
        },
      ],
    });
    // The claim never persisted, so nothing had to restore the status.
    expect(h.draft()).toMatchObject({
      status: 'awaiting_approval',
      approvedBy: null,
      approvedAt: null,
    });
    expect(h.rollbacks()).toBe(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'studio approval attempt could not be recorded',
      expect.objectContaining({ draftId: 'd1' })
    );
  });

  it('no compensating write exists: no write anywhere sets the status back to awaiting_approval', async () => {
    const h = harness({
      row: draftRow({
        platforms: ['linkedin'],
        metadata: SEEDED_CARSI_METADATA,
      }),
      credentialsReady: false,
    });

    const result = await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(result.outcome).toBe('blocked');
    expect(h.runInTransaction).toHaveBeenCalledTimes(1);
    expect(h.rollbacks()).toBe(1);
    const writes = [...h.txWrites, ...h.outsideWrites];
    expect(writes.some(w => w.data.status === 'awaiting_approval')).toBe(false);
    expect(h.outsideWrites.every(w => w.data.status === undefined)).toBe(true);
    expect(h.draft()?.status).toBe('awaiting_approval');
  });

  it('a second approval after a committed one matches nothing: the claim is the only gate', async () => {
    // Under READ COMMITTED a concurrent second claim waits on the row lock and
    // then re-evaluates `status = awaiting_approval` against the committed row,
    // which is what running it after the first call models.
    const h = harness({
      row: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });

    const first = await approveAndScheduleStudioDraft(INPUT, h.deps);
    const second = await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(first.outcome).toBe('approved');
    expect(second.outcome).toBe('not_awaiting_approval');
    expect(h.schedule).toHaveBeenCalledTimes(1);
    expect(h.draft()).toMatchObject({
      status: 'approved',
      approvedBy: 'phill',
    });
  });

  it('a failure inside the transaction after Posts were created rejects the call with the claim never persisted', async () => {
    const h = harness({
      row: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });
    // The final metadata record rejects: not a schedule outcome, a database
    // failure — the route answers 500, and the draft is untouched.
    h.failTxWrite(write => write.data.status === undefined);

    await expect(approveAndScheduleStudioDraft(INPUT, h.deps)).rejects.toThrow(
      'draft record unavailable'
    );

    expect(h.schedule).toHaveBeenCalledTimes(1);
    expect(h.rollbacks()).toBe(1);
    expect(h.draft()).toMatchObject({
      status: 'awaiting_approval',
      approvedBy: null,
    });
    expect(h.outsideWrites).toHaveLength(0);
  });

  it('a credentials read that rejects after another platform scheduled rolls everything back and never flips externalPublishingAllowed', async () => {
    const h = harness({
      row: draftRow({
        platforms: ['linkedin', 'facebook'],
        metadata: SEEDED_CARSI_METADATA,
      }),
    });
    h.credentialsReady.mockImplementation(async (platform: string) => {
      if (platform === 'facebook') throw new Error('connection read failed');
      return true;
    });

    const result = await approveAndScheduleStudioDraft(
      { ...INPUT, clearances: ['final_asset_rights_check_required'] },
      h.deps
    );

    expect(h.schedule).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      approved: false,
      outcome: 'schedule_failed',
      scheduled: [],
      skipped: [
        { platform: 'linkedin', reason: 'rolled_back' },
        {
          platform: 'facebook',
          reason: 'schedule_failed: connection read failed',
        },
      ],
    });
    expect(h.draft()?.status).toBe('awaiting_approval');
    const recorded = h.draft()?.metadata as Record<string, unknown>;
    expect(recorded.externalPublishingAllowed).toBe(false);
    expect(recorded.externalPublishBlocks).toEqual(
      SEEDED_CARSI_METADATA.externalPublishBlocks
    );
    // The approval and the named clearance are still on record for the retry.
    expect(recorded.externalPublishClearances).toMatchObject({
      [APPROVAL_BLOCKER]: { clearedBy: 'phill' },
      final_asset_rights_check_required: { clearedBy: 'phill' },
    });
  });

  it('the default runner enters exactly one interactive transaction per approval with an explicit wait and timeout', async () => {
    const h = harness({
      row: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });
    mockTransaction.mockImplementation(
      async (fn: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        h.runInTransaction(fn)
    );

    const result = await approveAndScheduleStudioDraft(INPUT, {
      ...h.deps,
      runInTransaction: undefined,
    });

    expect(result.outcome).toBe('approved');
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockTransaction.mock.calls[0][1]).toEqual({
      maxWait: 5000,
      timeout: 15000,
    });
    expect(h.draft()?.status).toBe('approved');
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
