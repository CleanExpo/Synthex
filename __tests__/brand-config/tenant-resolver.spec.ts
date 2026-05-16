/**
 * Runtime tests for `resolveTenantConfig` — Phase 6 Task 6.2.
 *
 * Verifies the 7 acceptance criteria from PHASE-6-PLAN.md Task 6.2.
 */
import {
  TENANTS,
  resolveTenantConfig,
  type TenantSlug,
} from '@unite-group/brand-config';

const PORTFOLIO_SLUGS: TenantSlug[] = [
  'dr',
  'nrpg',
  'ra',
  'carsi',
  'ccw',
  'synthex',
  'unite',
  'john-coutis',
];

const ALL_SLUGS: TenantSlug[] = [...PORTFOLIO_SLUGS, 'phill'];

describe('packages/brand-config/tenant-resolver', () => {
  it('AC-1: resolveTenantConfig("dr") returns a TenantConfig keyed by "dr"', () => {
    const t = resolveTenantConfig('dr');
    expect(t.tenant_slug).toBe('dr');
    expect(t.brands.dr.slug).toBe('dr');
  });

  it('AC-2: every TenantSlug resolves without throwing + passes assertSingleTenantBrand', () => {
    for (const slug of ALL_SLUGS) {
      expect(() => resolveTenantConfig(slug)).not.toThrow();
      const t = resolveTenantConfig(slug);
      expect(t.tenant_slug).toBe(slug);
      expect(Object.keys(t.brands)).toEqual([slug]);
    }
  });

  it('AC-3: unknown slug throws an Error mentioning "Unknown tenant"', () => {
    expect(() =>
      resolveTenantConfig('does-not-exist' as TenantSlug),
    ).toThrow(/Unknown tenant/);
  });

  it('AC-4: TENANTS is frozen (mutation throws in strict mode)', () => {
    expect(Object.isFrozen(TENANTS)).toBe(true);
    expect(() => {
      (TENANTS as unknown as Record<string, unknown>).foo = 1;
    }).toThrow(TypeError);
  });

  it('AC-5: phill defaults to semantic_dedup_enabled === true', () => {
    const t = resolveTenantConfig('phill');
    expect(t.brands.phill.pilotConfig.semantic_dedup_enabled).toBe(true);
    expect(t.billing_tier).toBe('enterprise');
  });

  it('AC-6: portfolio brands default to semantic_dedup_enabled === false', () => {
    for (const slug of PORTFOLIO_SLUGS) {
      const t = resolveTenantConfig(slug);
      expect(t.brands[slug].pilotConfig.semantic_dedup_enabled).toBe(false);
      expect(t.billing_tier).toBe('pro');
    }
  });

  it('AC-7: covered by `npm run typecheck` in packages/brand-config (smoke-tested here)', () => {
    // Smoke: importing the typed module proves the package builds + types resolve.
    expect(typeof resolveTenantConfig).toBe('function');
    expect(typeof TENANTS).toBe('object');
  });
});
