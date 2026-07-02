/**
 * Unit tests for resolveVerifiedTier — the rate-limit tier-elevation guard
 * (SYN-963, auth attack surface).
 *
 * The security property: a user's tier is resolved from a VERIFIED source (the
 * subscription row), never the JWT payload, and it must FAIL CLOSED to 'free'
 * on any error, or an inactive / unknown / missing subscription — never grant a
 * higher tier on failure.
 *
 * Upstash is absent in the test env, so getUpstashClient() returns null and the
 * DB path is exercised directly.
 */
const findUniqueSubscription = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { subscription: { findUnique: (...a: unknown[]) => findUniqueSubscription(...a) } },
  prisma: { subscription: { findUnique: (...a: unknown[]) => findUniqueSubscription(...a) } },
}));

import { resolveVerifiedTier } from '@/lib/rate-limit/rate-limiter';

beforeEach(() => jest.clearAllMocks());

describe('resolveVerifiedTier (tier-elevation guard)', () => {
  it('returns the mapped tier for an active subscription', async () => {
    findUniqueSubscription.mockResolvedValue({ plan: 'pro', status: 'active' });
    await expect(resolveVerifiedTier('u1')).resolves.toBe('pro');
  });

  it('treats a trialing subscription as active', async () => {
    findUniqueSubscription.mockResolvedValue({ plan: 'scale', status: 'trialing' });
    await expect(resolveVerifiedTier('u1')).resolves.toBe('scale');
  });

  it('does NOT elevate an inactive subscription (canceled → free)', async () => {
    findUniqueSubscription.mockResolvedValue({ plan: 'scale', status: 'canceled' });
    await expect(resolveVerifiedTier('u1')).resolves.toBe('free');
  });

  it('falls back to free for an unknown plan on an active subscription', async () => {
    findUniqueSubscription.mockResolvedValue({ plan: 'enterprise-x', status: 'active' });
    await expect(resolveVerifiedTier('u1')).resolves.toBe('free');
  });

  it('returns free when the user has no subscription', async () => {
    findUniqueSubscription.mockResolvedValue(null);
    await expect(resolveVerifiedTier('u1')).resolves.toBe('free');
  });

  it('fails closed to free when the DB lookup throws', async () => {
    findUniqueSubscription.mockRejectedValue(new Error('db down'));
    await expect(resolveVerifiedTier('u1')).resolves.toBe('free');
  });
});
