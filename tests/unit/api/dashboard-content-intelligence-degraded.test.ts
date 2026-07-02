/**
 * SYN-1004 slice 2 — the content-intelligence dashboard GET must not mask a DB
 * outage as a clean 200. On a Prisma failure it now returns 503 + degraded:true
 * (still carrying empty data so the SWR card degrades gracefully), and logs the
 * error.
 */
const findUniqueProfile = jest.fn();
const findManyTracking = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    contentPerformanceProfile: { findUnique: (...a: unknown[]) => findUniqueProfile(...a) },
    contentImprovementTracking: { findMany: (...a: unknown[]) => findManyTracking(...a) },
  },
}));

const getUserIdMock = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => getUserIdMock(...a),
}));

const getEffectiveOrgMock = jest.fn();
jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...a: unknown[]) => getEffectiveOrgMock(...a),
}));

const loggerErrorMock = jest.fn();
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: (...a: unknown[]) => loggerErrorMock(...a) },
}));

import { GET } from '@/app/api/dashboard/content-intelligence/route';

const req = {} as unknown as Parameters<typeof GET>[0];

beforeEach(() => {
  jest.clearAllMocks();
  getUserIdMock.mockResolvedValue('user-1');
  getEffectiveOrgMock.mockResolvedValue('org-1');
});

describe('GET /api/dashboard/content-intelligence — outage visibility', () => {
  it('returns 503 + degraded:true (not a clean 200) when the DB query throws', async () => {
    findUniqueProfile.mockRejectedValue(new Error('db down'));
    findManyTracking.mockRejectedValue(new Error('db down'));

    const res = await GET(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.degraded).toBe(true);
    expect(body.success).toBe(false);
    // Still carries empty data so the SWR card degrades gracefully.
    expect(body.data).toMatchObject({ hasData: false });
    expect(loggerErrorMock).toHaveBeenCalled();
  });

  it('still returns a healthy 200 with data on success', async () => {
    findUniqueProfile.mockResolvedValue({
      confidenceLevel: 0.8,
      topTopics: [],
      postCount: 12,
      industryBaseline: { industry: 'restoration' },
    });
    findManyTracking.mockResolvedValue([]);

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.hasData).toBe(true);
    expect(body.degraded).toBeUndefined();
  });
});
