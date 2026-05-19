/**
 * Type-level guard tests for TenantConfig v1 enforcement.
 * Checked by `tsc --noEmit` (the `typecheck` script).
 *
 * Per ADR 002: type-level separation of tenant + brand enforced in v1.
 * assertSingleTenantBrand is a runtime guard; these tests verify the
 * TS types compile correctly for the phill tenant.
 */
import type { TenantConfig, BrandConfigWithPilot } from '../types';
import { assertSingleTenantBrand } from '../types';
import { phillTenant, phillBrandWithPilot } from '../brands/phill';

// Verify phillTenant satisfies TenantConfig shape
const _t: TenantConfig<BrandConfigWithPilot> = phillTenant;
void _t;

// Verify pilotConfig.semantic_dedup_enabled is a boolean
const _dedup: boolean = phillBrandWithPilot.pilotConfig.semantic_dedup_enabled;
void _dedup;

// Verify billing_tier is a valid union member
const _tier: 'pro' | 'enterprise' = phillTenant.billing_tier;
void _tier;

// Runtime assertion — assertSingleTenantBrand must not throw for phill
assertSingleTenantBrand(phillTenant);
