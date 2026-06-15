/**
 * Unit tests for GET /api/dashboard/roi — proves the ROI card `trend`
 * values are computed from real period-over-period data already loaded
 * (roiRows), not hardcoded 0.
 *
 * Wiring under test:
 *   app/api/dashboard/roi/route.ts — Total Revenue / Total Investment / ROI
 *   trends now derive from the latest two distinct periods in roiRows.
 */
import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockRoiFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { roiMetric: { findMany: (...a: unknown[]) => mockRoiFindMany(...a) } },
  prisma: { roiMetric: { findMany: (...a: unknown[]) => mockRoiFindMany(...a) } },
}));

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

import { GET } from '@/app/api/dashboard/roi/route';

function request() {
  return createMockNextRequest({ url: 'http://localhost/api/dashboard/roi' });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('user-1');
});

describe('GET /api/dashboard/roi — real trend wiring', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await GET(request());
    expect(res.status).toBe(401);
  });

  it('computes non-zero trends from period-over-period roiRows (not hardcoded 0)', async () => {
    // Ordered period desc: latest period 2026-02 vs prior 2026-01.
    // Revenue: 1500 vs 1000 => +50%. Investment: 600 vs 500 => +20%.
    // ROI latest: (1500-600)/600 = 150%. ROI prior: (1000-500)/500 = 100%.
    // ROI trend = 150 - 100 = +50 points.
    mockRoiFindMany.mockResolvedValue([
      { platform: 'instagram', investment: 400, return: 900, period: '2026-02' },
      { platform: 'linkedin', investment: 200, return: 600, period: '2026-02' },
      { platform: 'instagram', investment: 500, return: 1000, period: '2026-01' },
    ]);

    const res = await GET(request());
    expect(res.status).toBe(200);
    const body = await res.json();

    const byLabel = Object.fromEntries(
      body.metrics.map((m: { label: string; trend: number }) => [m.label, m.trend])
    );

    expect(byLabel['Total Revenue']).toBe(50);
    expect(byLabel['Total Investment']).toBe(20);
    expect(byLabel['ROI']).toBe(50);

    // Guard against regression to the old hardcoded behaviour.
    expect(
      body.metrics.every((m: { trend: number }) => m.trend === 0)
    ).toBe(false);
  });

  it('returns honest 0 trends when only a single period exists (no prior to compare)', async () => {
    mockRoiFindMany.mockResolvedValue([
      { platform: 'instagram', investment: 500, return: 1000, period: '2026-02' },
    ]);

    const res = await GET(request());
    const body = await res.json();
    for (const m of body.metrics) {
      expect(m.trend).toBe(0);
    }
  });
});
