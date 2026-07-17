/**
 * Route-level entitlement test (SYN-1106).
 *
 * POST /api/ai/pm/conversations is a Business-tier feature. A Professional
 * user is under-tier and must be denied with the route's existing 402 upgrade
 * response. This exercises the real chain route → requireEntitlement →
 * entitledPlan/hasPlanAccess; only subscription resolution and auth are mocked.
 */

/** @jest-environment node */

// Prisma — must not be reached (the gate denies first); provide a stub so the
// route module imports cleanly.
jest.mock('@/lib/prisma', () => {
  const stub = {
    aIConversation: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  return { __esModule: true, default: stub, prisma: stub };
});

const mockCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...a: unknown[]) => mockCheck(...a),
    createSecureResponse: (body: object, status = 200) =>
      new Response(JSON.stringify(body), { status }),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_WRITE: 'AUTHENTICATED_WRITE',
    AUTHENTICATED_READ: 'AUTHENTICATED_READ',
  },
}));

// Subscription resolution — a Professional/active user (under the Business tier).
const getOrCreateSubscription = jest.fn();
jest.mock('@/lib/stripe/subscription-service', () => ({
  subscriptionService: {
    getOrCreateSubscription: (...a: unknown[]) => getOrCreateSubscription(...a),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { POST } from '@/app/api/ai/pm/conversations/route';
import { createMockNextRequest } from '../../helpers/mock-request';

const post = () =>
  POST(
    createMockNextRequest({
      method: 'POST',
      url: 'https://synthex.example/api/ai/pm/conversations',
      body: { title: 'x' },
    })
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockCheck.mockResolvedValue({ allowed: true, context: { userId: 'u1' } });
});

describe('POST /api/ai/pm/conversations entitlement gate', () => {
  it('returns 402 for an under-tier (Professional) user requesting a Business feature', async () => {
    getOrCreateSubscription.mockResolvedValue({
      plan: 'professional',
      status: 'active',
    });

    const res = await post();
    expect(res.status).toBe(402);
    const json = await res.json();
    expect(json.upgradeRequired).toBe(true);
    expect(json.requiredPlan).toBe('business');
  });

  it('allows an entitled (Business/active) user through the gate', async () => {
    getOrCreateSubscription.mockResolvedValue({
      plan: 'business',
      status: 'active',
    });

    const res = await post();
    // Gate passes → route proceeds to create the conversation (200), not 402.
    expect(res.status).not.toBe(402);
  });
});
