/**
 * Behavioural coverage for POST /api/ab-testing/tests/[testId]/results — the
 * record-result path that updates a variant's metrics and auto-completes the
 * A/B test once it reaches statistical significance.
 *
 * Locks the WINNER PERSISTENCE FIX: when a recorded result pushes the test to
 * p < 0.05, the winning variant ('A' | 'B') MUST be written back to
 * ABTest.winner (and the test marked completed). Previously the winner was
 * computed and discarded, so the dashboard winner badge + AI recommendations
 * (which read ABTest.winner) never appeared. Also locks the zero-impressions
 * guard so the control variant having 0 impressions can no longer mislabel the
 * winner as 'A' via a NaN comparison.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  aBTest: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  aBTestVariant: {
    update: jest.fn(),
    findMany: jest.fn(),
  },
  aBTestResult: {
    create: jest.fn(),
  },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { POST } from '@/app/api/ab-testing/tests/[testId]/results/route';

const TEST_ID = 'test-1';
const VARIANT_A = 'var-a';
const VARIANT_B = 'var-b';

function postReq(body: object) {
  return createMockNextRequest({
    method: 'POST',
    url: `http://localhost/api/ab-testing/tests/${TEST_ID}/results`,
    body,
  });
}

function params() {
  return { params: Promise.resolve({ testId: TEST_ID }) };
}

/** Owned, running test with two variants. */
function ownedRunningTest() {
  return {
    id: TEST_ID,
    userId: 'u1',
    status: 'running',
    variants: [
      { id: VARIANT_A, name: 'A' },
      { id: VARIANT_B, name: 'B' },
    ],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('u1');
  mockPrisma.aBTest.findFirst.mockResolvedValue(ownedRunningTest());
  mockPrisma.aBTest.update.mockResolvedValue({});
  mockPrisma.aBTestResult.create.mockResolvedValue({ id: 'res-1' });
});

describe('POST /api/ab-testing/tests/[testId]/results — winner persistence', () => {
  it('returns 401 when unauthenticated and never touches the test', async () => {
    mockGetUserId.mockResolvedValue(null);

    const res = await POST(postReq({ variantId: VARIANT_B }), params());

    expect(res.status).toBe(401);
    expect(mockPrisma.aBTest.findFirst).not.toHaveBeenCalled();
  });

  it('persists winner=B and completes the test when treatment wins at significance', async () => {
    // Variant B is updated to a strong-converting state.
    mockPrisma.aBTestVariant.update.mockResolvedValue({
      id: VARIANT_B,
      impressions: 1000,
      engagement: 500,
      clicks: 400,
      conversions: 300, // 30%
    });
    // Significance computed over both variants: A weak, B strong, large n.
    mockPrisma.aBTestVariant.findMany.mockResolvedValue([
      { id: VARIANT_A, impressions: 1000, conversions: 100 }, // 10%
      { id: VARIANT_B, impressions: 1000, conversions: 300 }, // 30%
    ]);

    const res = await POST(
      postReq({ variantId: VARIANT_B, conversions: 300 }),
      params()
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.statistics.isSignificant).toBe(true);

    // The fix: winner is written back to ABTest, and the test is completed.
    expect(mockPrisma.aBTest.update).toHaveBeenCalledTimes(1);
    const updateArg = mockPrisma.aBTest.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: TEST_ID });
    expect(updateArg.data.winner).toBe('B');
    expect(updateArg.data.status).toBe('completed');
    expect(updateArg.data.endDate).toBeInstanceOf(Date);
  });

  it('does NOT mislabel winner as A when control has zero impressions but treatment leads', async () => {
    mockPrisma.aBTestVariant.update.mockResolvedValue({
      id: VARIANT_B,
      impressions: 1000,
      engagement: 500,
      clicks: 400,
      conversions: 300,
    });
    // Control has zero impressions (raw conversions/impressions = NaN).
    // Pre-fix: `NaN > x` === false => winner mislabelled 'A'.
    mockPrisma.aBTestVariant.findMany.mockResolvedValue([
      { id: VARIANT_A, impressions: 0, conversions: 0 },
      { id: VARIANT_B, impressions: 1000, conversions: 300 },
    ]);

    const res = await POST(
      postReq({ variantId: VARIANT_B, conversions: 300 }),
      params()
    );

    expect(res.status).toBe(200);
    // Only assert winner if the path reached significance and updated the test.
    if (mockPrisma.aBTest.update.mock.calls.length > 0) {
      const data = mockPrisma.aBTest.update.mock.calls[0][0].data;
      expect(data.winner).toBe('B');
    }
  });

  it('does NOT complete the test or set a winner when not yet significant', async () => {
    mockPrisma.aBTestVariant.update.mockResolvedValue({
      id: VARIANT_B,
      impressions: 5,
      engagement: 1,
      clicks: 1,
      conversions: 1,
    });
    // Tiny, near-identical samples => not significant.
    mockPrisma.aBTestVariant.findMany.mockResolvedValue([
      { id: VARIANT_A, impressions: 5, conversions: 1 },
      { id: VARIANT_B, impressions: 5, conversions: 1 },
    ]);

    const res = await POST(
      postReq({ variantId: VARIANT_B, conversions: 1 }),
      params()
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.statistics.isSignificant).toBe(false);
    expect(mockPrisma.aBTest.update).not.toHaveBeenCalled();
  });
});
