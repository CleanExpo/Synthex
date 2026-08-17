/**
 * Publish-safety coverage for /api/cron/publish-scheduled — the autopilot path.
 *
 * The cron drains Post rows with status='scheduled'. Autopilot (autonomous)
 * posts are minted with status='scheduled' + metadata.source='autopilot'
 * (lib/autopilot/launch-pipeline.ts). Before this fix the cron published them
 * to LIVE social regardless of the org's calendarMode (schema default 'shadow')
 * or autoPublishPaused flag — the human-gated publish_queue path enforces those
 * via lib/publish/safetyChecks.ts, but the autopilot path bypassed them.
 *
 * These tests lock the fix: an autopilot post must NOT be claimed or published
 * while the org is in shadow mode or paused; and human-scheduled posts
 * (source !== 'autopilot') are unaffected.
 *
 * TWO GATES, and they are separate — keep them separate when reading a failure.
 * The publish-SAFETY gate (calendarMode / autoPublishPaused) runs first and is
 * what "deferred" counts. The campaign-AUTHORITY gate runs later. An autopilot
 * post now clears the first and is held by the second, because a machine-
 * authored post carries no human scheduler and `self_authored` would be a false
 * claim (SYN-1157). So "live + unpaused" no longer means "publishes" — it means
 * "reaches the authority gate", which then routes it to pending_approval.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  post: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  organization: { findUnique: jest.fn() },
  platformConnection: { findFirst: jest.fn() },
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

jest.mock('@/lib/security/field-encryption', () => ({
  decryptFieldSafe: (v: string) => v,
  encryptField: (v: string) => v,
}));

jest.mock('@/lib/unite-group-connector', () => ({
  pushUniteGroupEvent: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { GET } from '@/app/api/cron/publish-scheduled/route';

function req() {
  return createMockNextRequest({
    url: 'http://localhost/api/cron/publish-scheduled',
  });
}

/** A due autopilot post (status='scheduled', metadata.source='autopilot'). */
function autopilotPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ap1',
    content: 'autonomous hello world',
    platform: 'facebook',
    metadata: { source: 'autopilot' },
    // The route selects scheduledAt and the manifest records it as the real
    // human scheduling moment (SYN-1157). The query filters on
    // `scheduledAt: { lte: now }`, so a due post always carries one.
    scheduledAt: new Date('2026-08-01T10:00:00.000Z'),
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

/** Assert the atomic publish-claim (scheduled -> publishing) never ran. */
function claimNeverRan() {
  const claimCall = mockPrisma.post.updateMany.mock.calls.find(
    ([arg]: [{ data?: { status?: string } }]) =>
      arg?.data?.status === 'publishing'
  );
  return claimCall === undefined;
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
  // stale-reclaim (count 0) then claim succeeds (count 1) by default.
  mockPrisma.post.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.notification.create.mockResolvedValue({});
  mockIsPlatformSupported.mockReturnValue(true);
  // Default org: live + not paused (safe to publish).
  mockPrisma.organization.findUnique.mockResolvedValue({
    calendarMode: 'live',
    autoPublishPaused: false,
  });
});

describe('GET /api/cron/publish-scheduled — autopilot publish-safety gate', () => {
  it('does NOT publish an autopilot post while the org is in shadow mode', async () => {
    mockPrisma.post.findMany.mockResolvedValue([autopilotPost()]);
    mockPrisma.organization.findUnique.mockResolvedValue({
      calendarMode: 'shadow',
      autoPublishPaused: false,
    });

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.processed).toBe(1);
    expect(body.published).toBe(0);
    expect(body.deferred).toBe(1);
    // The post must be LEFT scheduled — never claimed, never sent to a platform.
    expect(claimNeverRan()).toBe(true);
    expect(mockCreatePlatformService).not.toHaveBeenCalled();
    expect(mockPrisma.platformConnection.findFirst).not.toHaveBeenCalled();
  });

  it('does NOT publish an autopilot post while auto-publish is paused (org live)', async () => {
    mockPrisma.post.findMany.mockResolvedValue([autopilotPost()]);
    mockPrisma.organization.findUnique.mockResolvedValue({
      calendarMode: 'live',
      autoPublishPaused: true,
    });

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.processed).toBe(1);
    expect(body.published).toBe(0);
    expect(body.deferred).toBe(1);
    expect(claimNeverRan()).toBe(true);
    expect(mockCreatePlatformService).not.toHaveBeenCalled();
  });

  it('clears the publish-safety gate when the org is live + not paused', async () => {
    mockPrisma.post.findMany.mockResolvedValue([autopilotPost()]);
    // live + unpaused is the beforeEach default, so the SAFETY gate must not
    // defer. This test owns the safety gate only; the authority gate below is
    // what stops the post afterwards.
    mockPrisma.platformConnection.findFirst.mockResolvedValue(null);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deferred).toBe(0);
    // Not deferred: it was claimed (scheduled -> publishing), which is the
    // safety gate passing.
    expect(claimNeverRan()).toBe(false);
  });

  it('routes an autopilot post to pending_approval — it never claims a human scheduler', async () => {
    // SYN-1157, second instance. `self_authored` asserts "a human wrote and
    // scheduled this". Autopilot posts are minted by lib/autopilot/
    // launch-pipeline.ts with no manifest and no human, so the route must NOT
    // name the campaign owner as their scheduler. With no scheduler the gate
    // refuses (`campaign_self_authored_scheduler_missing`) and the post waits
    // for a real verdict.
    //
    // PRODUCT CONSEQUENCE, stated so it is never a surprise: this means an
    // autopilot post does NOT publish autonomously — it lands in the approval
    // queue. That is the intended trade. Restoring autonomous publishing needs
    // a distinct machine-authored approval state, not a fabricated human one.
    mockPrisma.post.findMany.mockResolvedValue([autopilotPost()]);
    mockPrisma.platformConnection.findFirst.mockResolvedValue(null);

    const res = await GET(req());
    expect(res.status).toBe(200);

    const gated = mockPrisma.post.update.mock.calls.find(
      ([arg]: [{ data?: { status?: string } }]) =>
        arg?.data?.status === 'pending_approval'
    );
    expect(gated).toBeDefined();

    const written = gated![0] as {
      data: {
        metadata: { publishGate: { allowed: boolean; blockers: string[] } };
      };
    };
    expect(written.data.metadata.publishGate.allowed).toBe(false);
    expect(written.data.metadata.publishGate.blockers).toContain(
      'campaign_self_authored_scheduler_missing'
    );

    // The platform must never be contacted for a post the gate refused.
    expect(mockPrisma.platformConnection.findFirst).not.toHaveBeenCalled();
  });

  it('positive control: a human-scheduled post still carries its real scheduler and is NOT gated', async () => {
    // The discriminator. If this also landed in pending_approval, the change
    // above would be "block everything", which proves nothing.
    mockPrisma.post.findMany.mockResolvedValue([
      autopilotPost({ id: 'manual2', metadata: { source: 'quick' } }),
    ]);
    mockPrisma.platformConnection.findFirst.mockResolvedValue(null);

    const res = await GET(req());
    expect(res.status).toBe(200);

    const gated = mockPrisma.post.update.mock.calls.find(
      ([arg]: [{ data?: { status?: string } }]) =>
        arg?.data?.status === 'pending_approval'
    );
    expect(gated).toBeUndefined();
    expect(mockPrisma.platformConnection.findFirst).toHaveBeenCalled();
  });

  it('does not gate a human-scheduled post (source !== autopilot), even in shadow', async () => {
    // A manually-scheduled post is the user's own gate. It must publish through
    // the same cron regardless of calendarMode/pause — no regression.
    mockPrisma.post.findMany.mockResolvedValue([
      autopilotPost({ id: 'manual1', metadata: { source: 'quick' } }),
    ]);
    mockPrisma.organization.findUnique.mockResolvedValue({
      calendarMode: 'shadow',
      autoPublishPaused: true,
    });
    mockPrisma.platformConnection.findFirst.mockResolvedValue(null);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deferred).toBe(0);
    // Reached the publish flow (claimed + connector lookup) — never deferred.
    expect(claimNeverRan()).toBe(false);
    expect(mockPrisma.platformConnection.findFirst).toHaveBeenCalled();
  });
});
