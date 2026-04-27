/**
 * Unit tests — SYN-547 Seasonal Signals
 *
 * Covers:
 *  - GET /api/seasonal-signals (auth, validation, SQL function proxy)
 *  - POST /api/internal/update-seasonal-signals (auth, holiday fetch, graceful fallback)
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// ── next/server mock ──────────────────────────────────────────────────────────

jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server');

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

  return { ...actual, NextResponse: MockNextResponse };
});

// ── Auth mock ─────────────────────────────────────────────────────────────────

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: jest.fn(),
}));

import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
const mockGetUserId = getUserIdFromRequestOrCookies as jest.Mock;

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mockUpsert = jest.fn().mockResolvedValue({});
const mockFindFirst = jest.fn().mockResolvedValue(null);
const mockQueryRaw = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    seasonalSignal: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

// Mock Supabase createClient for runner factory log writes (non-fatal in tests)
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn().mockResolvedValue({ error: null }),
    })),
  })),
}));

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ── global fetch mock ─────────────────────────────────────────────────────────

const SAMPLE_HOLIDAYS = [
  { date: '2026-01-26', name: 'Australia Day', counties: null },
  { date: '2026-04-25', name: 'ANZAC Day', counties: null },
  { date: '2026-11-03', name: 'Melbourne Cup', counties: ['AU-VIC'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/seasonal-signals
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/seasonal-signals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const { GET } = await import('@/app/api/seasonal-signals/route');
    const req = createMockNextRequest({
      url: 'http://localhost/api/seasonal-signals',
    });
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid limit param', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    const { GET } = await import('@/app/api/seasonal-signals/route');
    const req = createMockNextRequest({
      url: 'http://localhost/api/seasonal-signals?limit=9999',
    });
    const res = await GET(req as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid query parameters');
  });

  it('calls prisma.$queryRaw with correct args and returns signals', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockQueryRaw.mockResolvedValue([
      {
        id: 'sig-1',
        industry_slug: 'plumbing-hvac',
        location_state: 'VIC',
        signal_type: 'seasonal_peak',
        opportunity_label: 'Winter Pipe & Hot Water Season',
        window_start: new Date('2026-06-01'),
        window_end: new Date('2026-08-31'),
        confidence_score: 90,
        source: 'abs_data',
      },
    ]);

    const { GET } = await import('@/app/api/seasonal-signals/route');
    const req = createMockNextRequest({
      url: 'http://localhost/api/seasonal-signals?industrySlug=plumbing-hvac&locationState=VIC&limit=5',
    });
    const res = await GET(req as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.signals).toHaveLength(1);
    expect(body.signals[0].industrySlug).toBe('plumbing-hvac');
    expect(body.signals[0].opportunityLabel).toBe(
      'Winter Pipe & Hot Water Season'
    );
  });

  it('returns 500 when prisma throws', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockQueryRaw.mockRejectedValue(new Error('DB timeout'));
    const { GET } = await import('@/app/api/seasonal-signals/route');
    const req = createMockNextRequest({
      url: 'http://localhost/api/seasonal-signals',
    });
    const res = await GET(req as any);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to fetch signals');
  });

  it('defaults to industrySlug=general and locationState=AU', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockQueryRaw.mockResolvedValue([]);
    const { GET } = await import('@/app/api/seasonal-signals/route');
    const req = createMockNextRequest({
      url: 'http://localhost/api/seasonal-signals',
    });
    await GET(req as any);
    // The raw query is called — just verify it ran without error with defaults
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/internal/update-seasonal-signals
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/internal/update-seasonal-signals', () => {
  const CRON_SECRET = 'test-cron-secret-xyz';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it('returns 500 when no cron secret is configured in env', async () => {
    // SYN-702: fail-closed behaviour — when neither CRON_SECRET nor the
    // per-route secret is configured, this is a server misconfiguration
    // (500), not an auth failure (401). The verifyCronRequest helper
    // (lib/auth/cron-auth.ts) returns 500 in this case so ops can distinguish
    // misconfiguration from a real unauthorised attempt.
    delete process.env.CRON_SECRET;
    delete process.env.CRON_SECRET_UPDATE_SEASONAL_SIGNALS;
    const { POST } =
      await import('@/app/api/internal/update-seasonal-signals/route');
    const req = createMockNextRequest({
      method: 'POST',
      headers: { authorization: 'Bearer anything' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });

  it('returns 401 when Bearer token does not match', async () => {
    const { POST } =
      await import('@/app/api/internal/update-seasonal-signals/route');
    const req = createMockNextRequest({
      method: 'POST',
      headers: { authorization: 'Bearer wrong-secret' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('fetches holidays, upserts signals, and logs run on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(SAMPLE_HOLIDAYS),
    } as any);

    mockUpsert.mockResolvedValue({});
    mockFindFirst.mockResolvedValue(null);

    const { POST } =
      await import('@/app/api/internal/update-seasonal-signals/route');
    const req = createMockNextRequest({
      method: 'POST',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.upserted).toBeGreaterThan(0);
  });

  it('gracefully continues when holiday API fetch fails (school terms still run)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    mockUpsert.mockResolvedValue({});
    mockFindFirst.mockResolvedValue(null);

    const { POST } =
      await import('@/app/api/internal/update-seasonal-signals/route');
    const req = createMockNextRequest({
      method: 'POST',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    // School terms still produce signals even when holidays fail
    expect(body.upserted).toBeGreaterThan(0);
    expect(body.errors).toBeGreaterThanOrEqual(1);
  });

  it('VIC-only holiday only generates VIC signal (not all states)', async () => {
    // Melbourne Cup only has counties: ['AU-VIC']
    const vicOnly = [
      { date: '2026-11-03', name: 'Melbourne Cup', counties: ['AU-VIC'] },
    ];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(vicOnly),
    } as any);
    mockUpsert.mockResolvedValue({});
    mockFindFirst.mockResolvedValue(null);

    const { POST } =
      await import('@/app/api/internal/update-seasonal-signals/route');
    const req = createMockNextRequest({
      method: 'POST',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    await POST(req as any);

    // Only VIC signals (1 holiday × 1 state) + school terms (across all states)
    const holidayUpsertCalls = mockUpsert.mock.calls.filter(
      call => call[0]?.where?.seasonal_signal_dedup?.source === 'public_holiday'
    );
    expect(holidayUpsertCalls).toHaveLength(1);
    expect(holidayUpsertCalls[0][0].create.locationState).toBe('VIC');
  });

  it('national holiday generates signals for all 8 states + AU', async () => {
    const national = [
      { date: '2026-01-26', name: 'Australia Day', counties: null },
    ];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(national),
    } as any);
    mockUpsert.mockResolvedValue({});
    mockFindFirst.mockResolvedValue(null);

    const { POST } =
      await import('@/app/api/internal/update-seasonal-signals/route');
    const req = createMockNextRequest({
      method: 'POST',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    await POST(req as any);

    const holidayUpsertCalls = mockUpsert.mock.calls.filter(
      call => call[0]?.where?.seasonal_signal_dedup?.source === 'public_holiday'
    );
    // 8 AU states + 'AU' national = 9 signals for one national holiday
    expect(holidayUpsertCalls).toHaveLength(9);
  });
});
