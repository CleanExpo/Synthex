/**
 * @jest-environment node
 *
 * P2 u16: five routes stopped using the noop-client wrapper.
 *  - brand-video generate/jobs and admin private-refs have no backing table or
 *    private storage, so they answer 503 FEATURE_NOT_PROVISIONED after auth.
 *  - founder delete-account is ported to Prisma, scoped to the caller.
 *  - health/scaling authenticates via the real JWT helper.
 */

import type { NextRequest } from 'next/server';

const mockGetUserId = jest.fn();
const mockPreflight = jest.fn();
const mockRevoke = jest.fn();

const mockPrisma = {
  platformConnection: { findMany: jest.fn() },
  session: { deleteMany: jest.fn() },
  account: { deleteMany: jest.fn() },
  user: { delete: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: mockPrisma,
  default: mockPrisma,
}));

jest.mock('@/lib/auth/with-auth', () => ({
  withAuth:
    (handler: (req: unknown, auth: { userId: string }) => unknown) =>
    async (req: unknown) =>
      handler(req, { userId: 'user-A' }),
}));

jest.mock('@/lib/rate-limit', () => ({
  withRateLimit: (_req: unknown, fn: () => unknown) => fn(),
}));

jest.mock('@/lib/middleware/api-rate-limit', () => ({
  writeDefault: (_req: unknown, fn: () => unknown) => fn(),
}));

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
  unauthorizedResponse: () =>
    new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));

jest.mock('@/lib/brand-video/preflight', () => ({
  preflightBrandAssets: (...args: unknown[]) => mockPreflight(...args),
}));

jest.mock('@/lib/oauth', () => ({
  revokePlatformTokens: (...args: unknown[]) => mockRevoke(...args),
  isSupportedPlatform: () => true,
}));

jest.mock('@/lib/security/field-encryption', () => ({
  decryptFieldSafe: (v: string) => `plain:${v}`,
}));

import * as generate from '@/app/api/brand-video/generate/route';
import * as jobs from '@/app/api/brand-video/jobs/route';
import * as privateRefs from '@/app/api/admin/private-refs/route';
import * as deleteAccount from '@/app/api/founder/delete-account/route';
import * as scaling from '@/app/api/health/scaling/route';

function req(
  url: string,
  method: string,
  body?: unknown,
  headers: Record<string, string> = {}
): NextRequest {
  return new Request(`https://synthex.test${url}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('user-A');
  mockPreflight.mockReturnValue({
    ok: true,
    slug: 'synthex',
    findings: [],
    warnings: [],
  });
});

describe('POST /api/brand-video/generate (NOT_PROVISIONED brand_video_jobs)', () => {
  it('answers 503 FEATURE_NOT_PROVISIONED instead of a queued job', async () => {
    const res = await generate.POST(
      req('/api/brand-video/generate', 'POST', {
        brand: 'synthex',
        topic: 'launch',
      })
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('FEATURE_NOT_PROVISIONED');
    expect(body.message).toContain('brand_video_jobs');
    expect(body.jobId).toBeUndefined();
  });

  it('still rejects an invalid body with 400', async () => {
    const res = await generate.POST(
      req('/api/brand-video/generate', 'POST', { brand: '' })
    );
    expect(res.status).toBe(400);
  });

  it('still refuses a brand that fails preflight with 400', async () => {
    mockPreflight.mockReturnValue({
      ok: false,
      findings: [{ message: 'unknown brand' }],
      warnings: [],
    });
    const res = await generate.POST(
      req('/api/brand-video/generate', 'POST', { brand: 'x', topic: 't' })
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /api/brand-video/jobs (NOT_PROVISIONED brand_video_jobs)', () => {
  it('answers 503 rather than an empty job list', async () => {
    const res = await jobs.GET(req('/api/brand-video/jobs', 'GET'));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('FEATURE_NOT_PROVISIONED');
    expect(body.message).toContain('brand_video_jobs');
    expect(body.jobs).toBeUndefined();
  });
});

describe('POST /api/admin/private-refs (NOT_PROVISIONED reference-library-private)', () => {
  const original = process.env.REFERENCE_INGEST_TOKEN;
  beforeAll(() => {
    process.env.REFERENCE_INGEST_TOKEN = 'secret-token';
  });
  afterAll(() => {
    process.env.REFERENCE_INGEST_TOKEN = original;
  });

  it('rejects a missing or wrong ingest token with 401', async () => {
    const res = await privateRefs.POST(
      req('/api/admin/private-refs', 'POST', undefined, {
        'x-ingest-token': 'wrong-token!',
      })
    );
    expect(res.status).toBe(401);
  });

  it('answers 503 FEATURE_NOT_PROVISIONED after auth', async () => {
    const res = await privateRefs.POST(
      req('/api/admin/private-refs', 'POST', undefined, {
        'x-ingest-token': 'secret-token',
      })
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('FEATURE_NOT_PROVISIONED');
    expect(body.message).toContain('reference-library-private');
  });
});

describe('POST /api/founder/delete-account (ported to Prisma)', () => {
  const confirm = { confirmation: 'DELETE MY ACCOUNT' };

  beforeEach(() => {
    mockPrisma.platformConnection.findMany.mockResolvedValue([
      { platform: 'linkedin', accessToken: 'enc-1' },
    ]);
    mockPrisma.session.deleteMany.mockReturnValue('op-session');
    mockPrisma.account.deleteMany.mockReturnValue('op-account');
    mockPrisma.user.delete.mockReturnValue('op-user');
    mockPrisma.$transaction.mockResolvedValue([]);
  });

  it('401s without a session and touches no data', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await deleteAccount.POST(
      req('/api/founder/delete-account', 'POST', confirm)
    );
    expect(res.status).toBe(401);
    expect(mockPrisma.platformConnection.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('revokes and deletes only the caller, scoped by userId', async () => {
    const res = await deleteAccount.POST(
      req('/api/founder/delete-account', 'POST', confirm)
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.platformConnection.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-A', isActive: true },
      select: { platform: true, accessToken: true },
    });
    expect(mockRevoke).toHaveBeenCalledWith('linkedin', 'plain:enc-1');
    expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-A' },
    });
    expect(mockPrisma.account.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-A' },
    });
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'user-A' },
    });
    expect(mockPrisma.$transaction).toHaveBeenCalledWith([
      'op-session',
      'op-account',
      'op-user',
    ]);
  });

  it('returns 500, not success, when the deletion fails', async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error('db down'));
    const res = await deleteAccount.POST(
      req('/api/founder/delete-account', 'POST', confirm)
    );
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Account deletion failed');
  });
});

describe('/api/health/scaling (real JWT auth)', () => {
  it('GET 401s when the caller is not authenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await scaling.GET(req('/api/health/scaling', 'GET'));
    expect(res.status).toBe(401);
  });

  it('GET returns metrics for an authenticated caller', async () => {
    const r = req('/api/health/scaling', 'GET');
    const res = await scaling.GET(r);
    expect(mockGetUserId).toHaveBeenCalledWith(r);
    expect([200, 207, 503]).toContain(res.status);
    expect((await res.json()).resources).toBeDefined();
  });

  it('POST 401s when the caller is not authenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await scaling.POST(
      req('/api/health/scaling', 'POST', { action: 'reset' })
    );
    expect(res.status).toBe(401);
  });
});
