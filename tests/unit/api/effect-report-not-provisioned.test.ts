/**
 * Unit tests — Effect Report + GEO score routes are honestly NOT PROVISIONED.
 *
 * `effect_reports` and `client_geo_scores` have no Prisma model, so each route
 * authenticates first (401 without a session) and then returns
 * 501 FEATURE_NOT_PROVISIONED — never a 2xx with empty data.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

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

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: jest.fn(),
}));

const mockUserFindUnique = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
  },
}));

import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
const mockGetUserId = getUserIdFromRequestOrCookies as jest.Mock;

const BASE = 'http://localhost/api';

const cases: Array<[string, string, string, string, string]> = [
  [
    'GET /effect-report/list',
    '@/app/api/effect-report/list/route',
    'GET',
    `${BASE}/effect-report/list`,
    'effect_reports',
  ],
  [
    'GET /effect-report/by-period',
    '@/app/api/effect-report/by-period/route',
    'GET',
    `${BASE}/effect-report/by-period?quarter=Q3+2026`,
    'effect_reports',
  ],
  [
    'GET /effect-report/[id]/pdf',
    '@/app/api/effect-report/[id]/pdf/route',
    'GET',
    `${BASE}/effect-report/rep-1/pdf`,
    'effect_reports',
  ],
  [
    'POST /effect-report/generate',
    '@/app/api/effect-report/generate/route',
    'POST',
    `${BASE}/effect-report/generate`,
    'effect_reports',
  ],
  [
    'GET /dashboard/geo-score',
    '@/app/api/dashboard/geo-score/route',
    'GET',
    `${BASE}/dashboard/geo-score`,
    'client_geo_scores',
  ],
];

beforeEach(() => {
  mockUserFindUnique.mockResolvedValue({
    organizationId: 'org-1',
    organization: { status: 'active' },
    teamMemberships: [],
  });
});

describe.each(cases)('%s', (_name, modulePath, method, url) => {
  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const handler = (await import(modulePath))[method];
    const res = await handler(createMockNextRequest({ url, method }) as any);
    expect(res.status).toBe(401);
  });

  it('returns 501 FEATURE_NOT_PROVISIONED after auth', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    const handler = (await import(modulePath))[method];
    const res = await handler(createMockNextRequest({ url, method }) as any);
    expect(res.status).toBe(501);
    expect(await res.json()).toMatchObject({
      error: 'FEATURE_NOT_PROVISIONED',
      message: expect.any(String),
    });
  });
});

it('read routes declare available:false with a reason naming the table', async () => {
  mockGetUserId.mockResolvedValue('user-1');
  for (const [, modulePath, method, url, table] of cases) {
    if (method !== 'GET') continue;
    const res = await (
      await import(modulePath)
    ).GET(createMockNextRequest({ url, method }) as any);
    const body = await res.json();
    expect(body.available).toBe(false);
    expect(typeof body.reason).toBe('string');
    expect(`${body.reason} ${body.source ?? ''}`).toContain(table);
  }
});

it('by-period still validates the quarter param (400) before 501', async () => {
  mockGetUserId.mockResolvedValue('user-1');
  const { GET } = await import('@/app/api/effect-report/by-period/route');
  const res = await GET(
    createMockNextRequest({ url: `${BASE}/effect-report/by-period` }) as any
  );
  expect(res.status).toBe(400);
});
