/**
 * Behavioral coverage for /api/admin/upgrade-subscription (SYN-1000).
 * This route can grant any user a paid plan — the admin gate is the only thing
 * standing between an anonymous caller and a free subscription upgrade.
 *
 * This route uses its OWN inline verifyAdmin (x-admin-api-key OR admin JWT),
 * not the shared lib helper. We prove the gate without reaching Supabase:
 *   - no credentials            → 403 (returns before any Supabase call)
 *   - valid admin key, bad body → 400 (validation before any Supabase call)
 * The 200 path upserts the subscription and its audit row in one Prisma
 * transaction; an audit failure must leave no committed plan change.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

// Subscription writes that a $transaction actually committed: staged inside the
// callback, kept only if the whole callback resolves (a rejection rolls back).
const mockCommitted: unknown[] = [];
const mockTxCalls: number[] = [];
const mockPrisma = {
  user: { findUnique: jest.fn() },
  subscription: { upsert: jest.fn() },
  auditLog: { create: jest.fn() },
  // A plain function: the jest config resets jest.fn implementations.
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
    mockTxCalls.push(1);
    const staged: unknown[] = [];
    const tx = {
      subscription: {
        upsert: async (a: unknown) => {
          staged.push(a);
          return mockPrisma.subscription.upsert(a);
        },
      },
      auditLog: { create: (a: unknown) => mockPrisma.auditLog.create(a) },
    };
    const result = await fn(tx);
    mockCommitted.push(...staged);
    return result;
  },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

import { POST } from '@/app/api/admin/upgrade-subscription/route';
import { generateToken } from '@/lib/auth/jwt-utils';

const ORIGINAL_ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const TEST_ADMIN_KEY = 'test-admin-key-syn1000';

beforeEach(() => {
  jest.clearAllMocks();
  mockCommitted.length = 0;
  mockTxCalls.length = 0;
  process.env.ADMIN_API_KEY = TEST_ADMIN_KEY;
});

afterAll(() => {
  process.env.ADMIN_API_KEY = ORIGINAL_ADMIN_API_KEY;
});

describe('POST /api/admin/upgrade-subscription — admin gate (SYN-1000)', () => {
  it('returns 403 when no admin credentials are supplied', async () => {
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/admin/upgrade-subscription',
        body: { email: 'user@example.com', plan: 'pro' },
      })
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 for an admin (valid api key) sending an invalid plan', async () => {
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/admin/upgrade-subscription',
        headers: { 'x-admin-api-key': TEST_ADMIN_KEY },
        body: { email: 'user@example.com', plan: 'not-a-real-plan' },
      })
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for an admin (valid api key) sending a malformed email', async () => {
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/admin/upgrade-subscription',
        headers: { 'x-admin-api-key': TEST_ADMIN_KEY },
        body: { email: 'not-an-email', plan: 'pro' },
      })
    );
    expect(res.status).toBe(400);
  });

  it('rejects a wrong admin api key with 403', async () => {
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/admin/upgrade-subscription',
        headers: { 'x-admin-api-key': 'wrong-key-wrong-length-too' },
        body: { email: 'user@example.com', plan: 'pro' },
      })
    );
    expect(res.status).toBe(403);
  });
});

describe('POST /api/admin/upgrade-subscription — Prisma write path', () => {
  const target = {
    id: 'user-target',
    email: 'user@example.com',
    name: 'Target',
  };
  const sub = {
    id: 'sub-1',
    plan: 'pro',
    status: 'active',
    currentPeriodStart: new Date('2026-10-18T00:00:00Z'),
    currentPeriodEnd: new Date('2027-10-18T00:00:00Z'),
    maxSocialAccounts: 5,
    maxAiPosts: 100,
    maxPersonas: 3,
  };

  beforeEach(() => {
    mockPrisma.subscription.upsert.mockResolvedValue(sub);
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
  });

  it("upserts only the target user's subscription and audits it (admin api key)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(target);
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/admin/upgrade-subscription',
        headers: { 'x-admin-api-key': TEST_ADMIN_KEY },
        body: { email: 'user@example.com', plan: 'pro' },
      })
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.subscription.id).toBe('sub-1');

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
      select: { id: true, email: true, name: true },
    });
    const upsert = mockPrisma.subscription.upsert.mock.calls[0][0];
    expect(upsert.where).toEqual({ userId: 'user-target' });
    expect(upsert.create.userId).toBe('user-target');
    expect(upsert.update).toMatchObject({
      plan: 'pro',
      status: 'active',
      cancelledAt: null,
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        action: 'subscription_upgraded',
        resourceId: 'sub-1',
      }),
    });
    expect(mockCommitted).toHaveLength(1);
  });

  it('500 and no committed plan change when the audit write fails', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(target);
    mockPrisma.auditLog.create.mockRejectedValue(new Error('audit down'));
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/admin/upgrade-subscription',
        headers: { 'x-admin-api-key': TEST_ADMIN_KEY },
        body: { email: 'user@example.com', plan: 'pro' },
      })
    );
    expect(res.status).toBe(500);
    expect(mockTxCalls).toHaveLength(1);
    expect(mockCommitted).toHaveLength(0);
  });

  it('404 and no write when the email has no user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/admin/upgrade-subscription',
        headers: { 'x-admin-api-key': TEST_ADMIN_KEY },
        body: { email: 'nobody@example.com', plan: 'pro' },
      })
    );
    expect(res.status).toBe(404);
    expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
  });

  it('403 for a JWT caller whose users.preferences role is not admin', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-plain',
      preferences: { role: 'user' },
    });
    const token = generateToken({
      userId: 'user-plain',
      email: 'plain@example.com',
    } as never);
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/admin/upgrade-subscription',
        headers: { authorization: `Bearer ${token}` },
        body: { email: 'user@example.com', plan: 'pro' },
      })
    );
    expect(res.status).toBe(403);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-plain' },
      select: { id: true, preferences: true },
    });
    expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
  });
});
