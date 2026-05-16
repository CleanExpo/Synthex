/**
 * TenantConfig resolver — Phase 6 Task 6.2.
 *
 * Single canonical lookup that turns a tenant slug into a validated
 * `TenantConfig<BrandConfigWithPilot>`. v1 enforces 1:1 tenant↔brand per
 * ADR-002 — every portfolio brand becomes its own tenant; `phill` is the
 * founder-internal tenant from `brands/phill.ts`.
 *
 * Default pilot state:
 *   - portfolio brands → `semantic_dedup_enabled: false` (opt-in)
 *   - `phill`          → `semantic_dedup_enabled: true`  (founder default)
 */
import type {
  BrandConfig,
  BrandConfigWithPilot,
  BrandSlug,
  TenantConfig,
} from './types';
import { assertSingleTenantBrand } from './types';
import { brands } from './brands';
import { phillBrandWithPilot } from './brands/phill';

export type TenantSlug = BrandSlug | 'phill';

const PORTFOLIO_TENANTS: Record<BrandSlug, TenantConfig<BrandConfigWithPilot>> =
  (Object.keys(brands) as BrandSlug[]).reduce(
    (acc, slug) => {
      const brand: BrandConfig = brands[slug];
      const withPilot: BrandConfigWithPilot = {
        ...brand,
        pilotConfig: { semantic_dedup_enabled: false },
      };
      acc[slug] = {
        tenant_slug: slug,
        billing_tier: 'pro',
        brands: { [slug]: withPilot },
      };
      return acc;
    },
    {} as Record<BrandSlug, TenantConfig<BrandConfigWithPilot>>,
  );

/**
 * Frozen at module load. All known tenants under the v1 1:1 envelope.
 * Mutation throws in strict mode.
 */
export const TENANTS: Readonly<
  Record<TenantSlug, TenantConfig<BrandConfigWithPilot>>
> = Object.freeze({
  ...PORTFOLIO_TENANTS,
  phill: {
    tenant_slug: 'phill',
    billing_tier: 'enterprise' as const,
    brands: { phill: phillBrandWithPilot },
  },
});

/**
 * Resolve a tenant slug to its TenantConfig. Validates 1:1 invariant
 * before returning. Throws on unknown slug.
 */
export function resolveTenantConfig(
  slug: TenantSlug,
): TenantConfig<BrandConfigWithPilot> {
  const tenant = (TENANTS as Record<string, TenantConfig<BrandConfigWithPilot>>)[
    slug
  ];
  if (!tenant) {
    throw new Error(`Unknown tenant slug: ${String(slug)}`);
  }
  assertSingleTenantBrand(tenant);
  return tenant;
}
