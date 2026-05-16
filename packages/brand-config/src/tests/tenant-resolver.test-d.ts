/**
 * Type-level guard tests for `resolveTenantConfig` — Phase 6 Task 6.2.
 * Checked by `tsc --noEmit` (the `typecheck` script).
 */
import type {
  BrandConfigWithPilot,
  TenantConfig,
} from '../types';
import {
  TENANTS,
  resolveTenantConfig,
  type TenantSlug,
} from '../tenant-resolver';
import { Equal, doNotExecute } from './utils';

// Return type is TenantConfig<BrandConfigWithPilot>.
const _dr: TenantConfig<BrandConfigWithPilot> = resolveTenantConfig('dr');
void _dr;

// TenantSlug is the union of BrandSlug + 'phill'.
doNotExecute(() => {
  const _slugs: Equal<
    TenantSlug,
    | 'dr'
    | 'nrpg'
    | 'ra'
    | 'carsi'
    | 'ccw'
    | 'synthex'
    | 'unite'
    | 'john-coutis'
    | 'phill'
  > = true;
  void _slugs;
});

// TENANTS exposes every tenant slug as a TenantConfig.
const _tenants: Readonly<
  Record<TenantSlug, TenantConfig<BrandConfigWithPilot>>
> = TENANTS;
void _tenants;

// pilotConfig is reachable + boolean-typed.
const _dedup: boolean =
  resolveTenantConfig('phill').brands.phill.pilotConfig.semantic_dedup_enabled;
void _dedup;

// @ts-expect-error — unknown slugs are rejected by the type system.
resolveTenantConfig('nonexistent');
