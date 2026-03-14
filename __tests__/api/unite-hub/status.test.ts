/**
 * Unit tests for GET /api/unite-hub/status and POST /api/unite-hub/status
 *
 * Mock strategy:
 * - @/lib/auth/jwt-utils: getUserIdFromRequestOrCookies returns a known userId or null
 * - @/lib/prisma: prisma.user.findUnique returns owner or non-owner email
 * - global fetch: mocked for outbound HEAD/POST calls to Unite-Hub
 * - process.env.UNITE_HUB_API_URL and UNITE_HUB_API_KEY: set per test group
 *
 * The route captures env vars at module load time via module-level constants,
 * so each describe group calls jest.resetModules() and requires the route
 * fresh with the desired env vars already set.
 *
 * All jest.mock() calls are hoisted by ts-jest and therefore execute before
 * any imports.  The mock factories capture module-level jest.fn() refs through
 * the variable objects defined before the factory closures are invoked.
 */

// ── Shared mock objects — these are created once and reused across all tests ──
// The mock factories below close over these objects so every require() of the
// mocked modules returns the same jest.fn() instances.

const mockJwtUtils = {
  getUserIdFromRequestOrCookies: jest.fn<() => Promise<string | null>, []>(),
  unauthorizedResponse: jest.fn(),
  forbiddenResponse: jest.fn(),
  isOwnerEmail: jest.fn<(email: string | null | undefined) => boolean, [string | null | undefined]>(),
};

const mockPrismaUser = {
  findUnique: jest.fn(),
};

const mockLogger = {
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
};

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock('@/lib/auth/jwt-utils', () => mockJwtUtils);
jest.mock('@/lib/prisma', () => ({ prisma: { user: mockPrismaUser } }));
jest.mock('@/lib/logger', () => ({ logger: mockLogger }));

// Mock next/server so NextResponse.json() works in jsdom and—critically—so that
// the NextResponse used by the route is the same constructor that our
// unauthorizedResponse / forbiddenResponse helpers return instances of.
// We derive a named class so instanceof checks resolve correctly.
jest.mock('next/server', () => {
  class NextResponse extends Response {
    static json(body: unknown, init?: ResponseInit): NextResponse {
      const serialised = JSON.stringify(body);
      const status = (init && init.status) ? init.status : 200;
      const headers = new Headers({ 'content-type': 'application/json' });
      if (init && init.headers) {
        const extra = init.headers as Record<string, string>;
        Object.entries(extra).forEach(([k, v]) => headers.set(k, v));
      }
      return new NextResponse(serialised, { status, headers });
    }
  }

  // Wire up the auth helpers to return NextResponse instances so that the
  // route's `authResult instanceof NextResponse` check works correctly.
  mockJwtUtils.unauthorizedResponse.mockImplementation(() =>
    NextResponse.json({ error: 'Unauthorized', message: 'Authentication required' }, { status: 401 })
  );
  mockJwtUtils.forbiddenResponse.mockImplementation(() =>
    NextResponse.json({ error: 'Forbidden', message: 'Access denied' }, { status: 403 })
  );

  return {
    NextResponse,
    NextRequest: class NextRequest extends Request {},
  };
});

// ── Test constants ────────────────────────────────────────────────────────────

const OWNER_EMAIL = 'phill.mcgurk@gmail.com';
const NON_OWNER_EMAIL = 'other@example.com';
const OWNER_USER_ID = 'user-owner-001';
const NON_OWNER_USER_ID = 'user-other-002';

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Minimal request-like object accepted by the route handler. */
function makeRequest(method: 'GET' | 'POST' = 'GET'): Request {
  return {
    method,
    url: 'https://synthex.social/api/unite-hub/status',
    headers: {
      get: (name: string): string | null => {
        const map: Record<string, string | null> = {
          'x-forwarded-host': null,
          host: 'synthex.social',
        };
        return map[name.toLowerCase()] ?? null;
      },
    },
  } as unknown as Request;
}

/** Parse JSON body from a Response object. */
async function parseJson(response: Response): Promise<Record<string, unknown>> {
  return JSON.parse(await response.text()) as Record<string, unknown>;
}

/**
 * Load the route module with the given env vars in effect.
 *
 * Calls jest.resetModules() so the module-level constants (UNITE_HUB_URL,
 * UNITE_HUB_KEY) inside the route are re-evaluated against the supplied env.
 */
function loadRoute(env: { UNITE_HUB_API_URL?: string; UNITE_HUB_API_KEY?: string } = {}): {
  GET: (req: Request) => Promise<Response>;
  POST: (req: Request) => Promise<Response>;
} {
  if (env.UNITE_HUB_API_URL !== undefined) {
    process.env.UNITE_HUB_API_URL = env.UNITE_HUB_API_URL;
  } else {
    delete process.env.UNITE_HUB_API_URL;
  }
  if (env.UNITE_HUB_API_KEY !== undefined) {
    process.env.UNITE_HUB_API_KEY = env.UNITE_HUB_API_KEY;
  } else {
    delete process.env.UNITE_HUB_API_KEY;
  }

  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@/app/api/unite-hub/status/route') as {
    GET: (req: Request) => Promise<Response>;
    POST: (req: Request) => Promise<Response>;
  };
}

// ── Tests: GET /api/unite-hub/status ─────────────────────────────────────────

describe('GET /api/unite-hub/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Test 1: unauthenticated ────────────────────────────────────────────────

  describe('when request has no auth token', () => {
    it('returns 401 Unauthorized', async () => {
      mockJwtUtils.getUserIdFromRequestOrCookies.mockResolvedValue(null);

      const { GET } = loadRoute();
      const response = await GET(makeRequest('GET'));

      expect(response.status).toBe(401);
      const body = await parseJson(response);
      expect(body).toMatchObject({ error: 'Unauthorized' });
      expect(mockPrismaUser.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── Test 2: authenticated but not owner ───────────────────────────────────

  describe('when user is authenticated but does not have owner email', () => {
    it('returns 403 Forbidden', async () => {
      mockJwtUtils.getUserIdFromRequestOrCookies.mockResolvedValue(NON_OWNER_USER_ID);
      mockPrismaUser.findUnique.mockResolvedValue({ email: NON_OWNER_EMAIL });
      mockJwtUtils.isOwnerEmail.mockReturnValue(false);

      const { GET } = loadRoute();
      const response = await GET(makeRequest('GET'));

      expect(response.status).toBe(403);
      const body = await parseJson(response);
      expect(body).toMatchObject({ error: 'Forbidden' });
    });
  });

  // ── Test 3: owner, env vars missing ───────────────────────────────────────

  describe('when owner is authenticated but env vars are not set', () => {
    it('returns { configured: false, reachable: false, domain: null }', async () => {
      mockJwtUtils.getUserIdFromRequestOrCookies.mockResolvedValue(OWNER_USER_ID);
      mockPrismaUser.findUnique.mockResolvedValue({ email: OWNER_EMAIL });
      mockJwtUtils.isOwnerEmail.mockReturnValue(true);
      const fetchSpy = jest.fn();
      global.fetch = fetchSpy;

      const { GET } = loadRoute(); // no env vars
      const response = await GET(makeRequest('GET'));

      expect(response.status).toBe(200);
      const body = await parseJson(response);
      expect(body.configured).toBe(false);
      expect(body.reachable).toBe(false);
      expect(body.domain).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // ── Test 4: owner, env vars set, HEAD ping succeeds ───────────────────────

  describe('when owner is authenticated, env vars are set, and HEAD ping succeeds', () => {
    it('returns { configured: true, reachable: true, domain: string }', async () => {
      mockJwtUtils.getUserIdFromRequestOrCookies.mockResolvedValue(OWNER_USER_ID);
      mockPrismaUser.findUnique.mockResolvedValue({ email: OWNER_EMAIL });
      mockJwtUtils.isOwnerEmail.mockReturnValue(true);

      // Any HTTP response (status > 0) means reachable
      global.fetch = jest.fn().mockResolvedValue({ status: 200 });

      const { GET } = loadRoute({
        UNITE_HUB_API_URL: 'https://nexus.unite.group',
        UNITE_HUB_API_KEY: 'test-api-key-abc123',
      });
      const response = await GET(makeRequest('GET'));

      expect(response.status).toBe(200);
      const body = await parseJson(response);
      expect(body.configured).toBe(true);
      expect(body.reachable).toBe(true);
      expect(typeof body.domain).toBe('string');
      expect(body.domain).toBe('nexus.unite.group');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://nexus.unite.group/api/events',
        expect.objectContaining({
          method: 'HEAD',
          headers: expect.objectContaining({ 'x-api-key': 'test-api-key-abc123' }),
        })
      );
    });
  });

  // ── Test 5: owner, env vars set, HEAD ping times out ─────────────────────

  describe('when owner is authenticated, env vars are set, but HEAD ping times out', () => {
    it('returns { configured: true, reachable: false }', async () => {
      mockJwtUtils.getUserIdFromRequestOrCookies.mockResolvedValue(OWNER_USER_ID);
      mockPrismaUser.findUnique.mockResolvedValue({ email: OWNER_EMAIL });
      mockJwtUtils.isOwnerEmail.mockReturnValue(true);

      const abortError = Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
      global.fetch = jest.fn().mockRejectedValue(abortError);

      const { GET } = loadRoute({
        UNITE_HUB_API_URL: 'https://nexus.unite.group',
        UNITE_HUB_API_KEY: 'test-api-key-abc123',
      });
      const response = await GET(makeRequest('GET'));

      expect(response.status).toBe(200);
      const body = await parseJson(response);
      expect(body.configured).toBe(true);
      expect(body.reachable).toBe(false);
    });
  });
});

// ── Tests: POST /api/unite-hub/status ────────────────────────────────────────

describe('POST /api/unite-hub/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Test 6: owner, not configured ─────────────────────────────────────────

  describe('when owner is authenticated but Unite-Hub is not configured', () => {
    it('returns { success: false } with status 400', async () => {
      mockJwtUtils.getUserIdFromRequestOrCookies.mockResolvedValue(OWNER_USER_ID);
      mockPrismaUser.findUnique.mockResolvedValue({ email: OWNER_EMAIL });
      mockJwtUtils.isOwnerEmail.mockReturnValue(true);

      const { POST } = loadRoute(); // no env vars
      const response = await POST(makeRequest('POST'));

      expect(response.status).toBe(400);
      const body = await parseJson(response);
      expect(body.success).toBe(false);
      expect(typeof body.error).toBe('string');
    });
  });

  // ── Test 7: owner, configured, event POST succeeds ────────────────────────

  describe('when owner is authenticated, configured, and event POST succeeds', () => {
    it('returns { success: true, latencyMs: number, statusCode: number }', async () => {
      mockJwtUtils.getUserIdFromRequestOrCookies.mockResolvedValue(OWNER_USER_ID);
      mockPrismaUser.findUnique.mockResolvedValue({ email: OWNER_EMAIL });
      mockJwtUtils.isOwnerEmail.mockReturnValue(true);

      // status < 500 is treated as success
      global.fetch = jest.fn().mockResolvedValue({ status: 200 });

      const { POST } = loadRoute({
        UNITE_HUB_API_URL: 'https://nexus.unite.group',
        UNITE_HUB_API_KEY: 'test-api-key-abc123',
      });
      const response = await POST(makeRequest('POST'));

      expect(response.status).toBe(200);
      const body = await parseJson(response);
      expect(body.success).toBe(true);
      expect(typeof body.latencyMs).toBe('number');
      expect(body.latencyMs).toBeGreaterThanOrEqual(0);
      expect(typeof body.statusCode).toBe('number');
      expect(body.statusCode).toBe(200);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://nexus.unite.group/api/events',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': 'test-api-key-abc123',
          }),
          body: expect.stringContaining('"type":"synthex.ping"'),
        })
      );
    });
  });

  // ── Test 8: owner, configured, event POST times out ──────────────────────

  describe('when owner is authenticated, configured, but event POST times out', () => {
    it('returns { success: false, error: string }', async () => {
      mockJwtUtils.getUserIdFromRequestOrCookies.mockResolvedValue(OWNER_USER_ID);
      mockPrismaUser.findUnique.mockResolvedValue({ email: OWNER_EMAIL });
      mockJwtUtils.isOwnerEmail.mockReturnValue(true);

      // Simulate AbortError from the 5-second timeout controller
      const abortError = Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
      global.fetch = jest.fn().mockRejectedValue(abortError);

      const { POST } = loadRoute({
        UNITE_HUB_API_URL: 'https://nexus.unite.group',
        UNITE_HUB_API_KEY: 'test-api-key-abc123',
      });
      const response = await POST(makeRequest('POST'));

      // Route returns HTTP 200 with success: false for network errors
      expect(response.status).toBe(200);
      const body = await parseJson(response);
      expect(body.success).toBe(false);
      expect(typeof body.error).toBe('string');
      // Route message for AbortError is 'Connection timed out after 5s'
      expect((body.error as string).toLowerCase()).toContain('timed out');
    });
  });
});
