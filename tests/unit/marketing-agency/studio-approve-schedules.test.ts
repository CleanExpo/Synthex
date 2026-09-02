/**
 * g2 — approving a Client Content Studio draft creates a scheduled Post through
 * the ONE working scheduler (lib/social/schedule-via-post.ts → Post table →
 * /api/cron/publish-scheduled). Before this, approval flipped a status and
 * stopped: "approved" meant "will never publish".
 *
 * Rules from independent review (reports synthex-3def7c867 … synthex-c29a44de0)
 * and the engineering bench (engineering.md beside the spec):
 *   - a draft carrying externalPublishingAllowed:false is deny-by-default; the
 *     pack's per-platform externalPublishBlocks must each be discharged
 *     (approval = this click; credentials = an active platform connection for
 *     the business; anything else = a recorded clearance) before a Post exists;
 *   - approval is never consumed when nothing was scheduled: the claim and the
 *     schedule are ONE transaction, so a blocked or failed schedule rolls the
 *     claim back and the draft is still awaiting_approval. No compensating
 *     write exists to fail (round 5);
 *   - ALL OR NOTHING: every eligible platform gets a Post or none does; the
 *     publish flag flips only on that positive fact; the org's publish-safety
 *     state gates Studio posts; the funnel link is in the text unless the
 *     platform renders a card; a rolled-back attempt records only its own key
 *     and never a clearance (bench, round 1).
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
const mockExecuteRaw = jest.fn();
jest.mock('@/lib/prisma', () => {
  const client = {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    $executeRaw: (...args: unknown[]) => mockExecuteRaw(...args),
    studioContentDraft: {},
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
const mockResolveGate = jest.fn();
jest.mock('@/lib/publish/safetyChecks', () => ({
  resolveOrgAutoPublishGate: (...args: unknown[]) => mockResolveGate(...args),
}));
const mockTrackError = jest.fn();
jest.mock('@/lib/observability/error-tracker', () => ({
  trackError: (...args: unknown[]) => mockTrackError(...args),
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { logger } from '@/lib/logger';
import {
  approveAndScheduleStudioDraft,
  buildStudioFunnelLink,
  publishGateBlockReason,
  APPROVAL_BLOCKER,
  CREDENTIALS_BLOCKER,
  InvalidClearanceError,
  type StudioScheduleAttempt,
  type StudioTransactionRunner,
} from '@/lib/marketing-agency/studio/approve-and-schedule';

const NOW = new Date('2026-09-02T14:00:00.000Z');
const LIVE_GATE = {
  allowed: true,
  calendarMode: 'live',
  autoPublishPaused: false,
};

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
 * callback returns; a throw discards the copy. The attempt record merges ONLY
 * its own key into the committed row, as the database-side `||` does.
 */
function harness(opts: { row?: Row | null; credentialsReady?: boolean } = {}) {
  const committed: Row[] = opts.row === null ? [] : [opts.row ?? draftRow()];
  let staged: Row[] = [];
  const txWrites: Write[] = [];
  const attempts: StudioScheduleAttempt[] = [];
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
    $executeRawUnsafe: jest.fn(async () => 0),
    studioContentDraft: txDelegate,
    post: { findFirst: (...args: unknown[]) => mockPostFindFirst(...args) },
    platformConnection: {
      findFirst: (...args: unknown[]) => mockConnectionFindFirst(...args),
    },
  } as unknown as Prisma.TransactionClient & {
    $executeRawUnsafe: jest.Mock;
  };

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

  const recordAttempt = jest.fn(
    async (
      target: { organizationId: string; id: string },
      attempt: StudioScheduleAttempt
    ) => {
      attempts.push(attempt);
      for (const row of committed) {
        if (
          row.id === target.id &&
          row.organizationId === target.organizationId &&
          row.status === 'awaiting_approval'
        ) {
          row.metadata = {
            ...(row.metadata as Record<string, unknown>),
            studioScheduleAttempt: attempt,
          };
        }
      }
    }
  );

  const schedule = jest.fn(async (input: { platform: string }) => ({
    id: `post-${input.platform}`,
    platform: input.platform,
    scheduledAt: NOW.toISOString(),
    status: 'scheduled' as const,
  }));
  const credentialsReady = jest.fn(async () => opts.credentialsReady ?? true);
  const publishGate = jest.fn(async () => LIVE_GATE);
  // No Post exists yet for any draft + platform unless a test says otherwise.
  const findScheduledStudioPost = jest.fn(async () => null);

  const deps = {
    runInTransaction: runInTransaction as unknown as StudioTransactionRunner,
    recordAttempt,
    schedule,
    credentialsReady,
    publishGate,
    findScheduledStudioPost,
    now: () => NOW,
  };
  return {
    deps,
    tx,
    txDelegate,
    runInTransaction,
    recordAttempt,
    schedule,
    credentialsReady,
    publishGate,
    findScheduledStudioPost,
    /** Draft-table writes made inside a transaction, committed or not. */
    txWrites,
    /** Attempt records written outside any transaction, in order. */
    attempts,
    /** The committed row, as the next request would read it. */
    draft: () => committed.find(row => row.id === 'd1') ?? null,
    metadata: () =>
      (committed.find(row => row.id === 'd1')?.metadata ?? {}) as Record<
        string,
        unknown
      >,
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

const LINK_AUTHORITY =
  'https://carsi.au/courses?utm_source=linkedin&utm_medium=social&utm_campaign=carsi-restoration-training-authority-2026-06-11&utm_content=d1';
const LINK_STUDIO =
  'https://carsi.au/courses?utm_source=linkedin&utm_medium=social&utm_campaign=studio-carsi&utm_content=d1';

function scheduleInput(h: ReturnType<typeof harness>, call = 0) {
  return h.schedule.mock.calls[call][0] as {
    platform: string;
    content: string;
    mediaUrls: string[];
    scheduledTime: Date;
    metadata: Record<string, unknown>;
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockResolveGate.mockResolvedValue(LIVE_GATE);
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
        linkUrl: LINK_AUTHORITY,
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
          linkUrl: LINK_AUTHORITY,
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
    expect(h.attempts).toHaveLength(0);
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
        { platform: 'blog', reason: 'platform_not_schedulable' },
      ],
    });
    // Approval is not consumed: the claim rolled back, nothing wrote it back.
    expect(h.rollbacks()).toBe(1);
    expect(h.draft()).toMatchObject({
      status: 'awaiting_approval',
      approvedBy: null,
      approvedAt: null,
    });
    // The attempt is recorded afterwards, under its own key only.
    expect(h.attempts).toHaveLength(1);
    expect(h.metadata().studioScheduleAttempt).toMatchObject({
      outcome: 'blocked',
      attemptedBy: 'phill',
      skipped: result.skipped,
    });
    expect(h.metadata().ownedMediaGate).toEqual({
      allowed: false,
      blockers: ['asset_rights_unconfirmed'],
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

    const input = scheduleInput(h);
    expect(input.mediaUrls).toEqual(['https://cdn.example/carsi-d1.mp4']);
    // No authority campaign on this draft → the studio-<client> campaign tag.
    // LinkedIn drops the card behind media, so the link is in the text and
    // no card is claimed in the metadata.
    expect(input.content.endsWith(`\n\n${LINK_STUDIO}`)).toBe(true);
    expect(input.metadata.linkUrl).toBeUndefined();
  });

  it('records the approval and the schedule on the draft, inside the transaction', async () => {
    const h = harness();

    await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(h.txWrites).toHaveLength(2);
    expect(h.attempts).toHaveLength(0);
    const record = h.txWrites[1];
    expect(record.where).toEqual({ id: 'd1', organizationId: 'org-carsi' });
    expect(record.data.status).toBeUndefined(); // stays approved
    expect(h.metadata()).toMatchObject({
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
    expect(h.metadata().studioScheduleAttempt).toMatchObject({
      outcome: 'schedule_failed',
      skipped: result.skipped,
    });
    // The failure reaches the error tracker with its identifiers.
    expect(mockTrackError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        operation: 'studio/approve-and-schedule',
        metadata: expect.objectContaining({
          draftId: 'd1',
          platform: 'facebook',
        }),
      })
    );
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

    const input = scheduleInput(h);
    expect(input.scheduledTime).toEqual(later);
    expect(input.metadata.linkUrl).toBeUndefined();
    expect(input.content).toBe(
      'Body of the post.\n\nCTA: Save this checklist.'
    );
    expect(result.scheduled[0].linkUrl).toBeNull();
  });

  it('puts the funnel link in the text on a platform whose adapter renders no card (twitter), so a recorded link is a delivered link', async () => {
    const h = harness({
      row: draftRow({ platforms: ['twitter'], metadata: {} }),
    });

    const result = await approveAndScheduleStudioDraft(INPUT, h.deps);

    const link =
      'https://carsi.au/courses?utm_source=twitter&utm_medium=social&utm_campaign=studio-carsi&utm_content=d1';
    const input = scheduleInput(h);
    expect(input.content.endsWith(`\n\n${link}`)).toBe(true);
    expect(input.metadata.linkUrl).toBeUndefined();
    expect(result.scheduled[0].linkUrl).toBe(link);
  });

  it('sends the link as a card on a card platform without media, leaving the text untouched', async () => {
    const h = harness({
      row: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });

    await approveAndScheduleStudioDraft(INPUT, h.deps);

    const input = scheduleInput(h);
    expect(input.content).toBe(
      'Body of the post.\n\nCTA: Save this checklist.'
    );
    expect(input.metadata.linkUrl).toBe(LINK_STUDIO);
  });

  it('schedules a platform once however many times settings.studio.platforms repeats it', async () => {
    const h = harness({
      row: draftRow({
        platforms: ['linkedin', 'linkedin', 'linkedin'],
        metadata: {},
      }),
    });

    const result = await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(h.schedule).toHaveBeenCalledTimes(1);
    expect(h.findScheduledStudioPost).toHaveBeenCalledTimes(1);
    expect(result.scheduled).toHaveLength(1);
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

    // Still awaiting approval, the denial left in place, the attempt recorded
    // under its own key — and NO clearance persisted by a rolled-back attempt.
    expect(h.draft()).toMatchObject({
      status: 'awaiting_approval',
      approvedBy: null,
    });
    const recorded = h.metadata();
    expect(recorded.externalPublishingAllowed).toBe(false);
    expect(recorded.externalPublishBlocks).toEqual(
      SEEDED_CARSI_METADATA.externalPublishBlocks
    );
    expect(recorded.externalPublishClearances).toBeUndefined();
    expect(recorded.studioScheduleAttempt).toMatchObject({
      outcome: 'blocked',
      attemptedBy: 'phill',
      clearancesRequested: [],
      skipped: result.skipped,
    });
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
    const recorded = h.metadata();
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

  it('honours a clearance recorded by an earlier COMMITTED approval', async () => {
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

  it('ALL OR NOTHING: one platform still blocked rolls the whole approval back instead of stranding it behind a committed claim', async () => {
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

    expect(h.schedule).toHaveBeenCalledTimes(1); // linkedin was scheduled, then rolled back
    expect(result).toEqual({
      approved: false,
      outcome: 'blocked',
      scheduled: [],
      skipped: [
        {
          platform: 'facebook',
          reason: `external_publish_blocked: ${CREDENTIALS_BLOCKER}`,
        },
        { platform: 'linkedin', reason: 'rolled_back' },
      ],
    });
    expect(h.rollbacks()).toBe(1);
    expect(h.draft()?.status).toBe('awaiting_approval');
    expect(h.metadata().externalPublishingAllowed).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      'studio approval blocked',
      expect.objectContaining({
        draftId: 'd1',
        reasons: [`external_publish_blocked: ${CREDENTIALS_BLOCKER}`],
      })
    );
    // The retry, once facebook has credentials, schedules the whole set.
    h.credentialsReady.mockResolvedValue(true);
    const retry = await approveAndScheduleStudioDraft(
      { ...INPUT, clearances: ['final_asset_rights_check_required'] },
      h.deps
    );
    expect(retry.outcome).toBe('approved');
    expect(retry.scheduled.map(s => s.platform)).toEqual([
      'linkedin',
      'facebook',
    ]);
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

  it('a draft whose only channels the Studio cannot schedule (blog, newsletter) never discharges the pack by being skipped', async () => {
    // 27 of the 63 seeded CARSI drafts have exactly this shape. Approval
    // commits (there is nothing to schedule) but the deny-by-default flag and
    // the blocker list stay exactly as the pack wrote them.
    const h = harness({
      row: draftRow({
        platforms: ['blog', 'newsletter'],
        metadata: SEEDED_CARSI_METADATA,
      }),
    });

    const result = await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(result.approved).toBe(true);
    expect(result.scheduled).toEqual([]);
    expect(h.credentialsReady).not.toHaveBeenCalled();
    const recorded = h.metadata();
    expect(recorded.externalPublishingAllowed).toBe(false);
    expect(recorded.externalPublishBlocks).toEqual(
      SEEDED_CARSI_METADATA.externalPublishBlocks
    );
    expect(Object.keys(recorded.externalPublishClearances as object)).toEqual([
      APPROVAL_BLOCKER,
    ]);
  });
});

describe("the organisation's publish-safety state gates Studio posts like autopilot posts (bench: no stop for a Studio post once approved)", () => {
  it('a shadow-mode organisation gets blocked, not a Post', async () => {
    const h = harness({
      row: draftRow({ platforms: ['linkedin', 'blog'], metadata: {} }),
    });
    h.publishGate.mockResolvedValue({
      allowed: false,
      reason: "Organisation calendar mode is 'shadow'",
      calendarMode: 'shadow',
      autoPublishPaused: false,
    });

    const result = await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(h.publishGate).toHaveBeenCalledWith('org-carsi', h.tx);
    expect(h.schedule).not.toHaveBeenCalled();
    expect(h.credentialsReady).not.toHaveBeenCalled();
    expect(result).toEqual({
      approved: false,
      outcome: 'blocked',
      scheduled: [],
      skipped: [
        {
          platform: 'linkedin',
          reason: 'org_publish_gate: calendar_mode_shadow',
        },
        { platform: 'blog', reason: 'platform_not_schedulable' },
      ],
    });
    expect(h.draft()?.status).toBe('awaiting_approval');
  });

  it('a paused organisation gets blocked with the pause named', async () => {
    const h = harness({
      row: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });
    h.publishGate.mockResolvedValue({
      allowed: false,
      reason: 'Auto-publish is paused for this organisation',
      calendarMode: 'live',
      autoPublishPaused: true,
    });

    const result = await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(result.outcome).toBe('blocked');
    expect(result.skipped).toEqual([
      { platform: 'linkedin', reason: 'org_publish_gate: auto_publish_paused' },
    ]);
  });

  it('the default gate is lib/publish/safetyChecks, read through the transaction', async () => {
    const h = harness({
      row: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });

    const result = await approveAndScheduleStudioDraft(INPUT, {
      ...h.deps,
      publishGate: undefined,
    });

    expect(mockResolveGate).toHaveBeenCalledTimes(1);
    expect(mockResolveGate).toHaveBeenCalledWith('org-carsi', h.tx);
    expect(result.outcome).toBe('approved');
  });

  it('publishGateBlockReason names the flag that blocks', () => {
    expect(
      publishGateBlockReason({
        allowed: true,
        calendarMode: 'live',
        autoPublishPaused: false,
      })
    ).toBeNull();
    expect(
      publishGateBlockReason({
        allowed: false,
        calendarMode: 'shadow',
        autoPublishPaused: false,
      })
    ).toBe('org_publish_gate: calendar_mode_shadow');
    expect(
      publishGateBlockReason({
        allowed: false,
        calendarMode: 'live',
        autoPublishPaused: true,
      })
    ).toBe('org_publish_gate: auto_publish_paused');
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
    expect(h.metadata().studioScheduleAttempt).toMatchObject({
      outcome: 'schedule_failed',
      skipped: result.skipped,
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

  it('keeps the approval when no platform is cron-schedulable at all (owned media only) without flipping the publish flag', async () => {
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
    // Nothing was scheduled, so nothing says external publishing is allowed.
    expect(h.metadata().externalPublishingAllowed).toBeUndefined();
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

  it('the default credentials check is the exact row the cron publishes with: active, this platform, this approver, THIS organisation', async () => {
    type Connection = {
      userId: string;
      platform: string;
      isActive: boolean;
      organizationId: string | null;
    };
    const table: Connection[] = [];
    mockConnectionFindFirst.mockImplementation(
      async ({ where }: { where: Connection }) =>
        table.find(
          row =>
            row.userId === where.userId &&
            row.platform === where.platform &&
            row.isActive === where.isActive &&
            row.organizationId === where.organizationId
        )
          ? { id: 'conn' }
          : null
    );
    const run = async (rows: Connection[]) => {
      table.splice(0, table.length, ...rows);
      const h = harness({
        row: draftRow({
          platforms: ['linkedin'],
          metadata: SEEDED_CARSI_METADATA,
        }),
      });
      const { credentialsReady: _injected, ...depsWithDefault } = h.deps;
      return approveAndScheduleStudioDraft(
        { ...INPUT, clearances: ['final_asset_rights_check_required'] },
        depsWithDefault
      );
    };

    const base = { userId: 'phill', platform: 'linkedin' };
    expect(
      (await run([{ ...base, isActive: true, organizationId: 'org-carsi' }]))
        .outcome
    ).toBe('approved');
    // A legacy connection with no organisation would not publish an
    // org-scoped post at the cron either — it does not discharge the blocker.
    expect(
      (await run([{ ...base, isActive: true, organizationId: null }])).outcome
    ).toBe('blocked');
    expect(
      (await run([{ ...base, isActive: true, organizationId: 'org-other' }]))
        .outcome
    ).toBe('blocked');
    expect(
      (await run([{ ...base, isActive: false, organizationId: 'org-carsi' }]))
        .outcome
    ).toBe('blocked');
    expect(mockConnectionFindFirst.mock.calls[0][0]).toEqual({
      where: {
        userId: 'phill',
        platform: 'linkedin',
        isActive: true,
        organizationId: 'org-carsi',
      },
      select: { id: true },
    });
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
        linkUrl: LINK_STUDIO,
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
    expect(scheduleInput(h).metadata.idempotencyKey).toBe('studio:d1:linkedin');
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
    // Nothing to record: the draft could not be read.
    expect(h.attempts).toHaveLength(0);
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
  it("a failed schedule cannot strand the draft as approved even when the attempt record itself fails (the reviewer's reproduction)", async () => {
    const h = harness({
      row: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });
    h.schedule.mockRejectedValue(new Error('scheduler unavailable'));
    // The same database incident that broke the schedule breaks the write
    // that records the attempt.
    h.recordAttempt.mockRejectedValue(new Error('compensation unavailable'));

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
    expect(h.txWrites.some(w => w.data.status === 'awaiting_approval')).toBe(
      false
    );
    expect(h.recordAttempt).toHaveBeenCalledTimes(1);
    expect(h.recordAttempt.mock.calls[0][0]).toEqual({
      organizationId: 'org-carsi',
      id: 'd1',
    });
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
    expect(h.attempts).toHaveLength(0);
  });

  it('a credentials read that rejects after another platform scheduled rolls everything back, and the rolled-back attempt records no clearance', async () => {
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
    const recorded = h.metadata();
    expect(recorded.externalPublishingAllowed).toBe(false);
    expect(recorded.externalPublishBlocks).toEqual(
      SEEDED_CARSI_METADATA.externalPublishBlocks
    );
    // A rolled-back approval persists nothing but its own record: the named
    // clearance is NOT on the draft; the retry names it again.
    expect(recorded.externalPublishClearances).toBeUndefined();
    expect(recorded.studioScheduleAttempt).toMatchObject({
      outcome: 'schedule_failed',
      clearancesRequested: ['final_asset_rights_check_required'],
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
      maxWait: 2000,
      timeout: 15000,
    });
    expect(h.draft()?.status).toBe('approved');
  });
});

describe('engineering bench, round 1 — bounds the reviewers asked for', () => {
  it('sets a server-side statement timeout as the FIRST statement of the transaction', async () => {
    const h = harness({
      row: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });

    await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(h.tx.$executeRawUnsafe).toHaveBeenCalledTimes(2);
    expect(h.tx.$executeRawUnsafe.mock.calls[0][0]).toBe(
      'SET LOCAL statement_timeout = 5000'
    );
    expect(h.tx.$executeRawUnsafe.mock.calls[1][0]).toBe(
      'SET LOCAL lock_timeout = 1000'
    );
    expect(h.tx.$executeRawUnsafe.mock.invocationCallOrder[1]).toBeLessThan(
      h.txDelegate.updateMany.mock.invocationCallOrder[0]
    );
  });

  it('the loser of a concurrent approval that hits lock_timeout on the claim gets not_awaiting_approval, not a 500', async () => {
    const h = harness({
      row: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });
    h.txDelegate.updateMany.mockRejectedValueOnce(
      Object.assign(new Error('canceling statement due to lock timeout'), {
        meta: { code: '55P03' },
      })
    );

    const result = await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(result).toEqual({
      approved: false,
      outcome: 'not_awaiting_approval',
      scheduled: [],
      skipped: [],
    });
    expect(h.rollbacks()).toBe(1);
    expect(h.schedule).not.toHaveBeenCalled();
    expect(h.attempts).toHaveLength(0);
  });

  it('a caller shed at maxWait (no pooled connection) gets a retryable schedule_failed with the draft untouched, not a 500', async () => {
    const h = harness({
      row: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });
    h.runInTransaction.mockRejectedValueOnce(
      Object.assign(
        new Error(
          'Timed out fetching a new connection from the connection pool'
        ),
        { code: 'P2024' }
      )
    );

    const result = await approveAndScheduleStudioDraft(INPUT, h.deps);

    expect(result.outcome).toBe('schedule_failed');
    expect(result.skipped).toEqual([
      {
        platform: '*',
        reason: expect.stringMatching(/^transaction_unavailable: /),
      },
    ]);
    expect(h.draft()?.status).toBe('awaiting_approval');
    expect(mockTrackError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        metadata: expect.objectContaining({ stage: 'transaction_start' }),
      })
    );
  });

  it('the default attempt record is one parameterised UPDATE that merges its key on the still-awaiting row (the raw SQL has an oracle)', async () => {
    const h = harness({
      row: draftRow({
        platforms: ['linkedin'],
        metadata: SEEDED_CARSI_METADATA,
      }),
      credentialsReady: false,
    });
    mockExecuteRaw.mockResolvedValue(1);
    const { recordAttempt: _injected, ...depsWithDefault } = h.deps;

    const result = await approveAndScheduleStudioDraft(INPUT, depsWithDefault);

    expect(result.outcome).toBe('blocked');
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    const [strings, ...values] = mockExecuteRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    const sql = Array.from(strings).join('?');
    expect(sql).toMatch(/UPDATE studio_content_drafts/);
    expect(sql).toMatch(/COALESCE\(metadata, '\{\}'::jsonb\) \|\| \?::jsonb/);
    expect(sql).toMatch(/organization_id = \?/);
    expect(sql).toMatch(/status = 'awaiting_approval'/);
    expect(values).toHaveLength(3);
    expect(values[1]).toBe('d1');
    expect(values[2]).toBe('org-carsi');
    const patch = JSON.parse(values[0] as string) as Record<string, unknown>;
    expect(Object.keys(patch)).toEqual(['studioScheduleAttempt']);
    expect(patch.studioScheduleAttempt).toMatchObject({
      outcome: 'blocked',
      attemptedBy: 'phill',
      clearancesRequested: [],
    });
  });

  it('a default attempt record that matches no awaiting row is logged, not lost silently', async () => {
    const h = harness({
      row: draftRow({ platforms: ['linkedin'], metadata: {} }),
    });
    h.schedule.mockRejectedValue(new Error('scheduler unavailable'));
    mockExecuteRaw.mockResolvedValue(0);
    const { recordAttempt: _injected, ...depsWithDefault } = h.deps;

    await approveAndScheduleStudioDraft(INPUT, depsWithDefault);

    expect(logger.warn).toHaveBeenCalledWith(
      'studio approval attempt record matched no awaiting draft',
      expect.objectContaining({ draftId: 'd1', outcome: 'schedule_failed' })
    );
  });

  it('the rolled-back attempt record merges only its own key: a competing write to the draft survives it', async () => {
    const h = harness({
      row: draftRow({
        platforms: ['linkedin'],
        metadata: {
          ...SEEDED_CARSI_METADATA,
          ownedMediaGate: { allowed: true },
        },
      }),
      credentialsReady: false,
    });
    // Between the rollback and the attempt record, the content loop re-runs the
    // rights check and writes a stricter verdict onto the same row.
    h.recordAttempt.mockImplementationOnce(async (target, attempt) => {
      const row = h.draft()!;
      row.metadata = {
        ...(row.metadata as Record<string, unknown>),
        ownedMediaGate: { allowed: false, blockers: ['rights_revoked'] },
      };
      row.metadata = {
        ...(row.metadata as Record<string, unknown>),
        studioScheduleAttempt: attempt,
      };
      h.attempts.push(attempt);
      void target;
    });

    await approveAndScheduleStudioDraft(INPUT, h.deps);

    // The competing verdict is intact; only studioScheduleAttempt was added.
    expect(h.metadata().ownedMediaGate).toEqual({
      allowed: false,
      blockers: ['rights_revoked'],
    });
    expect(h.metadata().studioScheduleAttempt).toMatchObject({
      outcome: 'blocked',
    });
    // And the record itself carries nothing but the attempt.
    expect(Object.keys(h.attempts[0]).sort()).toEqual(
      [
        'attemptedAt',
        'attemptedBy',
        'clearancesRequested',
        'outcome',
        'skipped',
      ].sort()
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
