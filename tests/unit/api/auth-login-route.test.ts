/**
 * Unit tests for app/api/auth/login/route.ts
 * POST /api/auth/login
 *
 * Tests the actual route handler (not just schemas) with mocked dependencies.
 * Covers: validation, user-not-found, OAuth-user detection, wrong password,
 * success with cookie setting, and 500 error path.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// ── next/server mock ──────────────────────────────────────────────────────────
// NextResponse.cookies.set is not available in jsdom without this mock.
jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server');

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
  };
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGenerateToken = jest.fn().mockReturnValue('mock-jwt-token');

jest.mock('@/lib/auth/jwt-utils', () => ({
  generateToken: (...args: unknown[]) => mockGenerateToken(...args),
}));

const mockSignInWithPassword = jest.fn();
jest.mock('@/lib/supabase-client', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) =>
        mockSignInWithPassword(...args),
    },
  },
}));

const mockUserFindUnique = jest.fn();
const mockSessionDeleteMany = jest.fn();
const mockSessionCreate = jest.fn();
const mockUserUpdate = jest.fn();
const mockAuditLogCreate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    session: {
      deleteMany: (...args: unknown[]) => mockSessionDeleteMany(...args),
      create: (...args: unknown[]) => mockSessionCreate(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
  },
}));

// Rate limit: always pass through (implementation reset by resetMocks, re-applied in beforeEach)
const mockAuthStrict = jest.fn();
jest.mock('@/lib/middleware/api-rate-limit', () => ({
  authStrict: (...args: unknown[]) => mockAuthStrict(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn() },
}));

import { POST } from '@/app/api/auth/login/route';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_USER = {
  id: 'user-abc',
  email: 'test@example.com',
  name: 'Test User',
  emailVerified: true,
  authProvider: 'local',
  onboardingComplete: true,
  apiKeyConfigured: true,
};

const SUPABASE_SUCCESS = {
  data: {
    user: { id: 'supabase-uid' },
    session: {
      access_token: 'supabase-access-token',
      refresh_token: 'supabase-refresh-token',
    },
  },
  error: null,
};

function makePostRequest(body: object) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost/api/auth/login',
    body,
    headers: { 'content-type': 'application/json' },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Re-implement rate-limit pass-through after resetMocks clears it
    mockAuthStrict.mockImplementation(
      async (_req: unknown, handler: () => unknown) => handler()
    );
    // Re-implement generateToken after reset
    mockGenerateToken.mockReturnValue('mock-jwt-token');

    mockUserFindUnique.mockResolvedValue(VALID_USER);
    mockSignInWithPassword.mockResolvedValue(SUPABASE_SUCCESS);
    mockSessionDeleteMany.mockResolvedValue({ count: 1 });
    mockSessionCreate.mockResolvedValue({
      id: 'session-1',
      token: 'mock-jwt-token',
    });
    mockUserUpdate.mockResolvedValue({ ...VALID_USER, lastLogin: new Date() });
    mockAuditLogCreate.mockResolvedValue({ id: 'audit-1' });
  });

  // ── Validation ────────────────────────────────────────────────────────────
  describe('request validation', () => {
    it('returns 400 when email is missing', async () => {
      const res = await POST(makePostRequest({ password: 'pass' }) as never);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toMatch(/Invalid request data/i);
    });

    it('returns 400 when password is missing', async () => {
      const res = await POST(makePostRequest({ email: 'a@b.com' }) as never);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toMatch(/Invalid request data/i);
    });

    it('returns 400 when email format is invalid', async () => {
      const res = await POST(
        makePostRequest({ email: 'not-an-email', password: 'pass' }) as never
      );
      const body = await res.json();

      expect(res.status).toBe(400);
    });

    it('returns 400 when body is empty', async () => {
      const res = await POST(makePostRequest({}) as never);
      expect(res.status).toBe(400);
    });
  });

  // ── User not found ────────────────────────────────────────────────────────
  describe('user not found', () => {
    it('returns 401 when user does not exist', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      const res = await POST(
        makePostRequest({
          email: 'nobody@example.com',
          password: 'pass',
        }) as never
      );
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error).toMatch(/Invalid email or password/i);
    });
  });

  // ── OAuth user detection ──────────────────────────────────────────────────
  describe('OAuth user detection', () => {
    it('returns 400 when user registered with Google OAuth', async () => {
      mockUserFindUnique.mockResolvedValue({
        ...VALID_USER,
        authProvider: 'google',
      });

      const res = await POST(
        makePostRequest({
          email: 'google@example.com',
          password: 'pass',
        }) as never
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toMatch(/google/i);
    });

    it('returns 400 when user registered with GitHub OAuth', async () => {
      mockUserFindUnique.mockResolvedValue({
        ...VALID_USER,
        authProvider: 'github',
      });

      const res = await POST(
        makePostRequest({ email: 'gh@example.com', password: 'pass' }) as never
      );
      const body = await res.json();

      expect(res.status).toBe(400);
    });

    it('allows login for local auth provider', async () => {
      // Passes through to Supabase auth check
      const res = await POST(
        makePostRequest({
          email: 'local@example.com',
          password: 'pass',
        }) as never
      );

      // Should not return 400 (method check passed)
      expect(res.status).not.toBe(400);
    });

    it('allows login when authProvider is email', async () => {
      mockUserFindUnique.mockResolvedValue({
        ...VALID_USER,
        authProvider: 'email',
      });

      const res = await POST(
        makePostRequest({
          email: 'email@example.com',
          password: 'pass',
        }) as never
      );

      expect(res.status).not.toBe(400);
    });
  });

  // ── Wrong password ────────────────────────────────────────────────────────
  describe('wrong password', () => {
    it('returns 401 when Supabase auth fails', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      const res = await POST(
        makePostRequest({
          email: 'test@example.com',
          password: 'wrong',
        }) as never
      );
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error).toMatch(/Invalid email or password/i);
    });

    it('logs a failed login audit event on wrong password', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Wrong password' },
      });

      await POST(
        makePostRequest({
          email: 'test@example.com',
          password: 'wrong',
        }) as never
      );

      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'login_failed',
            outcome: 'failure',
          }),
        })
      );
    });
  });

  // ── Successful login ──────────────────────────────────────────────────────
  describe('successful login', () => {
    it('returns 200 with user info and token', async () => {
      const res = await POST(
        makePostRequest({
          email: 'test@example.com',
          password: 'CorrectPass1',
        }) as never
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.token).toBe('mock-jwt-token');
      expect(body.user.id).toBe(VALID_USER.id);
      expect(body.user.email).toBe(VALID_USER.email);
    });

    it('does NOT expose authProvider in the response user object', async () => {
      const res = await POST(
        makePostRequest({
          email: 'test@example.com',
          password: 'CorrectPass1',
        }) as never
      );
      const body = await res.json();

      expect(body.user).not.toHaveProperty('authProvider');
    });

    it('calls generateToken with userId and email', async () => {
      await POST(
        makePostRequest({
          email: 'test@example.com',
          password: 'CorrectPass1',
        }) as never
      );

      expect(mockGenerateToken).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: VALID_USER.id,
          email: VALID_USER.email,
        })
      );
    });

    it('deletes old sessions then creates a new session', async () => {
      await POST(
        makePostRequest({
          email: 'test@example.com',
          password: 'CorrectPass1',
        }) as never
      );

      expect(mockSessionDeleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: VALID_USER.id } })
      );
      expect(mockSessionCreate).toHaveBeenCalled();
    });

    it('updates the lastLogin timestamp', async () => {
      await POST(
        makePostRequest({
          email: 'test@example.com',
          password: 'CorrectPass1',
        }) as never
      );

      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: VALID_USER.id },
          data: expect.objectContaining({ lastLogin: expect.any(Date) }),
        })
      );
    });

    it('creates a successful login audit log entry', async () => {
      await POST(
        makePostRequest({
          email: 'test@example.com',
          password: 'CorrectPass1',
        }) as never
      );

      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'user_login',
            outcome: 'success',
            userId: VALID_USER.id,
          }),
        })
      );
    });

    it('sets auth-token cookie in the response', async () => {
      const res = (await POST(
        makePostRequest({
          email: 'test@example.com',
          password: 'CorrectPass1',
        }) as never
      )) as unknown as { cookies: { set: jest.Mock } };

      expect(res.cookies.set).toHaveBeenCalledWith(
        'auth-token',
        'mock-jwt-token',
        expect.objectContaining({ httpOnly: true })
      );
    });
  });

  // ── Error handling ────────────────────────────────────────────────────────
  describe('error handling', () => {
    it('returns 500 when Prisma user lookup throws', async () => {
      mockUserFindUnique.mockRejectedValue(new Error('DB connection failed'));

      const res = await POST(
        makePostRequest({
          email: 'test@example.com',
          password: 'pass',
        }) as never
      );
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toMatch(/Login failed/i);
    });

    it('returns 500 when session creation throws', async () => {
      mockSessionCreate.mockRejectedValue(new Error('Session write failed'));

      const res = await POST(
        makePostRequest({
          email: 'test@example.com',
          password: 'pass',
        }) as never
      );
      const body = await res.json();

      expect(res.status).toBe(500);
    });
  });
});
