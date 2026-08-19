/**
 * ReportBuilder tenant scoping (P1 cross-tenant leak).
 *
 * Regression: platformMetrics.findMany filtered by date ONLY, so a report
 * returned every tenant's metrics. The query now carries a tenant predicate
 * derived from the authenticated scope (never request-body input).
 */
const mockFindMany = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    platformMetrics: { findMany: (...a: unknown[]) => mockFindMany(...a) },
  },
  default: {
    platformMetrics: { findMany: (...a: unknown[]) => mockFindMany(...a) },
  },
}));
jest.mock('@/lib/cache/cache-manager', () => ({
  getCache: () => ({ get: jest.fn().mockResolvedValue(null), set: jest.fn() }),
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { ReportBuilder } from '@/lib/analytics/report-builder';

function build(scope: { userId: string; organizationId?: string | null }) {
  return new ReportBuilder(scope)
    .type('overview')
    .metrics(['impressions'])
    .dateRange(new Date('2026-01-01'), new Date('2026-01-31'));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
});

describe('ReportBuilder tenant scope', () => {
  it('scopes by organization when the user belongs to one', async () => {
    await build({ userId: 'u-1', organizationId: 'org-9' }).execute();
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.post.connection).toEqual({ organizationId: 'org-9' });
  });

  it('scopes by the user own connections when there is no org', async () => {
    await build({ userId: 'u-1', organizationId: null }).execute();
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.post.connection).toEqual({ userId: 'u-1' });
  });
});
