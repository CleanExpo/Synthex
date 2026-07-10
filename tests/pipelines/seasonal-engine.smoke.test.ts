/**
 * Seasonal Engine pipeline — CI smoke test (SYN-590)
 *
 * Board Session 13 failure mode this guards against:
 *   A seasonal-signals run that returns HTTP 200 but inserts a
 *   `seasonal_signals` array of length 0, or signals missing their
 *   `opportunity_name` / `peak_date`. Error monitoring never fires — the run
 *   looks healthy while client calendars get no market-opportunity slots.
 *
 * SMOKE test, not integration. External calls (nager.date holiday API, the
 * Trends/ABS adapters, Supabase runner log, Prisma) are mocked — fast and
 * deterministic.
 *
 * Pipeline endpoint: POST /api/internal/update-seasonal-signals
 *   (builds signals and upserts them into seasonal_signals).
 *
 * Test client: industry `trades`, state `NSW` — signals are stored under the
 * shared 'general' industry slug and surfaced per-industry via SQL fallback.
 * See tests/README.md.
 */

import { createMockNextRequest } from '../helpers/mock-request';

const CRON_SECRET = 'smoke-test-cron-secret';
const SEASONAL_ENDPOINT_HINT =
  'check /api/internal/update-seasonal-signals and the seasonal-signals seed';

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

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mockUpsert = jest.fn().mockResolvedValue({});
const mockFindFirst = jest.fn().mockResolvedValue(null);

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    seasonalSignal: {
      upsert: (...a: unknown[]) => mockUpsert(...a),
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
    },
  },
}));

// ── External signal adapters mock — force not-configured (deterministic) ──────
// These NEVER fabricate signals; unconfigured yields zero rows so the run
// proceeds on real holiday/school-term signals only.
// Indirection through top-level jest.fn()s (impls set in beforeEach) so the
// mocks survive the config's resetMocks:true between tests.

const mockFetchTrends = jest.fn();
const mockFetchAbs = jest.fn();

jest.mock('@/lib/seasonal/external-signal-adapters', () => ({
  fetchGoogleTrendsSignals: (...a: unknown[]) => mockFetchTrends(...a),
  fetchAbsSignals: (...a: unknown[]) => mockFetchAbs(...a),
}));

// ── Supabase mock (runner log write — non-fatal) ──────────────────────────────

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

// A national + a NSW-specific holiday so the run is representative.
const SAMPLE_HOLIDAYS = [
  { date: '2026-01-26', name: 'Australia Day', counties: null },
  { date: '2026-08-03', name: 'Bank Holiday', counties: ['AU-NSW'] },
];

describe('Seasonal Engine pipeline smoke test (SYN-590)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-key';
    delete process.env.PIPELINE_SLACK_WEBHOOK;

    mockUpsert.mockResolvedValue({});
    mockFindFirst.mockResolvedValue(null);
    mockFetchTrends.mockResolvedValue({
      configured: false,
      reason: 'test',
      signals: [],
    });
    mockFetchAbs.mockResolvedValue({
      configured: false,
      reason: 'test',
      signals: [],
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(SAMPLE_HOLIDAYS),
    } as never);
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('returns HTTP 200 and upserts a non-empty seasonal_signals set', async () => {
    const { POST } =
      await import('@/app/api/internal/update-seasonal-signals/route');
    const req = createMockNextRequest({
      method: 'POST',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await POST(req as never);

    if (res.status !== 200) {
      throw new Error(
        `Seasonal Engine smoke test FAILED: expected HTTP 200, got ${res.status} — ${SEASONAL_ENDPOINT_HINT}`
      );
    }
    const body = await res.json();
    if (!(body.upserted > 0)) {
      throw new Error(
        `Seasonal Engine smoke test FAILED: expected seasonal_signals.length > 0 ` +
          `(upserted > 0), got ${JSON.stringify(body.upserted)} — the pipeline ` +
          `returned 200 but produced no market-opportunity signals. ${SEASONAL_ENDPOINT_HINT}`
      );
    }
    expect(body.ok).toBe(true);
  });

  it('every upserted signal carries a non-null opportunity_name and a valid peak_date', async () => {
    const { POST } =
      await import('@/app/api/internal/update-seasonal-signals/route');
    const req = createMockNextRequest({
      method: 'POST',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    await POST(req as never);

    if (mockUpsert.mock.calls.length === 0) {
      throw new Error(
        `Seasonal Engine smoke test FAILED: pipeline upserted no signals — ${SEASONAL_ENDPOINT_HINT}`
      );
    }

    const signals = mockUpsert.mock.calls.map(call => call[0].create);

    for (const signal of signals) {
      // opportunity_name (opportunityLabel) — non-null, non-empty string
      const opportunityName = signal.opportunityLabel;
      if (
        typeof opportunityName !== 'string' ||
        opportunityName.trim().length === 0
      ) {
        throw new Error(
          `Seasonal Engine smoke test FAILED: expected opportunity_name to be a ` +
            `non-null string, got ${JSON.stringify(opportunityName)} — ${SEASONAL_ENDPOINT_HINT}`
        );
      }

      // peak_date (windowStart) — non-null, valid date
      const peakDate = signal.windowStart;
      const peakTime =
        peakDate instanceof Date ? peakDate.getTime() : Date.parse(peakDate);
      if (peakDate == null || Number.isNaN(peakTime)) {
        throw new Error(
          `Seasonal Engine smoke test FAILED: expected peak_date to be a non-null ` +
            `date, got ${JSON.stringify(peakDate)} — ${SEASONAL_ENDPOINT_HINT}`
        );
      }
    }

    expect(signals.length).toBeGreaterThan(0);
  });
});
