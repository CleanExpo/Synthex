/**
 * Cross-user authorization regression tests — /api/quotes/[id].
 *
 * Locks in the IDOR fix (UNI-558): a caller who is authenticated but is NOT the
 * quote owner must never read, mutate, or delete another user's PRIVATE quote.
 * The handler deliberately returns 404 (not 403) on cross-user access to avoid
 * leaking resource existence — these tests assert that contract on every method
 * and prove the side-effect (update/delete) never runs.
 *
 * Mirrors the SYN-996/997 comments-authz pattern: REAL handler, mocked Prisma,
 * different-user caller. Pure handler behaviour — no network, no DB.
 */

// ── next/server mock ──────────────────────────────────────────────────────────

jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    private _body: string;

    constructor(body: string, init: { status?: number } = {}) {
      this._body = body;
      this.status = init.status ?? 200;
    }

    json() {
      return Promise.resolve(JSON.parse(this._body));
    }

    static json(data: unknown, init: { status?: number } = {}) {
      return new MockNextResponse(JSON.stringify(data), init);
    }
  }

  return {
    NextResponse: MockNextResponse,
    NextRequest: class extends Request {},
  };
});

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mockQuoteFindUnique = jest.fn();
const mockQuoteUpdate = jest.fn();
const mockQuoteDelete = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    quote: {
      findUnique: (...a: unknown[]) => mockQuoteFindUnique(...a),
      update: (...a: unknown[]) => mockQuoteUpdate(...a),
      delete: (...a: unknown[]) => mockQuoteDelete(...a),
    },
  },
}));

// ── Security checker mock ──────────────────────────────────────────────────────

const mockSecurityCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...a: unknown[]) => mockSecurityCheck(...a),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: { requireAuth: true, allowRead: true },
    AUTHENTICATED_WRITE: { requireAuth: true, allowWrite: true },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { GET, PUT, DELETE, PATCH } from '@/app/api/quotes/[id]/route';

const OWNER = 'user-owner';
const ATTACKER = 'user-attacker';

function req(body?: unknown): any {
  return {
    json: async () => body,
    headers: { get: () => null },
    cookies: { get: () => undefined },
  };
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

const privateQuote = {
  id: 'q-private',
  userId: OWNER,
  isPublic: false,
  expiresAt: null,
  text: 'Owner-only quote',
  usageCount: 0,
  likeCount: 0,
  shareCount: 0,
};

const publicQuote = {
  id: 'q-public',
  userId: OWNER,
  isPublic: true,
  expiresAt: null,
  text: 'Anyone can read this',
  usageCount: 0,
};

describe('/api/quotes/[id] — cross-user authorization (IDOR regression, UNI-558)', () => {
  beforeEach(() => {
    mockQuoteUpdate.mockResolvedValue({
      id: 'q-private',
      likeCount: 1,
      shareCount: 0,
      usageCount: 1,
    });
    mockQuoteDelete.mockResolvedValue({});
    // Default: authenticated as the ATTACKER (a different, valid user).
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: ATTACKER },
    });
  });

  describe('GET', () => {
    it('returns 404 (not the data) when a different user reads a private quote', async () => {
      mockQuoteFindUnique.mockResolvedValue(privateQuote);

      const res = await GET(req(), ctx('q-private'));

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Quote not found');
      // Must NOT leak the private text and must NOT bump usage for a denied read.
      expect(json.data).toBeUndefined();
      expect(mockQuoteUpdate).not.toHaveBeenCalled();
    });

    it('allows the OWNER to read their own private quote (proves 404 is ownership-specific)', async () => {
      mockQuoteFindUnique.mockResolvedValue(privateQuote);
      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: OWNER },
      });

      const res = await GET(req(), ctx('q-private'));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('q-private');
    });

    it('allows any authenticated user to read a PUBLIC quote (gate is private-only)', async () => {
      mockQuoteFindUnique.mockResolvedValue(publicQuote);

      const res = await GET(req(), ctx('q-public'));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('q-public');
    });
  });

  describe('PUT', () => {
    it('returns 404 and does not update when a different user edits the quote', async () => {
      mockQuoteFindUnique.mockResolvedValue(privateQuote);

      const res = await PUT(req({ text: 'hijacked' }), ctx('q-private'));

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('Quote not found');
      expect(mockQuoteUpdate).not.toHaveBeenCalled();
    });
  });

  describe('DELETE', () => {
    it('returns 404 and does not delete when a different user deletes the quote', async () => {
      mockQuoteFindUnique.mockResolvedValue(privateQuote);

      const res = await DELETE(req(), ctx('q-private'));

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('Quote not found');
      expect(mockQuoteDelete).not.toHaveBeenCalled();
    });
  });

  describe('PATCH', () => {
    it('returns 404 and does not mutate engagement metrics for a different user', async () => {
      mockQuoteFindUnique.mockResolvedValue(privateQuote);

      const res = await PATCH(req({ action: 'like' }), ctx('q-private'));

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('Quote not found');
      expect(mockQuoteUpdate).not.toHaveBeenCalled();
    });

    it('allows the OWNER to record an engagement action on their own quote', async () => {
      mockQuoteFindUnique.mockResolvedValue(privateQuote);
      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: OWNER },
      });

      const res = await PATCH(req({ action: 'like' }), ctx('q-private'));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockQuoteUpdate).toHaveBeenCalledTimes(1);
    });
  });
});
