// Public entry. Single source of truth for Unite-Group brand identities.
// Web apps and Remotion both import from here.

export * from './types';
export { brands, ra, dr, nrpg, carsi, synthex, unite } from './brands';
export {
  TENANTS,
  resolveTenantConfig,
  type TenantSlug,
} from './tenant-resolver';
export {
  themeFactory,
  oklchFromHex,
  type ThemeTokens,
  type CssVarMap,
  type TailwindFragment,
} from './theme-factory';
