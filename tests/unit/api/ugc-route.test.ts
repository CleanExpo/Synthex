/**
 * Unit test — UGC intake + moderation route (backlog #6).
 *
 * Drives the validation ladder on all three handlers:
 *   401 (no session) → 403 (no org) → 400 (bad body) → 2xx.
 * Plus org-scope guarantees: intake binds organizationId to the caller, a
 * cross-org creatorId is rejected, the GET list reads only the caller's org,
 * and moderation only flips a row the caller owns (404 otherwise).
 */

const findManyUgc = jest.fn();
const createUgc = jest.fn();
const updateManyUgc = jest.fn();
const findUniqueUgc = jest.fn();
const findFirstCreator = jest.fn();
const findUniqueUser = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    ugcSubmission: {
      findMany: (...a: unknown[]) => findManyUgc(...a),
      create: (...a: unknown[]) => createUgc(...a),
      updateMany: (...a: unknown[]) => updateManyUgc(...a),
      findUnique: (...a: unknown[]) => findUniqueUgc(...a),
    },
    creator: {
      findFirst: (...a: unknown[]) => findFirstCreator(...a),
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
  findManyUgc.mockResolvedValue([]);
  findFirstCreator.mockResolvedValue({ id: 'creator-1' });
  createUgc.mockResolvedValue({
    id: 'ugc-1',
    organizationId: 'org-1',
    creatorId: null,
    assetUrl: 'https://cdn.example.com/a.jpg',
    caption: null,
    status: 'pending',
    submittedAt: new Date('2026-06-18T00:00:00.000Z'),
    createdAt: new Date('2026-06-18T00:00:00.000Z'),
  });
  updateManyUgc.mockResolvedValue({ count: 1 });
  findUniqueUgc.mockResolvedValue({
    id: 'ugc-1',
    organizationId: 'org-1',
    status: 'approved',
  });
});

import { GET, POST, PATCH } from '@/app/api/ugc/route';

function makeRequest(body?: unknown, search = '') {
  return {
    nextUrl: {
      pathname: '/api/ugc',
      searchParams: new URLSearchParams(search),
    },
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/ugc — intake validation ladder', () => {
  test('no session → 401', async () => {
    getUserIdMock.mockResolvedValue(null);
    const res = await POST(
      makeRequest({ assetUrl: 'https://cdn.example.com/a.jpg' })
    );
    expect(res.status).toBe(401);
    expect(createUgc).not.toHaveBeenCalled();
  });

  test('no organisation → 403', async () => {
    findUniqueUser.mockResolvedValue({
      organizationId: null,
      teamMemberships: [],
    });
    const res = await POST(
      makeRequest({ assetUrl: 'https://cdn.example.com/a.jpg' })
    );
    expect(res.status).toBe(403);
    expect(createUgc).not.toHaveBeenCalled();
  });

  test('neither assetUrl nor caption → 400', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Validation failed');
    expect(createUgc).not.toHaveBeenCalled();
  });

  test('invalid assetUrl → 400', async () => {
    const res = await POST(makeRequest({ assetUrl: 'not-a-url' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.details).toHaveProperty('assetUrl');
    expect(createUgc).not.toHaveBeenCalled();
  });

  test('cross-org creatorId → 400 (creator not in caller org)', async () => {
    findFirstCreator.mockResolvedValue(null);
    const res = await POST(
      makeRequest({ caption: 'hi', creatorId: 'creator-999' })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.details).toHaveProperty('creatorId');
    expect(createUgc).not.toHaveBeenCalled();
    // creator lookup is org-scoped
    expect(findFirstCreator.mock.calls[0][0].where).toEqual({
      id: 'creator-999',
      organizationId: 'org-1',
    });
  });

  test('valid body → 201, persisted org-scoped with status pending', async () => {
    const res = await POST(
      makeRequest({
        assetUrl: 'https://cdn.example.com/a.jpg',
        caption: 'nice',
      })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.submission).toMatchObject({
      id: 'ugc-1',
      organizationId: 'org-1',
    });

    const data = createUgc.mock.calls[0][0].data;
    expect(data).toMatchObject({
      organizationId: 'org-1',
      assetUrl: 'https://cdn.example.com/a.jpg',
      caption: 'nice',
      status: 'pending',
    });
  });

  test('caller cannot set organizationId — it is bound to clientId', async () => {
    await POST(makeRequest({ caption: 'hi', organizationId: 'org-999' }));
    const data = createUgc.mock.calls[0][0].data;
    expect(data.organizationId).toBe('org-1');
  });
});

describe('GET /api/ugc — org-scoped list', () => {
  test('no session → 401', async () => {
    getUserIdMock.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(findManyUgc).not.toHaveBeenCalled();
  });

  test('lists only the caller organisation rows', async () => {
    findManyUgc.mockResolvedValue([
      { id: 'ugc-1', organizationId: 'org-1', status: 'pending' },
    ]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.submissions).toHaveLength(1);
    expect(findManyUgc.mock.calls[0][0].where).toEqual({
      organizationId: 'org-1',
    });
  });

  test('?status= filter is applied within the org scope', async () => {
    await GET(makeRequest(undefined, 'status=approved'));
    expect(findManyUgc.mock.calls[0][0].where).toEqual({
      organizationId: 'org-1',
      status: 'approved',
    });
  });

  test('invalid ?status= → 400', async () => {
    const res = await GET(makeRequest(undefined, 'status=banned'));
    expect(res.status).toBe(400);
    expect(findManyUgc).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/ugc — org-scoped moderation', () => {
  test('no session → 401', async () => {
    getUserIdMock.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ id: 'ugc-1', status: 'approved' }));
    expect(res.status).toBe(401);
    expect(updateManyUgc).not.toHaveBeenCalled();
  });

  test('invalid status enum → 400', async () => {
    const res = await PATCH(makeRequest({ id: 'ugc-1', status: 'pending' }));
    expect(res.status).toBe(400);
    expect(updateManyUgc).not.toHaveBeenCalled();
  });

  test('row not owned by caller org → 404', async () => {
    updateManyUgc.mockResolvedValue({ count: 0 });
    const res = await PATCH(makeRequest({ id: 'ugc-999', status: 'approved' }));
    expect(res.status).toBe(404);
    expect(updateManyUgc.mock.calls[0][0].where).toEqual({
      id: 'ugc-999',
      organizationId: 'org-1',
    });
  });

  test('owned row → 200, status flipped', async () => {
    const res = await PATCH(makeRequest({ id: 'ugc-1', status: 'approved' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.submission).toMatchObject({ id: 'ugc-1', status: 'approved' });
    expect(updateManyUgc.mock.calls[0][0].data).toEqual({ status: 'approved' });
  });
});
