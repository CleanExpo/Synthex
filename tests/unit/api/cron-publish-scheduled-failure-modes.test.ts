/**
 * Failure-mode coverage for /api/cron/publish-scheduled (Wave-2 hardening).
 *
 * The companion suite (cron-publish-scheduled.test.ts) locks the auth gate, the
 * clean run, the no-connection path, the authority gate, and the atomic-claim
 * skip. This suite drives the REAL publish paths that those tests stop short of:
 *
 *  - happy path: platform success → published + PlatformPost + notification + Hub push
 *  - platform returns {success:false} with a PERMANENT error → markFailed (no retry)
 *  - platform returns {success:false} with a RETRYABLE error → claim released w/ backoff
 *  - retryable error but retries exhausted (retryCount === MAX) → permanent fail
 *  - service.createPost THROWS (transient) → caught, retried, Sentry captured
 *  - service.createPost THROWS (permanent) → caught, markFailed, Sentry captured
 *  - token decrypt failure (decryptFieldSafe → '') → markFailed, never reaches platform
 *  - unsupported platform guard → markFailed before any connector lookup
 *  - empty content guard → markFailed before any connector lookup
 *  - service factory returns null → markFailed
 *  - non-fatal PlatformPost.create failure → post still reported published
 *  - non-fatal notification failure → publish still succeeds (never crashes the run)
 *  - stale-claim reclaim runs at the top of every pass
 *
 * Mocking style mirrors cron-publish-scheduled.test.ts (jest.mock of
 * @/lib/prisma, @/lib/social, cron-auth, field-encryption, unite-hub-connector,
 * logger, sentry-server) so the two suites stay consistent.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { buildApprovedCampaignAuthorityManifest } from '@/tests/helpers/campaign-authority-manifest';

const mockPrisma = {
  post: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  platformConnection: { findFirst: jest.fn(), update: jest.fn() },
  notification: { create: jest.fn() },
  platformPost: { create: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockVerifyCron = jest.fn();
jest.mock('@/lib/auth/cron-auth', () => ({
  verifyCronRequest: (...args: unknown[]) => mockVerifyCron(...args),
}));

const mockIsPlatformSupported = jest.fn();
const mockCreatePlatformService = jest.fn();
jest.mock('@/lib/social', () => ({
  isPlatformSupported: (...args: unknown[]) => mockIsPlatformSupported(...args),
  createPlatformService: (...args: unknown[]) =>
    mockCreatePlatformService(...args),
}));

// decryptFieldSafe is overridable per-test (token decrypt failure path);
// default is identity (the stored value is the plaintext token in tests).
const mockDecryptFieldSafe = jest.fn();
jest.mock('@/lib/security/field-encryption', () => ({
  decryptFieldSafe: (v: string) => mockDecryptFieldSafe(v),
  encryptField: (v: string) => v,
}));

const mockPushUniteHubEvent = jest.fn();
jest.mock('@/lib/unite-hub-connector', () => ({
  pushUniteHubEvent: (...args: unknown[]) => mockPushUniteHubEvent(...args),
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockCapture = jest.fn();
jest.mock('@/lib/observability/sentry-server', () => ({
  captureServerException: (...args: unknown[]) => mockCapture(...args),
  captureServerMessage: jest.fn(),
  isSentryServerEnabled: () => true,
}));

import { GET } from '@/app/api/cron/publish-scheduled/route';
import { NextResponse } from 'next/server';

function req() {
  return createMockNextRequest({
    url: 'http://localhost/api/cron/publish-scheduled',
  });
}

/** An approved manifest so the authority gate always passes in these tests. */
function approvedManifest() {
  return buildApprovedCampaignAuthorityManifest({
    platformOutputs: [
      { platform: 'facebook', status: 'approved', contentRef: 'post-fb' },
    ],
  });
}

/** A single due post fixture; override fields as needed. */
function duePost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    content: 'hello world',
    platform: 'facebook',
    metadata: { campaignAuthorityManifest: approvedManifest() },
    campaign: {
      userId: 'u1',
      platform: 'facebook',
      organizationId: 'org-1',
      settings: {},
      content: {},
    },
    ...overrides,
  };
}

/** Active platform connection with encrypted-looking token fields. */
function activeConnection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conn-1',
    accessToken: 'enc:access',
    refreshToken: 'enc:refresh',
    expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    profileId: 'pf-1',
    profileName: 'Acme Page',
    ...overrides,
  };
}

/** Build a mock platform service whose createPost resolves/rejects as told. */
function serviceReturning(result: unknown) {
  return { createPost: jest.fn().mockResolvedValue(result) };
}
function serviceThrowing(err: Error) {
  return { createPost: jest.fn().mockRejectedValue(err) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyCron.mockReturnValue({ ok: true, scope: 'shared-fallback' });
  mockPrisma.post.findMany.mockResolvedValue([]);
  mockPrisma.post.findUnique.mockResolvedValue({
    status: 'scheduled',
    publishedAt: null,
    metadata: {},
  });
  mockPrisma.post.update.mockResolvedValue({});
  // Default: stale-reclaim finds nothing, claims succeed.
  mockPrisma.post.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.platformConnection.findFirst.mockResolvedValue(activeConnection());
  mockPrisma.platformConnection.update.mockResolvedValue({});
  mockPrisma.notification.create.mockResolvedValue({});
  mockPrisma.platformPost.create.mockResolvedValue({});
  mockIsPlatformSupported.mockReturnValue(true);
  mockDecryptFieldSafe.mockImplementation((v: string) => v);
  mockPushUniteHubEvent.mockResolvedValue(undefined);
});

describe('publish-scheduled — happy path', () => {
  it('publishes, records platformPostId, creates PlatformPost + notification + Hub push', async () => {
    mockPrisma.post.findMany.mockResolvedValue([duePost()]);
    mockCreatePlatformService.mockReturnValue(
      serviceReturning({
        success: true,
        postId: 'fb-123',
        url: 'https://fb.test/fb-123',
      })
    );

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.published).toBe(1);
    expect(body.failed).toBe(0);

    // Post flipped to 'published' with the platform identifiers stored.
    const publishedUpdate = mockPrisma.post.update.mock.calls.find(
      ([arg]: [{ data?: { status?: string } }]) =>
        arg?.data?.status === 'published'
    );
    expect(publishedUpdate).toBeDefined();
    expect(publishedUpdate![0].data.analytics).toEqual(
      expect.objectContaining({ platformPostId: 'fb-123' })
    );

    // Supplementary records + side effects.
    expect(mockPrisma.platformPost.create).toHaveBeenCalledTimes(1);
    expect(mockPushUniteHubEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'content.published', postId: 'p1' })
    );
    const notif = mockPrisma.notification.create.mock.calls[0][0];
    expect(notif.data.type).toBe('post_published');
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('still reports published when the supplementary PlatformPost.create throws (non-fatal)', async () => {
    mockPrisma.post.findMany.mockResolvedValue([duePost()]);
    mockCreatePlatformService.mockReturnValue(
      serviceReturning({ success: true, postId: 'fb-123' })
    );
    mockPrisma.platformPost.create.mockRejectedValue(
      new Error('platform_post table write failed')
    );

    const res = await GET(req());
    const body = await res.json();

    // The post itself was published — the metrics-record failure is swallowed.
    expect(body.published).toBe(1);
    expect(body.failed).toBe(0);
  });

  it('publishes successfully even if the success notification write throws (non-fatal)', async () => {
    mockPrisma.post.findMany.mockResolvedValue([duePost()]);
    mockCreatePlatformService.mockReturnValue(
      serviceReturning({ success: true, postId: 'fb-123' })
    );
    mockPrisma.notification.create.mockRejectedValue(
      new Error('notification insert failed')
    );

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.published).toBe(1);
    expect(body.failed).toBe(0);
  });
});

describe('publish-scheduled — platform returns {success:false}', () => {
  it('PERMANENT error → marks failed, no retry, notifies', async () => {
    mockPrisma.post.findMany.mockResolvedValue([duePost()]);
    mockCreatePlatformService.mockReturnValue(
      serviceReturning({ success: false, error: 'Invalid post payload (400)' })
    );

    const res = await GET(req());
    const body = await res.json();

    expect(body.failed).toBe(1);
    expect(body.retried).toBe(0);
    // markFailed flips to 'failed'.
    const failedUpdate = mockPrisma.post.update.mock.calls.find(
      ([arg]: [{ data?: { status?: string } }]) => arg?.data?.status === 'failed'
    );
    expect(failedUpdate).toBeDefined();
    // Not released back to scheduled for a retry. (Filter on where.id so we
    // don't match the top-of-pass stale-reclaim sweep, which also flips
    // publishing→scheduled but carries no id.)
    const releaseCall = mockPrisma.post.updateMany.mock.calls.find(
      ([arg]: [{ where?: { id?: string }; data?: { status?: string } }]) =>
        arg?.where?.id === 'p1' && arg?.data?.status === 'scheduled'
    );
    expect(releaseCall).toBeUndefined();
    const notif = mockPrisma.notification.create.mock.calls[0][0];
    expect(notif.data.type).toBe('post_failed');
  });

  it('RETRYABLE error (rate limit) → releases claim back to scheduled with backoff', async () => {
    mockPrisma.post.findMany.mockResolvedValue([duePost()]);
    mockCreatePlatformService.mockReturnValue(
      serviceReturning({ success: false, error: 'rate limit exceeded (429)' })
    );

    const res = await GET(req());
    const body = await res.json();

    expect(body.retried).toBe(1);
    expect(body.failed).toBe(0);
    expect(body.published).toBe(0);

    // releasePostClaim issues a conditional updateMany back to 'scheduled'
    // gated on { id, status:'publishing' }, carrying retry bookkeeping + backoff.
    // (Filter on where.id to exclude the top-of-pass stale-reclaim sweep.)
    const release = mockPrisma.post.updateMany.mock.calls.find(
      ([arg]: [{ where?: { id?: string; status?: string }; data?: { status?: string } }]) =>
        arg?.where?.id === 'p1' &&
        arg?.where?.status === 'publishing' &&
        arg?.data?.status === 'scheduled'
    );
    expect(release).toBeDefined();
    expect(release![0].data.metadata).toEqual(
      expect.objectContaining({ retryCount: 1 })
    );
    expect(release![0].data.scheduledAt).toBeInstanceOf(Date);
    // First retry uses the 5-minute backoff slot — strictly in the future.
    expect((release![0].data.scheduledAt as Date).getTime()).toBeGreaterThan(
      Date.now()
    );
    // Not permanently failed.
    const failedUpdate = mockPrisma.post.update.mock.calls.find(
      ([arg]: [{ data?: { status?: string } }]) => arg?.data?.status === 'failed'
    );
    expect(failedUpdate).toBeUndefined();
  });

  it('RETRYABLE error but retries EXHAUSTED (retryCount === MAX) → permanent fail', async () => {
    mockPrisma.post.findMany.mockResolvedValue([
      duePost({
        metadata: {
          campaignAuthorityManifest: approvedManifest(),
          retryCount: 3, // MAX_RETRIES
        },
      }),
    ]);
    mockCreatePlatformService.mockReturnValue(
      serviceReturning({ success: false, error: 'timeout contacting platform' })
    );

    const res = await GET(req());
    const body = await res.json();

    // Retryable error, but no retries left → it must fail permanently, not loop.
    expect(body.retried).toBe(0);
    expect(body.failed).toBe(1);
    const failedUpdate = mockPrisma.post.update.mock.calls.find(
      ([arg]: [{ data?: { status?: string } }]) => arg?.data?.status === 'failed'
    );
    expect(failedUpdate).toBeDefined();
  });
});

describe('publish-scheduled — service.createPost throws', () => {
  it('TRANSIENT throw → caught, retried with backoff, Sentry captured (scrubbed)', async () => {
    mockPrisma.post.findMany.mockResolvedValue([duePost()]);
    mockCreatePlatformService.mockReturnValue(
      serviceThrowing(new Error('ECONNRESET socket hang up'))
    );

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200); // cron never crashes
    expect(body.retried).toBe(1);
    expect(body.failed).toBe(0);

    // Released for retry (scoped to where.id to exclude the stale-reclaim sweep).
    const release = mockPrisma.post.updateMany.mock.calls.find(
      ([arg]: [{ where?: { id?: string; status?: string }; data?: { status?: string } }]) =>
        arg?.where?.id === 'p1' &&
        arg?.where?.status === 'publishing' &&
        arg?.data?.status === 'scheduled'
    );
    expect(release).toBeDefined();

    // Sentry captured with publish context and NO secret/content leak.
    expect(mockCapture).toHaveBeenCalledTimes(1);
    const [error, context] = mockCapture.mock.calls[0];
    expect((error as Error).message).toBe('ECONNRESET socket hang up');
    expect(context.operation).toBe('cron/publish-scheduled');
    expect(context.tags.retryable).toBe(true);
    const serialised = JSON.stringify(context);
    expect(serialised).not.toContain('hello world');
    expect(serialised.toLowerCase()).not.toContain('enc:access');
    expect(serialised.toLowerCase()).not.toContain('secret');
  });

  it('PERMANENT throw → caught, marked failed, Sentry captured with retryable:false', async () => {
    mockPrisma.post.findMany.mockResolvedValue([duePost()]);
    mockCreatePlatformService.mockReturnValue(
      serviceThrowing(new Error('Unexpected null reference in adapter'))
    );

    const res = await GET(req());
    const body = await res.json();

    expect(body.failed).toBe(1);
    expect(body.retried).toBe(0);
    const failedUpdate = mockPrisma.post.update.mock.calls.find(
      ([arg]: [{ data?: { status?: string } }]) => arg?.data?.status === 'failed'
    );
    expect(failedUpdate).toBeDefined();
    expect(mockCapture).toHaveBeenCalledTimes(1);
    const [, context] = mockCapture.mock.calls[0];
    expect(context.tags.retryable).toBe(false);
  });
});

describe('publish-scheduled — pre-publish guards mark failed without reaching the platform', () => {
  it('token decrypt failure (decryptFieldSafe → empty) → markFailed, no platform call', async () => {
    mockPrisma.post.findMany.mockResolvedValue([duePost()]);
    // Simulate a key mismatch: decryption yields empty/undefined.
    mockDecryptFieldSafe.mockReturnValue('');

    const res = await GET(req());
    const body = await res.json();

    expect(body.failed).toBe(1);
    expect(body.published).toBe(0);
    // Never built a service / hit the platform.
    expect(mockCreatePlatformService).not.toHaveBeenCalled();
    const failedUpdate = mockPrisma.post.update.mock.calls.find(
      ([arg]: [{ data?: { status?: string } }]) => arg?.data?.status === 'failed'
    );
    expect(failedUpdate).toBeDefined();
    const notif = mockPrisma.notification.create.mock.calls[0][0];
    expect(notif.data.type).toBe('post_failed');
  });

  it('unsupported platform → markFailed before any connector lookup', async () => {
    mockIsPlatformSupported.mockReturnValue(false);
    mockPrisma.post.findMany.mockResolvedValue([
      duePost({ platform: 'myspace' }),
    ]);

    const res = await GET(req());
    const body = await res.json();

    expect(body.failed).toBe(1);
    expect(mockPrisma.platformConnection.findFirst).not.toHaveBeenCalled();
    expect(mockCreatePlatformService).not.toHaveBeenCalled();
  });

  it('empty content → markFailed before any connector lookup', async () => {
    mockPrisma.post.findMany.mockResolvedValue([
      duePost({ content: '   ' }), // whitespace-only
    ]);

    const res = await GET(req());
    const body = await res.json();

    expect(body.failed).toBe(1);
    expect(mockPrisma.platformConnection.findFirst).not.toHaveBeenCalled();
    expect(mockCreatePlatformService).not.toHaveBeenCalled();
  });

  it('service factory returns null → markFailed (could not instantiate adapter)', async () => {
    mockPrisma.post.findMany.mockResolvedValue([duePost()]);
    mockCreatePlatformService.mockReturnValue(null);

    const res = await GET(req());
    const body = await res.json();

    expect(body.failed).toBe(1);
    const failedUpdate = mockPrisma.post.update.mock.calls.find(
      ([arg]: [{ data?: { status?: string } }]) => arg?.data?.status === 'failed'
    );
    expect(failedUpdate).toBeDefined();
  });
});

describe('publish-scheduled — stale-claim reclaim', () => {
  it('reclaims stale publishing posts at the top of every pass (even with nothing due)', async () => {
    // updateMany count 2 on the FIRST call models the reclaim sweep finding 2
    // abandoned 'publishing' rows from a crashed prior worker.
    mockPrisma.post.updateMany.mockResolvedValueOnce({ count: 2 });
    mockPrisma.post.findMany.mockResolvedValue([]);

    const res = await GET(req());
    expect(res.status).toBe(200);

    // The very first updateMany is the reclaim: status 'publishing' filtered by
    // an updatedAt cutoff, flipped back to 'scheduled'.
    const reclaim = mockPrisma.post.updateMany.mock.calls[0][0];
    expect(reclaim.where.status).toBe('publishing');
    expect(reclaim.where.updatedAt).toEqual(
      expect.objectContaining({ lt: expect.any(Date) })
    );
    expect(reclaim.data.status).toBe('scheduled');
  });
});

describe('publish-scheduled — multi-post isolation', () => {
  it('one failing post does not stop a following post from publishing', async () => {
    mockPrisma.post.findMany.mockResolvedValue([
      duePost({ id: 'p-bad' }),
      duePost({ id: 'p-good' }),
    ]);
    // Both claims succeed (default count 1). First post's platform call throws a
    // permanent error; second post publishes cleanly.
    mockCreatePlatformService
      .mockReturnValueOnce(serviceThrowing(new Error('hard adapter failure')))
      .mockReturnValueOnce(
        serviceReturning({ success: true, postId: 'fb-ok' })
      );

    const res = await GET(req());
    const body = await res.json();

    expect(body.processed).toBe(2);
    expect(body.failed).toBe(1);
    expect(body.published).toBe(1);
  });
});

describe('publish-scheduled — auth gate (regression guard)', () => {
  it('returns 401 and runs no reclaim/query for an unauthorised caller', async () => {
    mockVerifyCron.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
    });
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(mockPrisma.post.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.post.findMany).not.toHaveBeenCalled();
  });
});
