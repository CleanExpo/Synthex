/**
 * Behavioural coverage for /api/cron/publish-scheduled — the live Vercel cron
 * (registered in vercel.json) that publishes scheduled Posts. It had no
 * handler-level test, so a regression could break autonomous publishing with a
 * green suite. Locks: cron auth gate, the clean no-work run, and the
 * no-connection failure path (mark failed + notify, no crash).
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
  createPlatformService: (...args: unknown[]) => mockCreatePlatformService(...args),
}));

jest.mock('@/lib/security/field-encryption', () => ({
  decryptFieldSafe: (v: string) => v,
  encryptField: (v: string) => v,
}));

jest.mock('@/lib/unite-hub-connector', () => ({ pushUniteHubEvent: jest.fn() }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { GET } from '@/app/api/cron/publish-scheduled/route';
import { NextResponse } from 'next/server';

function req() {
  return createMockNextRequest({ url: 'http://localhost/api/cron/publish-scheduled' });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyCron.mockReturnValue({ ok: true, scope: 'shared-fallback' });
  mockPrisma.post.findMany.mockResolvedValue([]);
  mockPrisma.post.findUnique.mockResolvedValue({ status: 'scheduled', publishedAt: null, metadata: {} });
  mockPrisma.post.update.mockResolvedValue({});
  // Default: claims succeed (count 1) and stale-reclaim finds nothing (count 0).
  // Individual tests override the claim result to model a lost race.
  mockPrisma.post.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.notification.create.mockResolvedValue({});
  mockIsPlatformSupported.mockReturnValue(true);
});

describe('GET /api/cron/publish-scheduled', () => {
  it('returns 401 and never queries posts for an unauthorised caller', async () => {
    mockVerifyCron.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
    });
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(mockPrisma.post.findMany).not.toHaveBeenCalled();
  });

  it('runs clean with nothing due (processed 0)', async () => {
    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.processed).toBe(0);
    expect(body.published).toBe(0);
  });

  it('marks a post failed and notifies when no platform connection exists', async () => {
    const manifest = buildApprovedCampaignAuthorityManifest({
      platformOutputs: [
        { platform: 'facebook', status: 'approved', contentRef: 'post-fb' },
      ],
    });
    mockPrisma.post.findMany.mockResolvedValue([
      {
        id: 'p1',
        content: 'hello world',
        platform: 'facebook',
        metadata: { campaignAuthorityManifest: manifest },
        campaign: {
          userId: 'u1',
          platform: 'facebook',
          organizationId: 'org-1',
          settings: {},
          content: {},
        },
      },
    ]);
    mockPrisma.platformConnection.findFirst.mockResolvedValue(null); // no connection

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.failed).toBe(1);
    expect(body.published).toBe(0);
    // marked failed + the user was notified — never silently dropped, never crashed
    expect(mockPrisma.post.update).toHaveBeenCalled();
    expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1);
    // never reached the actual platform publish
    expect(mockCreatePlatformService).not.toHaveBeenCalled();
  });

  it('lets an ordinary post WITHOUT a manifest through the gate to connector lookup (P0 auto-generate)', async () => {
    // Ordinary self-authored scheduled post: empty metadata, no manifest. Pre-P0
    // this was routed to pending_approval and never published. The cron now
    // auto-generates a minimal valid manifest just-before-publish, so the post
    // passes the gate and proceeds to the connector lookup.
    mockPrisma.post.findMany.mockResolvedValue([
      {
        id: 'p1',
        content: 'hello world',
        platform: 'facebook',
        metadata: {},
        campaign: {
          userId: 'u1',
          platform: 'facebook',
          organizationId: 'org-1',
          settings: {},
          content: {},
        },
      },
    ]);
    mockPrisma.platformConnection.findFirst.mockResolvedValue(null); // stop after the gate

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    // No longer blocked by the authority gate — it reached connector lookup.
    expect(body.blocked).toBe(0);
    expect(mockPrisma.platformConnection.findFirst).toHaveBeenCalled();
    // It was NOT routed to pending_approval by the authority gate.
    expect(mockPrisma.post.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'pending_approval' }),
      })
    );
  });

  it('STILL blocks a CCW-style post whose real manifest is NOT human-approved (gate preserved)', async () => {
    // A campaign that already carries a richer manifest still under human review
    // must NOT be papered over by the minimal auto-generated manifest. The
    // existing (unapproved) manifest is found first and gates as before.
    const unapprovedManifest = buildApprovedCampaignAuthorityManifest({
      platformOutputs: [
        { platform: 'facebook', status: 'approved', contentRef: 'post-fb' },
      ],
      approval: {
        status: 'pending',
        humanApproved: false,
      },
    });
    mockPrisma.post.findMany.mockResolvedValue([
      {
        id: 'p1',
        content: 'hello world',
        platform: 'facebook',
        metadata: { campaignAuthorityManifest: unapprovedManifest },
        campaign: {
          userId: 'u1',
          platform: 'facebook',
          organizationId: 'org-1',
          settings: {},
          content: {},
        },
      },
    ]);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.blocked).toBe(1);
    expect(body.failed).toBe(0);
    expect(mockPrisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: expect.objectContaining({ status: 'pending_approval' }),
      })
    );
    // Gated before any connector lookup or platform publish.
    expect(mockPrisma.platformConnection.findFirst).not.toHaveBeenCalled();
    expect(mockCreatePlatformService).not.toHaveBeenCalled();
    expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1);
  });

  it('skips a post WITHOUT publishing when the atomic claim is lost (count 0)', async () => {
    // Models the double-post race: this worker fetched the due post, but a
    // concurrent worker already claimed it, so the conditional updateMany flips
    // 0 rows. The post must be skipped — never published.
    mockPrisma.post.findMany.mockResolvedValue([
      {
        id: 'p1',
        content: 'hello world',
        platform: 'facebook',
        metadata: {},
        campaign: {
          userId: 'u1',
          platform: 'facebook',
          organizationId: 'org-1',
          settings: {},
          content: {},
        },
      },
    ]);
    // 1st updateMany = stale-reclaim (nothing stale). 2nd = the claim → LOST.
    mockPrisma.post.updateMany
      .mockResolvedValueOnce({ count: 0 }) // stale reclaim
      .mockResolvedValueOnce({ count: 0 }); // claim lost

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.processed).toBe(1);
    expect(body.published).toBe(0);
    expect(body.failed).toBe(0);
    // Never reached the gate, the connector, or the platform — pure skip.
    expect(mockPrisma.platformConnection.findFirst).not.toHaveBeenCalled();
    expect(mockCreatePlatformService).not.toHaveBeenCalled();
  });

  it('claims a due post (scheduled -> publishing) before any platform work', async () => {
    // Happy-path-ish: the post is claimed atomically. We stop at connector
    // lookup, but the important assertion is the conditional claim ran with the
    // correct guards before any platform interaction.
    mockPrisma.post.findMany.mockResolvedValue([
      {
        id: 'p1',
        content: 'hello world',
        platform: 'facebook',
        metadata: {},
        campaign: {
          userId: 'u1',
          platform: 'facebook',
          organizationId: 'org-1',
          settings: {},
          content: {},
        },
      },
    ]);
    mockPrisma.platformConnection.findFirst.mockResolvedValue(null); // stop after claim+gate

    await GET(req());

    // The claim is a conditional updateMany gated on scheduled + unpublished +
    // not-deleted, flipping to 'publishing'. (stale-reclaim is also an
    // updateMany, hence the array assertion.)
    const claimCall = mockPrisma.post.updateMany.mock.calls.find(
      ([arg]: [{ data?: { status?: string }; where?: { id?: string } }]) =>
        arg?.data?.status === 'publishing' && arg?.where?.id === 'p1'
    );
    expect(claimCall).toBeDefined();
    expect(claimCall![0].where).toEqual(
      expect.objectContaining({
        id: 'p1',
        status: 'scheduled',
        publishedAt: null,
        deletedAt: null,
      })
    );
  });
});
