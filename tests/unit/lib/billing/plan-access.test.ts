// Mock owner-email allow-list so isFullAccessUser can be tested deterministically
// without depending on the OWNER_EMAILS env var.
// Plain function (not jest.fn) so the config's resetMocks doesn't strip the
// implementation between tests.
jest.mock('@/lib/auth/owner-email', () => ({
  isOwnerEmail: (email?: string | null) => email === 'owner@synthex.social',
}));

// Mock Prisma so resolveEffectivePlan can drive its user lookup.
const findUniqueMock = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: (...args: unknown[]) => findUniqueMock(...args) },
  },
  prisma: {
    user: { findUnique: (...args: unknown[]) => findUniqueMock(...args) },
  },
}));

import {
  entitledPlan,
  hasBusinessAccess,
  hasPlanAccess,
  hasProfessionalAccess,
  isFullAccessUser,
  resolveEffectivePlan,
} from '@/lib/billing/plan-access';
import { isSpatiotemporalAvailable } from '@/lib/forecasting/feature-limits';

describe('plan access ranking', () => {
  it('treats scale and custom as top-tier access', () => {
    expect(hasProfessionalAccess('scale')).toBe(true);
    expect(hasBusinessAccess('scale')).toBe(true);
    expect(hasPlanAccess('custom', 'scale')).toBe(true);
    expect(hasPlanAccess('scale', 'business')).toBe(true);
  });

  it('keeps lower tiers below higher-tier gates', () => {
    expect(hasProfessionalAccess('free')).toBe(false);
    expect(hasBusinessAccess('professional')).toBe(false);
    expect(hasPlanAccess('growth', 'scale')).toBe(false);
  });

  it('treats enterprise as top-tier access (SYN-1105)', () => {
    // enterprise was missing from PLAN_RANK, so lower-tier gates denied it.
    expect(hasProfessionalAccess('enterprise')).toBe(true);
    expect(hasBusinessAccess('enterprise')).toBe(true);
    expect(hasPlanAccess('enterprise', 'scale')).toBe(true);
    expect(hasPlanAccess('enterprise', 'business')).toBe(true);
  });
});

describe('isFullAccessUser (owner/admin bypass)', () => {
  it('grants full access to platform owners', () => {
    expect(isFullAccessUser({ email: 'owner@synthex.social' })).toBe(true);
  });

  it('grants full access to admin and superadmin roles', () => {
    expect(
      isFullAccessUser({ email: 'a@x.com', preferences: { role: 'admin' } })
    ).toBe(true);
    expect(
      isFullAccessUser({
        email: 'b@x.com',
        preferences: { role: 'superadmin' },
      })
    ).toBe(true);
  });

  it('does not grant full access to a normal user', () => {
    expect(
      isFullAccessUser({ email: 'user@x.com', preferences: { role: 'member' } })
    ).toBe(false);
    expect(isFullAccessUser({ email: 'user@x.com' })).toBe(false);
    expect(isFullAccessUser(null)).toBe(false);
  });
});

describe('entitledPlan (status-gated entitlement — SYN-1105 P1)', () => {
  it('keeps a paid plan effective when active or trialing', () => {
    expect(entitledPlan('pro', 'active')).toBe('pro');
    expect(entitledPlan('business', 'trialing')).toBe('business');
    expect(entitledPlan('SCALE', 'active')).toBe('scale');
  });

  it('fails a paid plan closed to free for unpaid/incomplete states', () => {
    expect(entitledPlan('pro', 'past_due')).toBe('free');
    expect(entitledPlan('business', 'unpaid')).toBe('free');
    expect(entitledPlan('pro', 'incomplete')).toBe('free');
    expect(entitledPlan('scale', 'paused')).toBe('free');
    expect(entitledPlan('pro', 'cancelled')).toBe('free');
    expect(entitledPlan('pro', null)).toBe('free');
  });

  it('free stays free regardless of status', () => {
    expect(entitledPlan('free', 'active')).toBe('free');
    expect(entitledPlan(null, 'active')).toBe('free');
  });

  it('a past_due paid plan is denied by downstream tier gates', () => {
    const effective = entitledPlan('pro', 'past_due');
    expect(hasProfessionalAccess(effective)).toBe(false);
  });
});

describe('resolveEffectivePlan (feature-tier gate outcome)', () => {
  beforeEach(() => findUniqueMock.mockReset());

  it('owner on a free org resolves to scale — feature available, no upgrade', async () => {
    findUniqueMock.mockResolvedValue({
      email: 'owner@synthex.social',
      preferences: null,
    });
    const plan = await resolveEffectivePlan('u-owner', 'free');
    expect(plan).toBe('scale');
    // Downstream gates now open for the owner:
    expect(hasProfessionalAccess(plan)).toBe(true);
    expect(isSpatiotemporalAvailable(plan)).toBe(true);
  });

  it('admin on a free org resolves to scale — feature available, no upgrade', async () => {
    findUniqueMock.mockResolvedValue({
      email: 'a@x.com',
      preferences: { role: 'admin' },
    });
    const plan = await resolveEffectivePlan('u-admin', 'free');
    expect(plan).toBe('scale');
    expect(isSpatiotemporalAvailable(plan)).toBe(true);
  });

  it('normal non-owner on a low tier is unchanged — still gated', async () => {
    findUniqueMock.mockResolvedValue({
      email: 'user@x.com',
      preferences: { role: 'member' },
    });
    const plan = await resolveEffectivePlan('u-free', 'free');
    expect(plan).toBe('free');
    // Downstream gates stay closed for a normal free user:
    expect(hasProfessionalAccess(plan)).toBe(false);
    expect(isSpatiotemporalAvailable(plan)).toBe(false);
  });

  it('normal non-owner keeps their real paid tier (lower-cased)', async () => {
    findUniqueMock.mockResolvedValue({
      email: 'user@x.com',
      preferences: null,
    });
    const plan = await resolveEffectivePlan('u-pro', 'PRO');
    expect(plan).toBe('pro');
  });
});
