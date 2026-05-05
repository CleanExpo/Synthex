// Public entry. Single source of truth for Unite-Group brand identities.
// Web apps and Remotion both import from here.

export * from './types';
export { brands, ra, dr, nrpg, carsi, ccw, synthex, unite } from './brands';
export {
  themeFactory,
  oklchFromHex,
  type ThemeTokens,
  type CssVarMap,
  type TailwindFragment,
} from './theme-factory';
