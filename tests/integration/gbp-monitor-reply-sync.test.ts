/**
 * Integration test for the GBP monitor cron's review reply-state sync
 * (SYN-531 corruption guard).
 *
 * Bug fixed: the upsert `update` branch unconditionally wrote
 *   replyText: review.reviewReply?.comment ?? null
 * The GBP reviews API is eventually consistent, so a reply just posted via
 * Synthex (reply/route.ts → replyText set, responseStatus='posted') does NOT
 * yet appear in review.reviewReply on the next sync. The old code therefore
 * NULLed out the just-posted reply while responseStatus stayed 'posted',
 * corrupting the reviews page (a "Replied" badge with no reply body, and the
 * reply/AI-draft actions re-exposed → duplicate-reply risk).
 *
 * These tests drive the REAL cron GET handler and assert on the actual
 * prisma.gBPReview.upsert payload.
 *
 * @see app/api/cron/gbp-monitor/route.ts
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { NextRequest } from 'next/server';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUpsert = jest.fn(async () => ({}));
const mockSnapshotUpsert = jest.fn(async () => ({}));
const mockSnapshotUpdateMany = jest.fn(async () => ({ count: 1 }));
const mockLocationFindMany = jest.fn();
const mockBrandDnaFindMany = jest.fn(async () => []);
const mockReviewFindMany = jest.fn(async () => []);
const mockReviewUpdate = jest.fn(async () => ({}));

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    gBPLocation: { findMany: (...a: unknown[]) => mockLocationFindMany(...a) },
    gBPSnapshot: {
      upsert: (...a: unknown[]) => mockSnapshotUpsert(...a),
      updateMany: (...a: unknown[]) => mockSnapshotUpdateMany(...a),
    },
    gBPReview: {
      upsert: (...a: unknown[]) => mockUpsert(...a),
      findMany: (...a: unknown[]) => mockReviewFindMany(...a),
      update: (...a: unknown[]) => mockReviewUpdate(...a),
    },
    brandDNA: { findMany: (...a: unknown[]) => mockBrandDnaFindMany(...a) },
  },
}));

const mockGetReviews = jest.fn();
const mockGetInsights = jest.fn(async () => ({}));
jest.mock('@/lib/google/business-profile', () => ({
  __esModule: true,
  getReviews: (...a: unknown[]) => mockGetReviews(...a),
  getInsights: (...a: unknown[]) => mockGetInsights(...a),
  starRatingToNumber: (r: string) =>
    ({ ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 })[r] ?? 0,
}));

const mockFindOAuthConnection = jest.fn(async () => 'conn_123');
jest.mock('@/lib/google/google-auth', () => ({
  __esModule: true,
  findOAuthConnection: (...a: unknown[]) => mockFindOAuthConnection(...a),
}));

// Fire-and-forget helpers — wrapped so their resolved value survives
// jest.clearAllMocks() (re-applied in beforeEach).
const mockMarkReviewReceived = jest.fn(async () => undefined);
const mockCalcVisibility = jest.fn(async () => undefined);
const mockSeedKeywords = jest.fn(async () => undefined);

jest.mock('@/lib/reviews/review-request-service', () => ({
  __esModule: true,
  markReviewReceived: (...a: unknown[]) => mockMarkReviewReceived(...a),
}));

jest.mock('@/lib/scoring/visibility-score', () => ({
  __esModule: true,
  calculateVisibilityScore: (...a: unknown[]) => mockCalcVisibility(...a),
}));

jest.mock('@/lib/seo/keyword-seeder', () => ({
  __esModule: true,
  seedAllOrgsWithoutKeywords: (...a: unknown[]) => mockSeedKeywords(...a),
}));

const mockGetAIProvider = jest.fn(() => ({
  models: { fast: 'fast-model' },
  complete: jest.fn(async () => ({ choices: [{ message: { content: '' } }] })),
}));
jest.mock('@/lib/ai/providers', () => ({
  __esModule: true,
  getAIProvider: (...a: unknown[]) => mockGetAIProvider(...a),
}));

jest.mock('@/lib/observability/sentry-server', () => ({
  __esModule: true,
  captureServerException: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockVerifyCron = jest.fn(() => ({ ok: true, scope: 'per-route' }));
jest.mock('@/lib/auth/cron-auth', () => ({
  __esModule: true,
  verifyCronRequest: (...a: unknown[]) => mockVerifyCron(...a),
}));

// Imported AFTER mocks are registered.
import { GET } from '@/app/api/cron/gbp-monitor/route';

// The route only passes the request to verifyCronRequest (mocked), so a
// lightweight stand-in avoids the jsdom Request/NextRequest polyfill clash.
function makeRequest(): NextRequest {
  return {
    headers: new Headers({ authorization: 'Bearer test' }),
    url: 'https://synthex.social/api/cron/gbp-monitor',
  } as unknown as NextRequest;
}

const baseLocation = {
  id: 'loc_internal_1',
  organizationId: 'org_1',
  connectionId: 'conn_123',
  locationId: 'accounts/1/locations/1',
  locationName: 'Test Co',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyCron.mockReturnValue({ ok: true, scope: 'per-route' });
  mockGetInsights.mockResolvedValue({});
  mockFindOAuthConnection.mockResolvedValue('conn_123');
  mockGetAIProvider.mockReturnValue({
    models: { fast: 'fast-model' },
    complete: jest.fn(async () => ({ choices: [{ message: { content: '' } }] })),
  });
  mockMarkReviewReceived.mockResolvedValue(undefined);
  mockCalcVisibility.mockResolvedValue(undefined);
  mockSeedKeywords.mockResolvedValue(undefined);
  mockUpsert.mockResolvedValue({});
  mockSnapshotUpsert.mockResolvedValue({});
  mockSnapshotUpdateMany.mockResolvedValue({ count: 1 });
  mockBrandDnaFindMany.mockResolvedValue([]);
  mockReviewFindMany.mockResolvedValue([]);
  mockReviewUpdate.mockResolvedValue({});
  mockLocationFindMany.mockResolvedValue([baseLocation]);
});

describe('gbp-monitor cron — review reply-state sync', () => {
  it('does NOT clobber a locally-posted reply when Google has not yet propagated it', async () => {
    // Google returns the review with NO reviewReply (eventual consistency).
    mockGetReviews.mockResolvedValue({
      reviews: [
        {
          name: 'accounts/1/locations/1/reviews/r1',
          reviewId: 'r1',
          reviewer: { displayName: 'Jane' },
          starRating: 'FIVE',
          comment: 'Great service',
          createTime: '2026-06-01T00:00:00Z',
          updateTime: '2026-06-01T00:00:00Z',
          // reviewReply intentionally absent
        },
      ],
      averageRating: 5,
      totalReviewCount: 1,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const arg = mockUpsert.mock.calls[0][0] as {
      update: Record<string, unknown>;
    };

    // The fix: reply fields are NOT present in the update payload, so an
    // existing locally-posted reply is preserved instead of nulled.
    expect(arg.update).not.toHaveProperty('replyText');
    expect(arg.update).not.toHaveProperty('replyTime');
    expect(arg.update).not.toHaveProperty('responseStatus');
    // Non-reply fields are still synced.
    expect(arg.update).toMatchObject({ rating: 5, comment: 'Great service' });
  });

  it('syncs the reply (and marks posted) when Google DOES return a reviewReply', async () => {
    mockGetReviews.mockResolvedValue({
      reviews: [
        {
          name: 'accounts/1/locations/1/reviews/r2',
          reviewId: 'r2',
          reviewer: { displayName: 'John' },
          starRating: 'FOUR',
          comment: 'Good',
          createTime: '2026-06-02T00:00:00Z',
          updateTime: '2026-06-02T00:00:00Z',
          reviewReply: {
            comment: 'Thanks John, see you soon',
            updateTime: '2026-06-03T00:00:00Z',
          },
        },
      ],
      averageRating: 4,
      totalReviewCount: 1,
    });

    await GET(makeRequest());

    const arg = mockUpsert.mock.calls[0][0] as {
      update: Record<string, unknown>;
    };
    expect(arg.update).toMatchObject({
      replyText: 'Thanks John, see you soon',
      responseStatus: 'posted',
    });
    expect(arg.update.replyTime).toBeInstanceOf(Date);
  });

  it('create branch still carries the reply state from Google verbatim', async () => {
    mockGetReviews.mockResolvedValue({
      reviews: [
        {
          name: 'accounts/1/locations/1/reviews/r3',
          reviewId: 'r3',
          reviewer: { displayName: 'Amy' },
          starRating: 'FIVE',
          comment: 'Excellent',
          createTime: '2026-06-04T00:00:00Z',
          updateTime: '2026-06-04T00:00:00Z',
        },
      ],
    });

    await GET(makeRequest());

    const arg = mockUpsert.mock.calls[0][0] as {
      create: Record<string, unknown>;
    };
    // New review with no reply → create writes replyText null (unchanged behaviour).
    expect(arg.create).toMatchObject({
      gbpReviewId: 'accounts/1/locations/1/reviews/r3',
      replyText: null,
    });
  });
});
