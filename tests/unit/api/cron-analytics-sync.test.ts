/**
 * Behavioural coverage for /api/cron/analytics-sync — the live Vercel cron that
 * is supposed to pull real engagement metrics for published posts into the
 * `platform_metrics` table the dashboard reads.
 *
 * Regression this locks: the cron previously only wrote `lastSync` and never
 * called any platform `getPostMetrics`, so every published post showed 0
 * engagement forever. These tests prove metrics are now fetched at the platform
 * seam and persisted via an idempotent upsert, with per-post error isolation
 * and a graceful no-op for platforms outside the v1 ingestion set.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  organization: { findMany: jest.fn() },
  platformConnection: { update: jest.fn() },
  platformPost: { findMany: jest.fn() },
  platformMetrics: { upsert: jest.fn() },
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

const mockGetPostMetrics = jest.fn();
const mockCreatePlatformService = jest.fn();
const mockIsPlatformSupported = jest.fn();
jest.mock('@/lib/social', () => ({
  isPlatformSupported: (...args: unknown[]) => mockIsPlatformSupported(...args),
  createPlatformService: (...args: unknown[]) =>
    mockCreatePlatformService(...args),
}));

jest.mock('@/lib/security/field-encryption', () => ({
  decryptFieldSafe: (v: string) => v, // identity — tokens are plaintext in test
  encryptField: (v: string) => v,
}));

jest.mock('@/lib/notifications/createFirstWinNotification', () => ({
  createFirstWinNotification: jest.fn().mockResolvedValue({ detected: false }),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { GET } from '@/app/api/cron/analytics-sync/route';
import { NextResponse } from 'next/server';

function req() {
  return createMockNextRequest({
    url: 'http://localhost/api/cron/analytics-sync',
  });
}

function igConnection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conn-ig-1',
    platform: 'instagram',
    accessToken: 'tok',
    refreshToken: null,
    expiresAt: null,
    profileId: 'ig-123',
    profileName: 'acme',
    ...overrides,
  };
}

function orgWith(connections: unknown[]) {
  return {
    id: 'org-1',
    firstWinDetected: true, // skip first-win path — not under test here
    users: [{ id: 'u1' }],
    platformConnections: connections,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyCron.mockReturnValue({ ok: true, scope: 'shared-fallback' });
  mockIsPlatformSupported.mockReturnValue(true);
  mockPrisma.organization.findMany.mockResolvedValue([]);
  mockPrisma.platformConnection.update.mockResolvedValue({});
  mockPrisma.platformPost.findMany.mockResolvedValue([]);
  mockPrisma.platformMetrics.upsert.mockResolvedValue({});
  mockCreatePlatformService.mockReturnValue({
    getPostMetrics: mockGetPostMetrics,
  });
});

describe('GET /api/cron/analytics-sync', () => {
  it('returns 401 and never queries orgs for an unauthorised caller', async () => {
    mockVerifyCron.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
    });

    const res = await GET(req());

    expect(res.status).toBe(401);
    expect(mockPrisma.organization.findMany).not.toHaveBeenCalled();
  });

  it('ingests real metrics for a published Instagram post and persists them via upsert', async () => {
    mockPrisma.organization.findMany.mockResolvedValue([
      orgWith([igConnection()]),
    ]);
    mockPrisma.platformPost.findMany.mockResolvedValue([
      { id: 'post-1', platformId: 'ig-media-1' },
    ]);
    // Real-shaped Instagram getPostMetrics payload
    mockGetPostMetrics.mockResolvedValue({
      likes: 42,
      comments: 5,
      impressions: 1000,
      reach: 800,
      engagement: 60,
      saved: 7,
    });

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.postsIngested).toBe(1);

    // Hit the real platform seam with the platform post id
    expect(mockGetPostMetrics).toHaveBeenCalledWith('ig-media-1');

    // Persisted to the table the dashboard reads — idempotent latest-row id,
    // normalised columns (note saved → saves), and an engagement rate.
    expect(mockPrisma.platformMetrics.upsert).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.platformMetrics.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 'post-1_latest' });
    expect(arg.create).toMatchObject({
      id: 'post-1_latest',
      postId: 'post-1',
      likes: 42,
      comments: 5,
      shares: 0,
      impressions: 1000,
      reach: 800,
      saves: 7,
    });
    // engagement rate = (42+5+0+7)/1000 * 100 = 5.4
    expect(arg.create.engagementRate).toBeCloseTo(5.4, 3);
    expect(arg.update).toMatchObject({ likes: 42, impressions: 1000 });

    // Heartbeat still recorded
    expect(mockPrisma.platformConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conn-ig-1' },
        data: { lastSync: expect.any(Date) },
      })
    );
  });

  it('isolates a single failing post — the rest of the batch still persists', async () => {
    mockPrisma.organization.findMany.mockResolvedValue([
      orgWith([igConnection()]),
    ]);
    mockPrisma.platformPost.findMany.mockResolvedValue([
      { id: 'post-bad', platformId: 'ig-bad' },
      { id: 'post-good', platformId: 'ig-good' },
    ]);
    mockGetPostMetrics
      .mockRejectedValueOnce(new Error('platform 429'))
      .mockResolvedValueOnce({ likes: 10, impressions: 100 });

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    // one good post persisted despite the other throwing
    expect(body.postsIngested).toBe(1);
    expect(body.errors).toBe(1);
    expect(mockPrisma.platformMetrics.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.platformMetrics.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'post-good_latest' } })
    );
    // heartbeat still recorded — connection did not crash
    expect(mockPrisma.platformConnection.update).toHaveBeenCalledTimes(1);
  });

  it('no-ops gracefully for a platform outside the v1 ingestion set', async () => {
    mockPrisma.organization.findMany.mockResolvedValue([
      orgWith([igConnection({ id: 'conn-tt', platform: 'tiktok' })]),
    ]);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.postsIngested).toBe(0);
    // never even queried posts or hit the platform for an unsupported platform
    expect(mockPrisma.platformPost.findMany).not.toHaveBeenCalled();
    expect(mockGetPostMetrics).not.toHaveBeenCalled();
    // but the heartbeat is still recorded
    expect(mockPrisma.platformConnection.update).toHaveBeenCalledTimes(1);
  });

  it('does NOT ingest Facebook in v1 (FB Page insights are not readable via InstagramService)', async () => {
    // Regression guard: the factory routes 'facebook' to InstagramService, whose
    // getPostMetrics reads Instagram-media-only fields. Persisting that against a
    // FB Page post would write wrong/zero numbers, so FB must no-op until a
    // FB-Page-specific metrics path exists and is verified.
    mockPrisma.organization.findMany.mockResolvedValue([
      orgWith([igConnection({ id: 'conn-fb', platform: 'facebook' })]),
    ]);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.postsIngested).toBe(0);
    // never queried posts or hit the platform seam for facebook
    expect(mockPrisma.platformPost.findMany).not.toHaveBeenCalled();
    expect(mockGetPostMetrics).not.toHaveBeenCalled();
    expect(mockPrisma.platformMetrics.upsert).not.toHaveBeenCalled();
    // heartbeat is still recorded so lastSync stays fresh
    expect(mockPrisma.platformConnection.update).toHaveBeenCalledTimes(1);
  });
});
