import type { BrandConfig, BrandColour } from './types';

/**
 * Bridge from BrandConfig to web-app theme primitives.
 *
 * - `cssVars` — flat `Record<string, string>` for injection into `:root` (light)
 *   and `.dark` (dark) selectors. Keys follow Tailwind v4 / shadcn convention
 *   (`--background`, `--foreground`, `--primary`, etc).
 * - `tailwind` — fragment for Tailwind v3 `theme.extend.colors` consumers.
 *   Tailwind v4 consumers should prefer the `cssVars` payload + `@theme inline`.
 * - `tokens` — raw OKLch + hex tokens for downstream consumers that want
 *   explicit colour-space access (PDF rendering, design-tool exports).
 */

export interface ThemeTokens {
  hex: string;
  oklch: string;
}

export type CssVarMap = Record<string, string>;

export interface TailwindFragment {
  colors: Record<string, string | Record<string, string>>;
  fontFamily: Record<string, string[]>;
  fontWeight: Record<string, string>;
}

export interface ThemeOutput {
  brand: string;
  cssVars: { light: CssVarMap; dark: CssVarMap };
  tailwind: TailwindFragment;
  tokens: {
    primary: ThemeTokens;
    secondary: ThemeTokens;
    accent: ThemeTokens;
    neutral: Record<'50' | '100' | '500' | '900', ThemeTokens>;
    semantic: Record<'success' | 'warning' | 'danger', ThemeTokens>;
  };
}

// ---------------------------------------------------------------------------
// Hex → OKLch (deterministic, no external deps)
// ---------------------------------------------------------------------------

/** Convert hex (#RRGGBB) → CSS-Color-4 oklch() string. Pure function. */
export function oklchFromHex(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;

  // sRGB → linear RGB
  const lin = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const lr = lin(r);
  const lg = lin(g);
  const lb = lin(b);

  // linear RGB → OKLab (Björn Ottosson 2020)
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  // OKLab → OKLch
  const C = Math.sqrt(a * a + B * B);
  let H = (Math.atan2(B, a) * 180) / Math.PI;
  if (H < 0) H += 360;

  const lPct = (L * 100).toFixed(1);
  const cStr = C.toFixed(3);
  const hStr = H.toFixed(1);

  return `oklch(${lPct}% ${cStr} ${hStr})`;
}

function token(hex: string): ThemeTokens {
  return { hex, oklch: oklchFromHex(hex) };
}

// ---------------------------------------------------------------------------
// CSS variable map (shadcn / Tailwind v4 convention)
// ---------------------------------------------------------------------------

function cssVarsFromColour(c: BrandColour, mode: 'light' | 'dark'): CssVarMap {
  // Dark mode: invert neutrals, lift primary if darkVariant defined.
  const dv = c.darkVariant ?? {};
  const isDark = mode === 'dark';

  const primary = isDark ? dv.primary ?? c.primary : c.primary;
  const secondary = isDark ? dv.secondary ?? c.secondary : c.secondary;
  const accent = isDark ? dv.accent ?? c.accent : c.accent;
  const neutral = isDark ? { ...c.neutral, ...(dv.neutral ?? {}) } : c.neutral;

  const background = isDark ? neutral['900'] : neutral['50'];
  const foreground = isDark ? neutral['50'] : neutral['900'];
  const muted = isDark ? neutral['500'] : neutral['100'];
  const mutedFg = isDark ? neutral['100'] : neutral['500'];

  return {
    '--background': oklchFromHex(background),
    '--foreground': oklchFromHex(foreground),
    '--primary': oklchFromHex(primary),
    '--primary-foreground': oklchFromHex(neutral['50']),
    '--secondary': oklchFromHex(secondary),
    '--secondary-foreground': oklchFromHex(neutral['50']),
    '--accent': oklchFromHex(accent),
    '--accent-foreground': oklchFromHex(neutral['900']),
    '--muted': oklchFromHex(muted),
    '--muted-foreground': oklchFromHex(mutedFg),
    '--border': oklchFromHex(neutral['100']),
    '--input': oklchFromHex(neutral['100']),
    '--ring': oklchFromHex(primary),
    '--success': oklchFromHex(c.semantic.success),
    '--warning': oklchFromHex(c.semantic.warning),
    '--destructive': oklchFromHex(c.semantic.danger),
    '--radius': '0.5rem',
  };
}

// ---------------------------------------------------------------------------
// Tailwind v3 fragment (consumers on legacy Tailwind)
// ---------------------------------------------------------------------------

function tailwindFromBrand(b: BrandConfig): TailwindFragment {
  const c = b.colour;
  const families: Record<string, string[]> = {
    sans: [b.typography.body.family, 'system-ui', 'sans-serif'],
    display: [b.typography.display.family, 'system-ui', 'sans-serif'],
  };
  if (b.typography.mono) {
    families.mono = [b.typography.mono.family, 'ui-monospace', 'monospace'];
  }

  return {
    colors: {
      brand: {
        primary: c.primary,
        secondary: c.secondary,
        accent: c.accent,
      },
      neutral: c.neutral as unknown as Record<string, string>,
      success: c.semantic.success,
      warning: c.semantic.warning,
      danger: c.semantic.danger,
    },
    fontFamily: families,
    fontWeight: {
      display: String(b.typography.display.weight),
      body: String(b.typography.body.weight),
      mono: String(b.typography.mono?.weight ?? 500),
    },
  };
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

export function themeFactory(brand: BrandConfig): ThemeOutput {
  const c = brand.colour;
  return {
    brand: brand.slug,
    cssVars: {
      light: cssVarsFromColour(c, 'light'),
      dark: cssVarsFromColour(c, 'dark'),
    },
    tailwind: tailwindFromBrand(brand),
    tokens: {
      primary: token(c.primary),
      secondary: token(c.secondary),
      accent: token(c.accent),
      neutral: {
        '50': token(c.neutral['50']),
        '100': token(c.neutral['100']),
        '500': token(c.neutral['500']),
        '900': token(c.neutral['900']),
      },
      semantic: {
        success: token(c.semantic.success),
        warning: token(c.semantic.warning),
        danger: token(c.semantic.danger),
      },
    },
  };
}
