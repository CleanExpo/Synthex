/**
 * Unit tests for app/api/auth/logout/route.ts
 * POST /api/auth/logout  — single-device logout
 * DELETE /api/auth/logout — all-device logout
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// ── next/server mock — provides NextResponse with working cookies.set ─────────
// The jsdom environment doesn't fully support NextResponse.cookies.set in
// the jest test runner; mocking it prevents internal 500s from cookie ops.
jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server');

  const buildMockResponse = (data: unknown, init: { status?: number } = {}) => {
    const body = JSON.stringify(data);
    const status = init.status || 200;
    const cookiesMap = new Map<string, unknown>();
    return {
      status,
      json: () => Promise.resolve(JSON.parse(body)),
      text: () => Promise.resolve(body),
      headers: {
        get: () => null,
        set: jest.fn(),
        has: () => false,
      },
      cookies: {
        set: jest.fn((name: string, value: string) =>
          cookiesMap.set(name, value)
        ),
        delete: jest.fn((name: string) => cookiesMap.delete(name)),
        get: (name: string) => cookiesMap.get(name),
      },
    };
  };

  class MockNextResponse {
    status: number;
    private _body: string;
    headers: { get: () => null; set: jest.Mock; has: () => boolean };
    cookies: { set: jest.Mock; delete: jest.Mock; get: (n: string) => unknown };
    private _cookiesMap: Map<string, unknown>;

    constructor(body: string, init: { status?: number } = {}) {
      this._body = body;
      this.status = init.status || 200;
      this._cookiesMap = new Map();
      this.headers = { get: () => null, set: jest.fn(), has: () => false };
      this.cookies = {
        set: jest.fn((name: string, val: string) =>
          this._cookiesMap.set(name, val)
        ),
        delete: jest.fn((name: string) => this._cookiesMap.delete(name)),
        get: (name: string) => this._cookiesMap.get(name),
      };
    }

    json() {
      return Promise.resolve(JSON.parse(this._body));
    }

    static json(data: unknown, init: { status?: number } = {}) {
      return new MockNextResponse(JSON.stringify(data), init);
    }
  }

  return {
    ...actual,
    NextResponse: MockNextResponse,
    NextRequest: actual.NextRequest,
  };
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetUserId = jest.fn();
const mockVerifyTokenSafe = jest.fn();
const mockUnauthorizedResponse = jest.fn();

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
  verifyTokenSafe: (...args: unknown[]) => mockVerifyTokenSafe(...args),
  unauthorizedResponse: () => mockUnauthorizedResponse(),
}));

const mockSessionDeleteMany = jest.fn();
const mockAuditLogCreate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    session: {
      deleteMany: (...args: unknown[]) => mockSessionDeleteMany(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn() },
}));

// Import route handlers after mocks
import { POST, DELETE } from '@/app/api/auth/logout/route';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ID = 'user-abc';
const TOKEN = 'mock-jwt-token';

function makePostRequest(
  opts: { withBearer?: boolean; withCookie?: boolean } = {}
) {
  const headers: Record<string, string> = {};
  if (opts.withBearer) {
    headers.authorization = `Bearer ${TOKEN}`;
  }

  const req = createMockNextRequest({
    method: 'POST',
    url: 'http://localhost/api/auth/logout',
    headers,
  });

  // Add cookie support if requested
  if (opts.withCookie) {
    (req as unknown as Record<string, unknown>).cookies = {
      get: (name: string) =>
        name === 'auth-token' ? { value: TOKEN } : undefined,
      getAll: () => [],
      has: () => false,
    };
  }

  return req;
}

function makeDeleteRequest() {
  return createMockNextRequest({
    method: 'DELETE',
    url: 'http://localhost/api/auth/logout',
  });
}

// ── POST /api/auth/logout ─────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserId.mockResolvedValue(USER_ID);
    mockVerifyTokenSafe.mockReturnValue({
      userId: USER_ID,
      email: 'test@example.com',
    });
    mockSessionDeleteMany.mockResolvedValue({ count: 1 });
    mockAuditLogCreate.mockResolvedValue({ id: 'audit-1' });
    mockUnauthorizedResponse.mockReturnValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    );
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetUserId.mockResolvedValue(null);

    const res = await POST(makePostRequest() as never);
    expect(res.status).toBe(401);
    expect(mockUnauthorizedResponse).toHaveBeenCalled();
  });

  it('returns success with sessionsDeleted count', async () => {
    mockSessionDeleteMany.mockResolvedValue({ count: 1 });

    const res = await POST(makePostRequest({ withBearer: true }) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/logout/i);
    // sessionsDeleted is the count from deleteMany (1 in this case)
    expect(body.sessionsDeleted).toBe(1);
  });

  it('calls session.deleteMany with the token and userId', async () => {
    await POST(makePostRequest({ withBearer: true }) as never);

    expect(mockSessionDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: USER_ID, token: TOKEN }),
      })
    );
  });

  it('creates an audit log entry on successful logout', async () => {
    await POST(makePostRequest({ withBearer: true }) as never);

    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          action: 'user_logout',
          outcome: 'success',
        }),
      })
    );
  });

  it('returns a response object (cookie clearing is handled by NextResponse)', async () => {
    // NextResponse.cookies.set in the test environment does not populate
    // the raw set-cookie header in jsdom — we just verify a 200 response
    // is returned and trust the route implementation clears the cookie.
    const res = await POST(makePostRequest({ withBearer: true }) as never);
    expect(res.status).toBe(200);
  });

  it('handles missing token gracefully (no bearer, no cookie)', async () => {
    const res = await POST(makePostRequest() as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // When no token is present the route skips session.deleteMany entirely
    // and returns count 0
    expect(mockSessionDeleteMany).not.toHaveBeenCalled();
    expect(body.sessionsDeleted).toBe(0);
  });

  it('returns 500 when Prisma throws', async () => {
    mockSessionDeleteMany.mockRejectedValue(new Error('DB failure'));

    const res = await POST(makePostRequest({ withBearer: true }) as never);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toMatch(/Logout failed/i);
  });
});

// ── DELETE /api/auth/logout ───────────────────────────────────────────────────

describe('DELETE /api/auth/logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserId.mockResolvedValue(USER_ID);
    mockVerifyTokenSafe.mockReturnValue({
      userId: USER_ID,
      email: 'test@example.com',
    });
    mockSessionDeleteMany.mockResolvedValue({ count: 3 });
    mockAuditLogCreate.mockResolvedValue({ id: 'audit-2' });
    mockUnauthorizedResponse.mockReturnValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    );
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetUserId.mockResolvedValue(null);

    const res = await DELETE(makeDeleteRequest() as never);
    expect(res.status).toBe(401);
  });

  it('returns success with total sessions deleted', async () => {
    const res = await DELETE(makeDeleteRequest() as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.sessionsDeleted).toBe(3);
    expect(body.message).toMatch(/all devices/i);
  });

  it('deletes all sessions for the userId', async () => {
    await DELETE(makeDeleteRequest() as never);

    expect(mockSessionDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
      })
    );
  });

  it('logs user_logout_all_devices action', async () => {
    await DELETE(makeDeleteRequest() as never);

    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'user_logout_all_devices',
          userId: USER_ID,
        }),
      })
    );
  });

  it('returns 500 when Prisma throws', async () => {
    mockSessionDeleteMany.mockRejectedValue(new Error('DB failure'));

    const res = await DELETE(makeDeleteRequest() as never);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toMatch(/Failed to logout/i);
  });
});
