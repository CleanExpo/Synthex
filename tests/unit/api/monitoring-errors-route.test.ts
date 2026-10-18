/**
 * Unit tests for POST/GET /api/monitoring/errors.
 *
 * SEAM: the route handlers called through createMockNextRequest, with the
 * session (getUserIdFromRequestOrCookies) and Prisma mocked at the boundary;
 * the real verifyAdmin and isOwnerEmail decide admin status.
 * Catches: one user reading another user's error reports or statistics, and
 * the reporter's email being stored or returned. Misses: persistence across
 * server instances (the log is in-memory per instance).
 */

import { createMockNextRequest } from '../../helpers/mock-request';

const getUserIdMock = jest.fn();
const mockPrisma = { user: { findUnique: jest.fn() } };

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: mockPrisma,
  default: mockPrisma,
}));
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => getUserIdMock(...a),
  isOwnerEmail: jest.requireActual('@/lib/auth/owner-email').isOwnerEmail,
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

type Route = typeof import('@/app/api/monitoring/errors/route');

const URL_BASE = 'http://localhost:3000/api/monitoring/errors';

const USERS: Record<
  string,
  { id: string; email: string; preferences: unknown }
> = {
  'user-a': { id: 'user-a', email: 'alice@example.com', preferences: null },
  'user-b': { id: 'user-b', email: 'bob@example.com', preferences: null },
  'admin-1': {
    id: 'admin-1',
    email: 'ops@example.com',
    preferences: { role: 'admin' },
  },
};

let route: Route;

function as(userId: string | null) {
  getUserIdMock.mockResolvedValue(userId);
}

async function post(body: Record<string, unknown>) {
  return route.POST(
    createMockNextRequest({ method: 'POST', url: URL_BASE, body })
  );
}

async function get() {
  const res = await route.GET(
    createMockNextRequest({ method: 'GET', url: URL_BASE })
  );
  return { status: res.status, body: await res.json() };
}

describe('/api/monitoring/errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Fresh module per test: the error log is module-wide state.
    jest.resetModules();
    route = require('@/app/api/monitoring/errors/route');
    mockPrisma.user.findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) => USERS[where.id] ?? null
    );
  });

  it("user B cannot read user A's error report", async () => {
    as('user-a');
    await post({
      id: 'a-1',
      message: 'alice boom',
      stack: 'Error: alice-secret-stack',
      level: 'error',
      context: { page: 'alice-private' },
      timestamp: new Date().toISOString(),
    });

    as('user-b');
    const { status, body } = await get();
    expect(status).toBe(200);
    const raw = JSON.stringify(body);
    expect(raw).not.toMatch(/a-1|user-a|alice/);
  });

  it("user B's statistics do not count user A's entries", async () => {
    as('user-a');
    await post({
      id: 'a-1',
      level: 'error',
      timestamp: new Date().toISOString(),
    });
    await post({
      id: 'a-2',
      level: 'info',
      timestamp: new Date().toISOString(),
    });
    as('user-b');
    await post({
      id: 'b-1',
      level: 'warning',
      timestamp: new Date().toISOString(),
    });

    const { body } = await get();
    expect(body.stats).toEqual({
      total: 1,
      last24Hours: 1,
      byLevel: { error: 0, warning: 1, info: 0 },
    });
  });

  it('a user reads their own entries', async () => {
    as('user-a');
    await post({ id: 'a-1', message: 'mine', level: 'info' });
    const { body } = await get();
    expect(body.errors.map((e: { id: string }) => e.id)).toEqual(['a-1']);
  });

  it('a platform admin reads every entry', async () => {
    as('user-a');
    await post({ id: 'a-1', level: 'info' });
    as('user-b');
    await post({ id: 'b-1', level: 'info' });

    as('admin-1');
    const { body } = await get();
    expect(body.errors.map((e: { id: string }) => e.id).sort()).toEqual([
      'a-1',
      'b-1',
    ]);
    expect(body.stats.total).toBe(2);
  });

  it("the reporter's email is never stored or returned", async () => {
    as('user-a');
    await post({ id: 'a-1', level: 'info' });
    as('admin-1');
    const { body } = await get();
    expect(body.errors[0].userId).toBe('user-a');
    expect(JSON.stringify(body)).not.toContain('alice@example.com');
  });

  it('a client cannot attribute a report to another user', async () => {
    as(null);
    await post({ id: 'forged', userId: 'user-b', userEmail: 'x@example.com' });
    as('user-b');
    const { body } = await get();
    expect(body.errors).toEqual([]);
  });

  it('records anonymous errors without a user lookup', async () => {
    as(null);
    const res = await post({ message: 'anon', id: 'e2' });
    expect(res.status).toBe(200);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('requires authentication to read the error log', async () => {
    as(null);
    const { status } = await get();
    expect(status).toBe(401);
  });
});
