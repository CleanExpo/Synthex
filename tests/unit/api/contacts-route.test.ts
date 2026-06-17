/**
 * Unit test — Contacts (CRM) route (backlog #3).
 *
 * Validation ladder on both handlers: 401 → 403 → 400 → 201. Plus org-scope:
 * every row is bound to the caller's organisation, a caller cannot spoof
 * organizationId, and the GET list reads only the caller's org. The Contact's
 * own `clientId` (soft ref to a Supabase client) is a normal body field, NOT the
 * org scope — the two must not be conflated.
 */

const findManyContact = jest.fn();
const createContact = jest.fn();
const findUniqueUser = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    contact: {
      findMany: (...a: unknown[]) => findManyContact(...a),
      create: (...a: unknown[]) => createContact(...a),
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
  findManyContact.mockResolvedValue([]);
  createContact.mockResolvedValue({
    id: 'contact-1',
    organizationId: 'org-1',
    clientId: null,
    name: 'Jane Doe',
    email: null,
    role: null,
    phone: null,
    createdAt: new Date('2026-06-18T00:00:00.000Z'),
    updatedAt: new Date('2026-06-18T00:00:00.000Z'),
  });
});

import { GET, POST } from '@/app/api/contacts/route';

function makeRequest(body?: unknown) {
  return {
    nextUrl: {
      pathname: '/api/contacts',
      searchParams: new URLSearchParams(),
    },
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/contacts — validation ladder', () => {
  test('no session → 401', async () => {
    getUserIdMock.mockResolvedValue(null);
    const res = await POST(makeRequest({ name: 'Jane Doe' }));
    expect(res.status).toBe(401);
    expect(createContact).not.toHaveBeenCalled();
  });

  test('no organisation → 403', async () => {
    findUniqueUser.mockResolvedValue({
      organizationId: null,
      teamMemberships: [],
    });
    const res = await POST(makeRequest({ name: 'Jane Doe' }));
    expect(res.status).toBe(403);
    expect(createContact).not.toHaveBeenCalled();
  });

  test('missing name → 400 with { error, details }', async () => {
    const res = await POST(makeRequest({ email: 'jane@example.com' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Validation failed');
    expect(json.details).toHaveProperty('name');
    expect(createContact).not.toHaveBeenCalled();
  });

  test('invalid email → 400', async () => {
    const res = await POST(
      makeRequest({ name: 'Jane Doe', email: 'not-an-email' })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.details).toHaveProperty('email');
    expect(createContact).not.toHaveBeenCalled();
  });

  test('valid body → 201, persisted org-scoped', async () => {
    const res = await POST(
      makeRequest({
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'CMO',
        clientId: 'client-9',
      })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.contact).toMatchObject({
      id: 'contact-1',
      organizationId: 'org-1',
    });

    const data = createContact.mock.calls[0][0].data;
    expect(data).toMatchObject({
      organizationId: 'org-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      role: 'CMO',
      clientId: 'client-9',
    });
  });

  test('caller cannot set organizationId — it is bound to the auth org', async () => {
    await POST(makeRequest({ name: 'Jane Doe', organizationId: 'org-999' }));
    const data = createContact.mock.calls[0][0].data;
    expect(data.organizationId).toBe('org-1');
  });

  test('body clientId is the soft client ref, not the org scope', async () => {
    await POST(makeRequest({ name: 'Jane Doe', clientId: 'client-9' }));
    const data = createContact.mock.calls[0][0].data;
    expect(data.organizationId).toBe('org-1');
    expect(data.clientId).toBe('client-9');
  });
});

describe('GET /api/contacts — org-scoped list', () => {
  test('no session → 401', async () => {
    getUserIdMock.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(findManyContact).not.toHaveBeenCalled();
  });

  test('lists only the caller organisation rows', async () => {
    findManyContact.mockResolvedValue([
      { id: 'contact-1', organizationId: 'org-1', name: 'Jane Doe' },
    ]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.contacts).toHaveLength(1);

    const where = findManyContact.mock.calls[0][0].where;
    expect(where).toEqual({ organizationId: 'org-1' });
  });
});
