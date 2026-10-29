/**
 * SEAM: GET /api/cron/gbp-monitor with the real local-outcome writer over an
 * in-memory Prisma fake. Catches: synced reviews not becoming outcome events,
 * replayed cron runs double-writing, writer failure failing the cron.
 * Misses: real Prisma query semantics and the Google API (mocked).
 */
const state = {
  signals: new Map<string, { id: string }>(),
  outcomes: [] as Array<Record<string, any>>,
  failWriter: false,
};

const location = {
  id: 'loc-row-1',
  organizationId: 'org-A',
  connectionId: 'conn-1',
  locationId: 'locations/777',
  locationName: 'Acme Plumbing',
};
const review = {
  name: 'accounts/1/locations/777/reviews/rev-1',
  starRating: 'FIVE',
  comment: 'Fixed the leak same day.',
  createTime: '2026-10-01T00:00:00.000Z',
  reviewer: { displayName: 'Synthetic Reviewer' },
};

const mockPrisma: any = {
  gBPLocation: { findMany: async () => [location] },
  gBPSnapshot: { upsert: async () => ({}), updateMany: async () => ({}) },
  gBPReview: { upsert: async () => ({}), findMany: async () => [] },
  marketingAgencySignal: {
    upsert: async (args: any) => {
      if (state.failWriter) throw new Error('db down');
      state.signals.set(args.create.externalId, {
        id: `sig-${args.create.externalId}`,
      });
    },
    findUnique: async (args: any) =>
      state.signals.get(args.where.organizationId_externalId.externalId) ??
      null,
  },
  marketingAgencyOpportunity: {
    upsert: async () => ({}),
    findUnique: async () => null,
  },
  marketingAgencyOutcomeEvent: {
    create: async (args: any) => {
      const row = { id: `out-${state.outcomes.length + 1}`, ...args.data };
      state.outcomes.push(row);
      return row;
    },
    findMany: async (args: any) =>
      state.outcomes
        .filter(o => Object.entries(args.where).every(([k, v]) => o[k] === v))
        .slice(0, args.take),
  },
  $transaction: async (cb: any) => cb(mockPrisma),
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));
jest.mock('@/lib/auth/cron-auth', () => ({
  verifyCronRequest: () => ({ ok: true }),
}));
jest.mock('@/lib/google/google-auth', () => ({
  findOAuthConnection: async () => 'conn-1',
}));
jest.mock('@/lib/google/business-profile', () => ({
  getInsights: async () => ({
    searchViews: 1,
    mapsViews: 1,
    websiteClicks: 1,
    phoneClicks: 1,
    directionClicks: 1,
  }),
  getReviews: async () => ({
    averageRating: 5,
    totalReviewCount: 1,
    reviews: [review],
  }),
  starRatingToNumber: () => 5,
}));
jest.mock('@/lib/reviews/review-request-service', () => ({
  markReviewReceived: async () => undefined,
}));
jest.mock('@/lib/scoring/visibility-score', () => ({
  calculateVisibilityScore: async () => undefined,
}));
jest.mock('@/lib/seo/keyword-seeder', () => ({
  seedAllOrgsWithoutKeywords: async () => undefined,
}));
jest.mock('@/lib/observability/sentry-server', () => ({
  captureServerException: () => undefined,
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  },
}));

import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { GET } from '@/app/api/cron/gbp-monitor/route';

const run = () =>
  GET(createMockNextRequest({ url: 'http://localhost/api/cron/gbp-monitor' }));

beforeEach(() => {
  state.signals.clear();
  state.outcomes.length = 0;
  state.failWriter = false;
});

describe('GET /api/cron/gbp-monitor review outcomes', () => {
  it('records one review outcome with the location id, and none on a second run', async () => {
    await run();
    expect(state.outcomes).toHaveLength(1);
    expect(state.outcomes[0]).toMatchObject({
      organizationId: 'org-A',
      eventType: 'local_review_received',
      observedValue: '5',
      metadata: {
        locationId: 'loc-row-1',
        gbpReviewId: review.name,
        attribution: { source: 'google', medium: 'gbp' },
      },
    });

    await run();
    expect(state.outcomes).toHaveLength(1);
  });

  it('does not fail the location or the cron when the outcome writer throws', async () => {
    state.failWriter = true;
    const res = await run();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.failed).toBe(0);
    expect(body.reviewsSynced).toBe(1);
  });
});
