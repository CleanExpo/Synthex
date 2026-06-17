/**
 * Unit test — Creators (Influencer / UGC CRM) route (backlog #6).
 *
 * Drives the full validation ladder on both handlers (defineRoute + withAuth):
 *   401 (no session) → 403 (no org) → 400 (bad body) → 201 (created).
 * Plus: every row is org-scoped to the caller's clientId, and the GET list
 * reads only the caller's organisation.
 */

const findManyCreator = jest.fn();
const createCreator = jest.fn();
const findUniqueUser = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    creator: {
      findMany: (...a: unknown[]) => findManyCreator(...a),
      create: (...a: unknown[]) => createCreator(...a),
    },
    user: {
      findUnique: (...a: unknown[]) => findUniqueUser(...a),
    },
  },
}));

const getUserIdMock = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => getUserIdMock(...a),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  // Default: authenticated user, owner of org-1 (no membership row = direct owner).
  getUserIdMock.mockResolvedValue('user-1');
  findUniqueUser.mockResolvedValue({
    organizationId: 'org-1',
    teamMemberships: [],
  });
  findManyCreator.mockResolvedValue([]);
  createCreator.mockResolvedValue({
    id: 'creator-1',
    organizationId: 'org-1',
    name: 'Jane Doe',
    handle: '@jane',
    platform: 'instagram',
    email: null,
    followerCount: null,
    status: 'prospect',
    notes: null,
    createdAt: new Date('2026-06-18T00:00:00.000Z'),
    updatedAt: new Date('2026-06-18T00:00:00.000Z'),
  });
});

import { GET, POST } from '@/app/api/creators/route';

function makeRequest(body?: unknown) {
  return {
    nextUrl: {
      pathname: '/api/creators',
      searchParams: new URLSearchParams(),
    },
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/creators — validation ladder', () => {
  test('no session → 401', async () => {
    getUserIdMock.mockResolvedValue(null);
    const res = await POST(makeRequest({ name: 'Jane Doe' }));
    expect(res.status).toBe(401);
    expect(createCreator).not.toHaveBeenCalled();
  });

  test('no organisation → 403', async () => {
    findUniqueUser.mockResolvedValue({
      organizationId: null,
      teamMemberships: [],
    });
    const res = await POST(makeRequest({ name: 'Jane Doe' }));
    expect(res.status).toBe(403);
    expect(createCreator).not.toHaveBeenCalled();
  });

  test('missing name → 400 with { error, details }', async () => {
    const res = await POST(makeRequest({ handle: '@jane' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Validation failed');
    expect(json.details).toHaveProperty('name');
    expect(createCreator).not.toHaveBeenCalled();
  });

  test('invalid email → 400', async () => {
    const res = await POST(
      makeRequest({ name: 'Jane Doe', email: 'not-an-email' })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.details).toHaveProperty('email');
    expect(createCreator).not.toHaveBeenCalled();
  });

  test('invalid status enum → 400', async () => {
    const res = await POST(makeRequest({ name: 'Jane Doe', status: 'banned' }));
    expect(res.status).toBe(400);
    expect(createCreator).not.toHaveBeenCalled();
  });

  test('valid body → 201, persisted org-scoped with default status', async () => {
    const res = await POST(
      makeRequest({ name: 'Jane Doe', handle: '@jane', platform: 'instagram' })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.creator).toMatchObject({
      id: 'creator-1',
      organizationId: 'org-1',
    });

    const data = createCreator.mock.calls[0][0].data;
    expect(data).toMatchObject({
      organizationId: 'org-1',
      name: 'Jane Doe',
      handle: '@jane',
      platform: 'instagram',
      status: 'prospect',
    });
  });

  test('caller cannot set organizationId — it is bound to clientId', async () => {
    await POST(makeRequest({ name: 'Jane Doe', organizationId: 'org-999' }));
    const data = createCreator.mock.calls[0][0].data;
    expect(data.organizationId).toBe('org-1');
  });
});

describe('GET /api/creators — org-scoped list', () => {
  test('no session → 401', async () => {
    getUserIdMock.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(findManyCreator).not.toHaveBeenCalled();
  });

  test('lists only the caller organisation rows', async () => {
    findManyCreator.mockResolvedValue([
      {
        id: 'creator-1',
        organizationId: 'org-1',
        name: 'Jane Doe',
        status: 'active',
      },
    ]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.creators).toHaveLength(1);

    const where = findManyCreator.mock.calls[0][0].where;
    expect(where).toEqual({ organizationId: 'org-1' });
  });
});
