/**
 * @jest-environment node
 */
/**
 * POST /api/ask-synthex — honest about the stores it cannot reach.
 *
 * journey_analytics, client_conversations and conversation_events have no
 * model in prisma/schema.prisma. The answer is still built from Prisma-backed
 * sources scoped to auth.clientId, and every response says that journey context
 * was not consulted and that the conversation was not saved.
 */
import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  platformPost: { findMany: jest.fn() },
  clientHealthScore: { findFirst: jest.fn() },
  recommendedAction: { findMany: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

jest.mock('@/lib/auth/with-auth', () => ({
  withAuth:
    (handler: (r: unknown, a: unknown) => unknown) => (request: unknown) =>
      handler(request, { userId: 'user-A', clientId: 'org-A', role: 'owner' }),
}));
jest.mock('@/lib/rate-limit/rate-limiter', () => ({
  withRateLimit: (_req: unknown, fn: () => unknown) => fn(),
}));
const mockRoutedCall = jest.fn();
jest.mock('@/lib/ai/model-router', () => ({
  routedCall: (...a: unknown[]) => mockRoutedCall(...a),
}));
jest.mock('@/lib/intelligence/accuracy-ledger', () => ({
  recordScoreIssued: jest.fn(() => Promise.resolve()),
}));

import { POST } from '@/app/api/ask-synthex/route';

beforeEach(() => {
  mockPrisma.platformPost.findMany.mockResolvedValue([]);
  mockPrisma.clientHealthScore.findFirst.mockResolvedValue(null);
  mockPrisma.recommendedAction.findMany.mockResolvedValue([]);
  mockRoutedCall.mockResolvedValue('Post on Tuesdays.');
});

describe('POST /api/ask-synthex — not-provisioned stores', () => {
  it('answers, scoped to auth.clientId, and declares journey + conversation log unavailable', async () => {
    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/ask-synthex',
        body: { question: 'When should I post?' },
      }) as never
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.answer).toBe('Post on Tuesdays.');
    expect(json.notProvisioned.journeyAnalytics).toEqual({
      available: false,
      reason: expect.stringMatching(/journey_analytics/),
    });
    expect(json.notProvisioned.conversationLog).toEqual({
      available: false,
      reason: expect.stringMatching(/client_conversations.*not saved/),
    });
    expect(json.sources.map((s: { table: string }) => s.table)).not.toContain(
      'journey_analytics'
    );
    expect(
      mockPrisma.platformPost.findMany.mock.calls[0][0].where.connection
    ).toEqual({ organizationId: 'org-A' });
  });
});
