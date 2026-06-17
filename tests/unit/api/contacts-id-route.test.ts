/**
 * Unit test — Contact detail (CRM) route /api/contacts/[id] (backlog #3).
 *
 * Completes the org-scoped CRUD surface: GET/PATCH/DELETE a single contact.
 * Covers the validation ladder (401 → 403 → 400 → 404 → 2xx) on each verb and the
 * cross-org guard: a contact in another org reads/updates/deletes as 404, and the
 * org-scoped `findFirst` where-clause is asserted so the scope cannot be dropped.
 * PATCH must never update by bare id without first confirming org ownership.
 */

const findFirstContact = jest.fn();
const updateContact = jest.fn();
const deleteContact = jest.fn();
const findUniqueUser = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    contact: {
      findFirst: (...a: unknown[]) => findFirstContact(...a),
      update: (...a: unknown[]) => updateContact(...a),
      delete: (...a: unknown[]) => deleteContact(...a),
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

import { GET, PATCH, DELETE } from '@/app/api/contacts/[id]/route';

const CONTACT_ID = 'contact-1';

function makeRequest(body?: unknown) {
  return {
    nextUrl: {
      pathname: `/api/contacts/${CONTACT_ID}`,
      searchParams: new URLSearchParams(),
    },
    json: async () => body,
  } as unknown as Parameters<typeof PATCH>[0];
}

function ctx(id = CONTACT_ID) {
  return { params: Promise.resolve({ id }) };
}

function existingContact() {
  return {
    id: CONTACT_ID,
    clientId: null,
    name: 'Jane Doe',
    email: 'jane@example.com',
    role: 'CMO',
    phone: null,
    createdAt: new Date('2026-06-18T00:00:00.000Z'),
    updatedAt: new Date('2026-06-18T00:00:00.000Z'),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  getUserIdMock.mockResolvedValue('user-1');
  findUniqueUser.mockResolvedValue({ organizationId: 'org-1' });
  findFirstContact.mockResolvedValue(existingContact());
  updateContact.mockResolvedValue({ ...existingContact(), name: 'Jane Smith' });
  deleteContact.mockResolvedValue(existingContact());
});

describe('GET /api/contacts/[id]', () => {
  test('no session → 401', async () => {
    getUserIdMock.mockResolvedValue(null);
    const res = await GET(makeRequest(), ctx());
    expect(res.status).toBe(401);
    expect(findFirstContact).not.toHaveBeenCalled();
  });

  test('no organisation → 403', async () => {
    findUniqueUser.mockResolvedValue({ organizationId: null });
    const res = await GET(makeRequest(), ctx());
    expect(res.status).toBe(403);
    expect(findFirstContact).not.toHaveBeenCalled();
  });

  test('not in caller org → 404 (org-scoped read)', async () => {
    findFirstContact.mockResolvedValue(null);
    const res = await GET(makeRequest(), ctx());
    expect(res.status).toBe(404);
    expect(findFirstContact).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONTACT_ID, organizationId: 'org-1' },
      })
    );
  });

  test('found → 200 with the contact', async () => {
    const res = await GET(makeRequest(), ctx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.contact).toMatchObject({ id: CONTACT_ID, name: 'Jane Doe' });
  });
});

describe('PATCH /api/contacts/[id]', () => {
  test('no session → 401', async () => {
    getUserIdMock.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ name: 'X' }), ctx());
    expect(res.status).toBe(401);
    expect(updateContact).not.toHaveBeenCalled();
  });

  test('invalid email → 400', async () => {
    const res = await PATCH(makeRequest({ email: 'not-an-email' }), ctx());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Validation failed');
    expect(json.details).toHaveProperty('email');
    expect(updateContact).not.toHaveBeenCalled();
  });

  test('empty name → 400', async () => {
    const res = await PATCH(makeRequest({ name: '' }), ctx());
    expect(res.status).toBe(400);
    expect(updateContact).not.toHaveBeenCalled();
  });

  test('not in caller org → 404, no update by bare id', async () => {
    findFirstContact.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ name: 'Jane Smith' }), ctx());
    expect(res.status).toBe(404);
    expect(findFirstContact).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONTACT_ID, organizationId: 'org-1' },
      })
    );
    expect(updateContact).not.toHaveBeenCalled();
  });

  test('valid partial update → 200, updates only the parsed fields', async () => {
    const res = await PATCH(makeRequest({ name: 'Jane Smith' }), ctx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.contact.name).toBe('Jane Smith');

    const call = updateContact.mock.calls[0][0];
    expect(call.where).toEqual({ id: CONTACT_ID });
    expect(call.data).toEqual({ name: 'Jane Smith' });
  });

  test('null clears an optional column', async () => {
    await PATCH(makeRequest({ clientId: null }), ctx());
    const call = updateContact.mock.calls[0][0];
    expect(call.data).toEqual({ clientId: null });
  });
});

describe('DELETE /api/contacts/[id]', () => {
  test('no session → 401', async () => {
    getUserIdMock.mockResolvedValue(null);
    const res = await DELETE(makeRequest(), ctx());
    expect(res.status).toBe(401);
    expect(deleteContact).not.toHaveBeenCalled();
  });

  test('not in caller org → 404, no delete by bare id', async () => {
    findFirstContact.mockResolvedValue(null);
    const res = await DELETE(makeRequest(), ctx());
    expect(res.status).toBe(404);
    expect(deleteContact).not.toHaveBeenCalled();
  });

  test('found → 200 and deletes by id', async () => {
    const res = await DELETE(makeRequest(), ctx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(deleteContact).toHaveBeenCalledWith({ where: { id: CONTACT_ID } });
  });
});
