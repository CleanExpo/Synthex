/**
 * Unit test for the Marketing Agency tier-gate helper.
 *
 * Verifies the gate reads from the canonical PLAN_LIMITS map (fix for
 * code-review finding #4) — legacy plan aliases must work, not be locked
 * out by a parallel hardcoded map.
 */

const findUnique = jest.fn();
const count = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    organization: { findUnique: (...args: unknown[]) => findUnique(...args) },
    marketingAgent: { count: (...args: unknown[]) => count(...args) },
  },
}));

import {
  getMarketingAgentLimitForPlan,
  checkMarketingAgentTier,
} from '@/lib/marketing-agency/agent/tier-gate';

describe('getMarketingAgentLimitForPlan', () => {
  test('current plans (free/starter/pro/growth/scale)', () => {
    expect(getMarketingAgentLimitForPlan('free')).toBe(0);
    expect(getMarketingAgentLimitForPlan('starter')).toBe(0);
    expect(getMarketingAgentLimitForPlan('pro')).toBe(0);
    expect(getMarketingAgentLimitForPlan('growth')).toBe(1);
    expect(getMarketingAgentLimitForPlan('scale')).toBe(3);
  });

  test('legacy / top-tier plan aliases (business / custom / enterprise) honored via PLAN_LIMITS — finding #4 regression guard', () => {
    expect(getMarketingAgentLimitForPlan('business')).toBe(3);
    expect(getMarketingAgentLimitForPlan('custom')).toBe(-1);
    // enterprise is the top tier — must be unlimited, not gated as unknown.
    expect(getMarketingAgentLimitForPlan('enterprise')).toBe(-1);
    expect(getMarketingAgentLimitForPlan('ENTERPRISE')).toBe(-1);
  });

  test('case-insensitive', () => {
    expect(getMarketingAgentLimitForPlan('GROWTH')).toBe(1);
    expect(getMarketingAgentLimitForPlan('Scale')).toBe(3);
  });

  test('unknown / null / undefined → 0', () => {
    expect(getMarketingAgentLimitForPlan('mystery-tier')).toBe(0);
    expect(getMarketingAgentLimitForPlan(null)).toBe(0);
    expect(getMarketingAgentLimitForPlan(undefined)).toBe(0);
    expect(getMarketingAgentLimitForPlan('')).toBe(0);
  });
});

describe('checkMarketingAgentTier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('allows when current < limit', async () => {
    findUnique.mockResolvedValue({ plan: 'growth' });
    count.mockResolvedValue(0);
    const r = await checkMarketingAgentTier('org-1');
    expect(r).toMatchObject({ allowed: true, limit: 1, current: 0, plan: 'growth' });
  });

  test('blocks when current >= limit with appropriate reason', async () => {
    findUnique.mockResolvedValue({ plan: 'growth' });
    count.mockResolvedValue(1);
    const r = await checkMarketingAgentTier('org-1');
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/plan limit of 1 agent/);
  });

  test('blocks free plan with upgrade message', async () => {
    findUnique.mockResolvedValue({ plan: 'free' });
    count.mockResolvedValue(0);
    const r = await checkMarketingAgentTier('org-1');
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/not available on the free plan/);
  });

  test('legacy business plan allowed up to 3 (finding #4 regression guard)', async () => {
    findUnique.mockResolvedValue({ plan: 'business' });
    count.mockResolvedValue(2);
    const r = await checkMarketingAgentTier('org-1');
    expect(r).toMatchObject({ allowed: true, limit: 3, current: 2, plan: 'business' });
  });

  test('custom plan = unlimited (-1) always allowed regardless of count', async () => {
    findUnique.mockResolvedValue({ plan: 'custom' });
    count.mockResolvedValue(100);
    const r = await checkMarketingAgentTier('org-1');
    expect(r).toMatchObject({ allowed: true, limit: -1, current: 100 });
  });

  test('missing org row → treat as free plan', async () => {
    findUnique.mockResolvedValue(null);
    count.mockResolvedValue(0);
    const r = await checkMarketingAgentTier('org-1');
    expect(r.allowed).toBe(false);
    expect(r.plan).toBe('free');
  });
});
