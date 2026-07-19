/**
 * Auto-publish failure mode tests — SYN-540 / SYN-523
 *
 * These correspond to the 6 runtime failure states specified in
 * docs/AUTO-PUBLISH-FAILURE-MODES.md.
 *
 * States 1 and 6 are implemented as behavioural contract tests against the
 * real processPublishQueue orchestrator (real handler, mocked Prisma —
 * TEST-CRITICAL-COVERAGE, readiness scorecard SYN-994). States 2-5 and the
 * remaining State-6 alerting behaviours are still it.todo() — fill each in as
 * the corresponding behaviour lands in SYN-523.
 *
 * Board decision: SYN-538 / SYN-540 | Session 9 | 2026-03-30
 */

const mockPrisma = {
  publishQueueItem: {
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  contentCalendar: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  platformConnection: {
    findFirst: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  notification: {
    createMany: jest.fn(),
  },
  organization: {
    update: jest.fn(),
  },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('@/lib/publish/safetyChecks', () => ({
  runSafetyChecks: jest.fn(),
}));
jest.mock('@/lib/publish/platformAdapters/instagram', () => ({
  publishToInstagram: jest.fn(),
}));
jest.mock('@/lib/publish/platformAdapters/facebook', () => ({
  publishToFacebook: jest.fn(),
}));
jest.mock('@/lib/publish/platformAdapters/linkedin', () => ({
  publishToLinkedIn: jest.fn(),
}));
jest.mock('@/lib/publish/platformAdapters/twitter', () => ({
  publishToTwitter: jest.fn(),
}));
jest.mock('@/lib/publish/platformAdapters/threads', () => ({
  publishToThreads: jest.fn(),
}));
jest.mock('@/lib/publish/platformAdapters/youtube', () => ({
  publishToYouTube: jest.fn(),
}));
jest.mock('@/lib/publish/platformAdapters/tiktok', () => ({
  publishToTikTok: jest.fn(),
}));
jest.mock('@/lib/security/field-encryption', () => ({
  decryptField: jest.fn(() => null),
}));
jest.mock('@/components/marketing/PostAttributionFooter', () => ({
  buildAttribution: jest.fn(() => ({
    body: undefined,
    firstComment: undefined,
  })),
}));
jest.mock('@/lib/marketing-agency/campaign-authority-manifest', () => ({
  extractCampaignAuthorityManifest: jest.fn(),
}));
jest.mock('@/lib/marketing-agency/publish-gate', () => ({
  assertCampaignPublishable: jest.fn(() => ({ allowed: true, blockers: [] })),
}));
jest.mock('@/lib/platform-connections/token-readiness', () => ({
  resolvePlatformAccessToken: jest.fn(),
}));
jest.mock('@/lib/publish/postPublishClaim', () => ({
  claimQueueItemForPublish: jest.fn(),
  reclaimStalePublishingQueueItems: jest.fn(),
}));
jest.mock('@/lib/publish/socialCutSource', () => ({
  isSocialCutSlot: jest.fn(() => false),
  resolveSocialCutSource: jest.fn(),
}));
jest.mock('@/lib/pipelines/track-cost', () => ({
  trackPipelineCost: jest.fn().mockResolvedValue(undefined),
}));

import { processPublishQueue } from '@/lib/publish/publishQueue';
import { runSafetyChecks } from '@/lib/publish/safetyChecks';
import { publishToFacebook } from '@/lib/publish/platformAdapters/facebook';
import { resolvePlatformAccessToken } from '@/lib/platform-connections/token-readiness';
import {
  claimQueueItemForPublish,
  reclaimStalePublishingQueueItems,
} from '@/lib/publish/postPublishClaim';
import { trackPipelineCost } from '@/lib/pipelines/track-cost';
import { buildAttribution } from '@/components/marketing/PostAttributionFooter';
import { isSocialCutSlot } from '@/lib/publish/socialCutSource';
import { decryptField } from '@/lib/security/field-encryption';

const dueItem = {
  id: 'qi1',
  organizationId: 'org1',
  calendarId: 'cal1',
  slotId: 'slot1',
  platform: 'facebook',
  scheduledAt: new Date('2026-07-01T00:00:00.000Z'),
  attempts: 0,
  status: 'pending',
};

/** Arrange the happy path up to the platform dispatch. */
function primeQueueRun() {
  // Re-arm implementation-carrying mocks (jest config resets implementations).
  (buildAttribution as jest.Mock).mockReturnValue({
    body: undefined,
    firstComment: undefined,
  });
  (isSocialCutSlot as jest.Mock).mockReturnValue(false);
  (decryptField as jest.Mock).mockReturnValue(null);
  (trackPipelineCost as jest.Mock).mockResolvedValue(undefined);
  (reclaimStalePublishingQueueItems as jest.Mock).mockResolvedValue(0);
  mockPrisma.publishQueueItem.findMany.mockResolvedValue([{ ...dueItem }]);
  (runSafetyChecks as jest.Mock).mockResolvedValue({ pass: true });
  (claimQueueItemForPublish as jest.Mock).mockResolvedValue(true);
  mockPrisma.platformConnection.findFirst.mockResolvedValue({
    accessToken: 'encrypted-token',
    refreshToken: null,
    encryptionKeyVersion: 1,
    profileId: 'page-1',
  });
  (resolvePlatformAccessToken as jest.Mock).mockReturnValue({
    ok: true,
    accessToken: 'decrypted-token',
  });
  mockPrisma.contentCalendar.findUnique.mockResolvedValue({
    slots: {
      slots: [{ id: 'slot1', platform: 'facebook', captions: ['Hello AU'] }],
    },
  });
  mockPrisma.contentCalendar.update.mockResolvedValue({});
  mockPrisma.publishQueueItem.update.mockResolvedValue({});
  mockPrisma.publishQueueItem.updateMany.mockResolvedValue({ count: 2 });
  mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
  mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });
  mockPrisma.organization.update.mockResolvedValue({});
}

beforeEach(() => {
  jest.clearAllMocks();
  primeQueueRun();
});

describe('Auto-publish — Failure State 1: Expired social credentials', () => {
  const unauthorizedResult = {
    success: false,
    error: 'Facebook post failed (401): Error validating access token',
    statusCode: 401,
  };

  it('pauses auto-publish for affected client when platform returns 401', async () => {
    (publishToFacebook as jest.Mock).mockResolvedValue(unauthorizedResult);

    const result = await processPublishQueue();

    // The failing item itself is held with no retry scheduled…
    expect(mockPrisma.publishQueueItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'qi1' },
        data: expect.objectContaining({ status: 'held', nextRetryAt: null }),
      })
    );
    // …and the org's persistent kill-switch is set (SYN-551), which safety
    // Gate 2 enforces for every current and future queue row of this org.
    expect(mockPrisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'org1' },
        data: { autoPublishPaused: true },
      })
    );
    expect(result.held).toBe(1);
  });

  it('keys ONLY on the structured HTTP 401 — user-controlled error text cannot trigger State 1', async () => {
    // A remote body echoing "(401)" / "unauthorized" (e.g. a caption or URL)
    // inside a non-401 failure must take the normal retry ladder.
    (publishToFacebook as jest.Mock).mockResolvedValue({
      success: false,
      error:
        'Facebook post failed (500): caption was "see (401) unauthorized error validating access token demo"',
      statusCode: 500,
    });

    const result = await processPublishQueue();

    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    expect(result.failed).toBe(1);
    expect(result.held).toBe(0);
  });

  it('fires in-app notification: "Your social connection has expired"', async () => {
    (publishToFacebook as jest.Mock).mockResolvedValue(unauthorizedResult);

    await processPublishQueue();

    expect(mockPrisma.notification.createMany).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.notification.createMany.mock.calls[0][0];
    expect(arg.data[0]).toEqual(
      expect.objectContaining({
        userId: 'u1',
        title: 'Your social connection has expired',
        message: expect.stringContaining('reconnect to resume auto-scheduling'),
      })
    );
  });

  it('logs zero-cost failed run to pipeline_cost_ledger with error_code UNAUTHORIZED', async () => {
    (publishToFacebook as jest.Mock).mockResolvedValue(unauthorizedResult);

    await processPublishQueue();

    expect(trackPipelineCost).toHaveBeenCalledWith(
      expect.objectContaining({
        pipeline_name: 'auto-publish',
        client_id: 'org1',
        run_id: 'qi1',
        cost_usd: 0,
        input_tokens: 0,
        output_tokens: 0,
        error_code: 'UNAUTHORIZED',
      })
    );
    const { logger } = jest.requireMock('@/lib/logger');
    expect(logger.warn).toHaveBeenCalledWith(
      'publishQueue: held after unauthorized platform response',
      expect.objectContaining({ error_code: 'UNAUTHORIZED' })
    );
  });

  it('does NOT retry after a 401 — expired tokens require explicit reconnection', async () => {
    (publishToFacebook as jest.Mock).mockResolvedValue(unauthorizedResult);

    const result = await processPublishQueue();

    // No write may ever schedule a retry for an unauthorized failure.
    for (const call of mockPrisma.publishQueueItem.update.mock.calls) {
      expect(call[0].data.status).not.toBe('failed');
      expect(call[0].data.nextRetryAt ?? null).toBeNull();
    }
    expect(result.failed).toBe(0);
    expect(result.held).toBe(1);
  });

  it('positive control: a non-auth failure (500) still takes the retry ladder', async () => {
    (publishToFacebook as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Facebook post failed (500): upstream flake',
      statusCode: 500,
    });

    const result = await processPublishQueue();

    expect(mockPrisma.publishQueueItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'qi1' },
        data: expect.objectContaining({
          status: 'failed',
          nextRetryAt: expect.any(Date),
        }),
      })
    );
    // No client-level pause and no expiry notification on a transient error.
    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    expect(result.failed).toBe(1);
    expect(result.held).toBe(0);
  });
});

describe('Auto-publish — Failure State 2: Platform rate limit', () => {
  it.todo('reads Retry-After header when platform returns 429');
  it.todo(
    'uses exponential backoff (30s → 60s → 120s) when Retry-After is absent'
  );
  it.todo('retries a maximum of 3 times before rescheduling');
  it.todo(
    'reschedules post to next available calendar slot after exhausting retries'
  );
  it.todo('logs each backoff attempt with retry count and wait duration');
});

describe('Auto-publish — Failure State 3: Partial post failure (media attachment)', () => {
  it.todo('deletes the partial text-only post via platform delete endpoint');
  it.todo(
    'moves post to manual review queue with requires_media_recheck: true'
  );
  it.todo('does NOT auto-retry media attachment within the same run');
  it.todo(
    'fires in-app alert: "A scheduled post couldn\'t complete — please review your media attachments"'
  );
});

describe('Auto-publish — Failure State 4: Client account deactivated', () => {
  it.todo(
    'checks clients.status = active at execution time (not only at queue load time)'
  );
  it.todo('skips post silently when client is inactive — no client alert');
  it.todo(
    "removes all pending posts from deactivated client's auto-publish queue"
  );
  it.todo(
    'logs skip to run log with client_id, reason: account_deactivated, posts_skipped count'
  );
});

describe('Auto-publish — Failure State 5: Content freshness validation failure', () => {
  it.todo(
    'flags post as stale when valid_until timestamp has passed at execution time'
  );
  it.todo('flags post as stale when freshness_confidence < 0.6');
  it.todo(
    'moves stale post to manual review queue with requires_freshness_review: true'
  );
  it.todo('does NOT auto-publish a flagged stale post');
  it.todo(
    'fires in-app alert: "One of your scheduled posts may need a refresh before publishing"'
  );
});

describe('Auto-publish — Failure State 6: Network timeout / Supabase queue read failure', () => {
  it('queue read is idempotent — published_at is only written on confirmed platform success', async () => {
    // Failure: no write anywhere may set publishedAt.
    (publishToFacebook as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Facebook post failed (500): flake',
    });
    await processPublishQueue();
    for (const call of mockPrisma.publishQueueItem.update.mock.calls) {
      expect(call[0].data.publishedAt).toBeUndefined();
    }

    // Success: publishedAt is written exactly once, with 'published' status.
    jest.clearAllMocks();
    primeQueueRun();
    (publishToFacebook as jest.Mock).mockResolvedValue({
      success: true,
      platformPostId: 'fb-post-1',
    });
    const result = await processPublishQueue();

    const publishedWrites =
      mockPrisma.publishQueueItem.update.mock.calls.filter(
        call => call[0].data.publishedAt !== undefined
      );
    expect(publishedWrites).toHaveLength(1);
    expect(publishedWrites[0][0].data).toEqual(
      expect.objectContaining({
        status: 'published',
        publishedAt: expect.any(Date),
      })
    );
    expect(result.published).toBe(1);
  });

  it.todo(
    'exits current cron run cleanly on read failure, defers to next 15-min tick'
  );

  it('does NOT double-post — published_at timestamp check prevents re-processing', async () => {
    // The due-fetch must never select a row that ever recorded a confirmed
    // platform success: every OR branch carries publishedAt: null, and only
    // pending/failed statuses are eligible.
    (publishToFacebook as jest.Mock).mockResolvedValue({
      success: true,
      platformPostId: 'fb-post-1',
    });
    await processPublishQueue();
    const where = mockPrisma.publishQueueItem.findMany.mock.calls[0][0].where;
    expect(where.OR.map((c: { status: string }) => c.status).sort()).toEqual([
      'failed',
      'pending',
    ]);
    for (const branch of where.OR) {
      expect(branch.publishedAt).toBeNull();
    }

    // …and an overlapping worker that loses the atomic claim dispatches
    // NOTHING to the platform.
    jest.clearAllMocks();
    primeQueueRun();
    (claimQueueItemForPublish as jest.Mock).mockResolvedValue(false);
    const result = await processPublishQueue();

    expect(publishToFacebook).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(result.published).toBe(0);
  });

  it.todo(
    'fires internal admin alert (Slack/email) after 3 consecutive read failures (45 min)'
  );
  it.todo('does NOT alert the client on queue read failures');
});
