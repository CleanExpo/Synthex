/**
 * Unit tests for the central entitlement gate (SYN-1106).
 *
 * requireEntitlement must fail CLOSED: a past_due (or otherwise unpaid) paid
 * plan and an under-tier plan are both denied; only an active/trialing plan at
 * or above the feature's required tier is allowed. Subscription resolution is
 * mocked; the entitledPlan + hasPlanAccess logic under test is the real thing.
 */

// Mock prisma so importing plan-access does not instantiate a real client.
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { user: { findUnique: jest.fn() } },
  prisma: { user: { findUnique: jest.fn() } },
}));

// Subscription resolution is the only external input — mock it per test.
const getOrCreateSubscription = jest.fn();
jest.mock('@/lib/stripe/subscription-service', () => ({
  subscriptionService: {
    getOrCreateSubscription: (...args: unknown[]) =>
      getOrCreateSubscription(...args),
  },
}));

import { requireEntitlement } from '@/lib/billing/require-entitlement';

function mockSub(plan: string, status: string) {
  getOrCreateSubscription.mockResolvedValue({ plan, status });
}

describe('requireEntitlement (SYN-1106 central gate)', () => {
  beforeEach(() => getOrCreateSubscription.mockReset());

  it('denies a past_due paid user (status fails the plan closed to free)', async () => {
    mockSub('business', 'past_due');
    const result = await requireEntitlement('u-pastdue', 'ai_pm');
    expect(result.allowed).toBe(false);
    expect(result.effectivePlan).toBe('free');
    expect(result.requiredPlan).toBe('business');
  });

  it('denies an under-tier user (professional cannot reach a business feature)', async () => {
    mockSub('professional', 'active');
    const result = await requireEntitlement('u-under', 'ai_pm');
    expect(result.allowed).toBe(false);
    expect(result.effectivePlan).toBe('professional');
  });

  it('denies a user with no paid plan for any paid feature', async () => {
    mockSub('free', 'active');
    const result = await requireEntitlement('u-free', 'ai_chat');
    expect(result.allowed).toBe(false);
  });

  it('allows an entitled active user at the required tier', async () => {
    mockSub('business', 'active');
    const result = await requireEntitlement('u-biz', 'ai_pm');
    expect(result.allowed).toBe(true);
    expect(result.effectivePlan).toBe('business');
  });

  it('allows a trialing user at the required tier', async () => {
    mockSub('professional', 'trialing');
    const result = await requireEntitlement('u-trial', 'ai_chat');
    expect(result.allowed).toBe(true);
    expect(result.effectivePlan).toBe('professional');
  });

  it('allows a higher tier to clear a lower-tier feature gate', async () => {
    mockSub('business', 'active');
    const result = await requireEntitlement('u-biz', 'seo'); // seo requires professional
    expect(result.allowed).toBe(true);
  });
});
