/**
 * Unit tests — SYN-1039 Authority Sources connector status (GET).
 *
 * Drives the real route handler (app/api/authority/sources/route.ts) so the
 * UI contract is exercised end-to-end:
 *  - 401 when unauthenticated.
 *  - 200 returns the connector list wrapped as `{ connectors: [...] }`, NOT a
 *    raw array. The dashboard (app/dashboard/authority/page.tsx) reads
 *    `data.connectors ?? []`, so a bare array would silently render an empty
 *    connector state even on a successful response — the bug this fix closes.
 *
 * Order: 401 (unauthenticated) → 200 happy path.
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

// ── auth mock ─────────────────────────────────────────────────────────────────

const mockGetUserIdFromRequestOrCookies = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) =>
    mockGetUserIdFromRequestOrCookies(...args),
}));

// ── connector registry mock ───────────────────────────────────────────────────

const mockGetConnectorStatus = jest.fn();
jest.mock('@/lib/authority/source-connectors/index', () => ({
  getConnectorStatus: (...args: unknown[]) => mockGetConnectorStatus(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { GET } from '@/app/api/authority/sources/route';

function makeRequest(): any {
  return {
    cookies: { get: () => ({ value: 'valid-token' }) },
    headers: { get: () => 'Bearer valid-token' },
  };
}

const fakeConnectors = [
  { id: 'gsc', name: 'Google Search Console', type: 'search', enabled: true },
  { id: 'ga4', name: 'Google Analytics 4', type: 'analytics', enabled: false },
];

describe('GET /api/authority/sources — connector status contract', () => {
  beforeEach(() => {
    mockGetUserIdFromRequestOrCookies.mockResolvedValue('user-123');
    mockGetConnectorStatus.mockReturnValue(fakeConnectors);
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUserIdFromRequestOrCookies.mockResolvedValue(null);

    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBeDefined();
    // Registry is never consulted once auth fails.
    expect(mockGetConnectorStatus).not.toHaveBeenCalled();
  });

  it('returns 200 with connectors wrapped in a `connectors` key (not a raw array)', async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const json = await res.json();

    // The contract the dashboard depends on: an object with a `connectors`
    // array, NOT a bare array. `data.connectors ?? []` must resolve to the
    // real list, never the empty fallback.
    expect(Array.isArray(json)).toBe(false);
    expect(Array.isArray(json.connectors)).toBe(true);
    expect(json.connectors).toEqual(fakeConnectors);
    expect(json.connectors).toHaveLength(2);
  });
});
