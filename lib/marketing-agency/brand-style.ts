/**
 * Brand style layer (SYN-40)
 *
 * WHY THIS EXISTS (bench-reduced scope): the SYN-46 ad-template substrate emits
 * text-to-video prompt strings that hard-code "no text, no watermark" — a
 * prompt can never pixel-guarantee a brand hex, a font, or a CTA position.
 * Brand pixels therefore belong in the Remotion composition layer, applied by
 * the render step AFTER the AI model has produced the raw clip.
 *
 * This module is the deterministic contract between the two worlds:
 *
 *   - a curated font manifest (enum-only — no free-text font strings),
 *   - `validateBrandStyle()` — hex/font/CTA/logo-URL validation,
 *   - `BrandOverlaySpec` — the Remotion-consumable overlay contract with
 *     safe-zone grid positions per aspect ratio,
 *   - `withBrandOverlay()` — the ONLY sanctioned way to attach brand style to
 *     an AdGenerationRequest. It is a pure additive spread: the prompt string
 *     and every substrate field are untouched, so brand fields NEVER enter
 *     prompt text.
 *
 * lib/marketing-agency/artlist/ad-templates.ts is a closed contract (locked
 * test) — this file only imports its TYPES and never modifies its behaviour.
 *
 * Deferred (do NOT add here): logo→colour auto-detect, the compositing render
 * pass itself (SYN-43/48), freeform CTA drag, live Artlist generation,
 * publishing.
 */

import type {
  AdAspectRatio,
  AdGenerationRequest,
} from './artlist/ad-templates';

// --- Curated font manifest ---------------------------------------------------

export type BrandFontId =
  | 'inter'
  | 'roboto'
  | 'open-sans'
  | 'lato'
  | 'montserrat'
  | 'poppins'
  | 'nunito'
  | 'raleway'
  | 'oswald'
  | 'merriweather'
  | 'playfair-display'
  | 'source-code-pro';

export interface BrandFont {
  id: BrandFontId;
  label: string;
  category: 'sans-serif' | 'serif' | 'display' | 'mono';
  /** CSS font stack used by the preview panel and the Remotion composition. */
  stack: string;
}

/**
 * The curated manifest — 12 licensed-safe, web-available families. Font choice
 * is enum-only: free-text font strings are rejected by `validateBrandStyle`.
 */
export const BRAND_FONTS: readonly BrandFont[] = [
  {
    id: 'inter',
    label: 'Inter',
    category: 'sans-serif',
    stack: "'Inter', ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: 'roboto',
    label: 'Roboto',
    category: 'sans-serif',
    stack: "'Roboto', ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: 'open-sans',
    label: 'Open Sans',
    category: 'sans-serif',
    stack: "'Open Sans', ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: 'lato',
    label: 'Lato',
    category: 'sans-serif',
    stack: "'Lato', ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: 'montserrat',
    label: 'Montserrat',
    category: 'sans-serif',
    stack: "'Montserrat', ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: 'poppins',
    label: 'Poppins',
    category: 'sans-serif',
    stack: "'Poppins', ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: 'nunito',
    label: 'Nunito',
    category: 'sans-serif',
    stack: "'Nunito', ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: 'raleway',
    label: 'Raleway',
    category: 'sans-serif',
    stack: "'Raleway', ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: 'oswald',
    label: 'Oswald',
    category: 'display',
    stack: "'Oswald', ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: 'merriweather',
    label: 'Merriweather',
    category: 'serif',
    stack: "'Merriweather', ui-serif, Georgia, serif",
  },
  {
    id: 'playfair-display',
    label: 'Playfair Display',
    category: 'serif',
    stack: "'Playfair Display', ui-serif, Georgia, serif",
  },
  {
    id: 'source-code-pro',
    label: 'Source Code Pro',
    category: 'mono',
    stack: "'Source Code Pro', ui-monospace, monospace",
  },
] as const;

export const DEFAULT_BRAND_FONT_ID: BrandFontId = 'inter';

export function getBrandFont(id: string): BrandFont | undefined {
  return BRAND_FONTS.find(f => f.id === id);
}

export function isBrandFontId(value: string): value is BrandFontId {
  return BRAND_FONTS.some(f => f.id === value);
}

// --- Validation constraints --------------------------------------------------

/** Strict 6-digit hex only — deterministic, no shorthand/alpha forms. */
export const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

/** CTA copy is overlay text on a ≤8s clip; hard cap keeps it legible. */
export const CTA_TEXT_MAX_LENGTH = 40;

export const PRESET_NAME_MAX_LENGTH = 80;

/**
 * Logo URLs must be https AND on an allowlisted origin. Entries starting with
 * '.' are hostname-suffix matches (e.g. '.platform.co' allows
 * xyz.platform.co); other entries are exact hostname matches. The app's own
 * Supabase storage host (LEGACY_PLATFORM_URL) is added when configured.
 */
export const DEFAULT_ALLOWED_LOGO_HOSTS: readonly string[] = [
  '.platform.co',
  '.platform.in',
];

export function resolveAllowedLogoHosts(
  extra: readonly string[] = []
): readonly string[] {
  const hosts = [...DEFAULT_ALLOWED_LOGO_HOSTS, ...extra];
  return hosts;
}

export function isAllowedLogoUrl(
  url: string,
  allowedHosts: readonly string[] = resolveAllowedLogoHosts()
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const hostname = parsed.hostname.toLowerCase();
  return allowedHosts.some(entry => {
    const e = entry.toLowerCase();
    return e.startsWith('.') ? hostname.endsWith(e) : hostname === e;
  });
}

// --- validateBrandStyle -------------------------------------------------------

/** Flat brand style fields — mirrors the BrandPreset row 1:1. */
export interface BrandStyleInput {
  name?: string;
  primaryColor: string;
  secondaryColor?: string | null;
  accentColor?: string | null;
  font: string;
  logoUrl?: string | null;
  ctaText?: string | null;
}

export interface ValidatedBrandStyle {
  name: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  accentColor: string | null;
  font: BrandFontId;
  logoUrl: string | null;
  ctaText: string | null;
}

export interface BrandStyleIssue {
  field: string;
  message: string;
}

export type BrandStyleValidation =
  | { ok: true; value: ValidatedBrandStyle }
  | { ok: false; issues: BrandStyleIssue[] };

/**
 * Validate a flat brand style. Collects ALL issues (matrix-testable) instead
 * of failing on the first. Rules:
 *   - colors: strict #RRGGBB hex (primary required; secondary/accent optional)
 *   - font: enum-only against BRAND_FONTS
 *   - ctaText: trimmed, non-empty when present, ≤ CTA_TEXT_MAX_LENGTH
 *   - logoUrl: https + origin-allowlisted when present
 *   - name: trimmed, non-empty when present, ≤ PRESET_NAME_MAX_LENGTH
 */
export function validateBrandStyle(
  input: BrandStyleInput,
  opts: { allowedLogoHosts?: readonly string[] } = {}
): BrandStyleValidation {
  const issues: BrandStyleIssue[] = [];
  const allowedHosts = opts.allowedLogoHosts ?? resolveAllowedLogoHosts();

  const name = input.name?.trim() ?? null;
  if (name !== null) {
    if (name.length === 0) {
      issues.push({ field: 'name', message: 'Preset name must not be empty.' });
    } else if (name.length > PRESET_NAME_MAX_LENGTH) {
      issues.push({
        field: 'name',
        message: `Preset name must be at most ${PRESET_NAME_MAX_LENGTH} characters.`,
      });
    }
  }

  const checkHex = (field: string, value: string) => {
    if (!HEX_COLOR_REGEX.test(value)) {
      issues.push({
        field,
        message: `Must be a 6-digit hex colour like #1A2B3C (got "${value}").`,
      });
    }
  };

  checkHex('primaryColor', input.primaryColor);
  const secondaryColor = input.secondaryColor ?? null;
  if (secondaryColor !== null) checkHex('secondaryColor', secondaryColor);
  const accentColor = input.accentColor ?? null;
  if (accentColor !== null) checkHex('accentColor', accentColor);

  if (!isBrandFontId(input.font)) {
    issues.push({
      field: 'font',
      message: `Font must be one of the curated manifest ids (got "${input.font}").`,
    });
  }

  const ctaText = input.ctaText?.trim() ?? null;
  if (ctaText !== null) {
    if (ctaText.length === 0) {
      issues.push({ field: 'ctaText', message: 'CTA text must not be empty.' });
    } else if (ctaText.length > CTA_TEXT_MAX_LENGTH) {
      issues.push({
        field: 'ctaText',
        message: `CTA text must be at most ${CTA_TEXT_MAX_LENGTH} characters.`,
      });
    }
  }

  const logoUrl = input.logoUrl?.trim() || null;
  if (logoUrl !== null && !isAllowedLogoUrl(logoUrl, allowedHosts)) {
    issues.push({
      field: 'logoUrl',
      message: 'Logo URL must be https and on an allowlisted origin.',
    });
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    value: {
      name,
      primaryColor: input.primaryColor,
      secondaryColor,
      accentColor,
      font: input.font as BrandFontId,
      logoUrl,
      ctaText,
    },
  };
}

// --- Safe-zone grid per aspect ratio ------------------------------------------

export type OverlayGridPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export const OVERLAY_GRID_POSITIONS: readonly OverlayGridPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const;

export interface SafeZoneSpec {
  /**
   * Fractional inset (0-1) from each frame edge. Grid cells are laid out
   * INSIDE this box, so every allowed position is clear of platform UI chrome
   * (Reels username/CTA bars, player controls, feed crop).
   */
  margin: { top: number; right: number; bottom: number; left: number };
  /** Grid cells a CTA may occupy on this aspect ratio. */
  ctaPositions: readonly OverlayGridPosition[];
  /** Grid cells a logo may occupy on this aspect ratio. */
  logoPositions: readonly OverlayGridPosition[];
  defaultCtaPosition: OverlayGridPosition;
  defaultLogoPosition: OverlayGridPosition;
}

/**
 * Deterministic safe zones per template aspect ratio. 9:16 reserves the
 * largest top/bottom bands (Stories/Reels overlay chrome); 16:9 reserves the
 * bottom player-control band; 1:1 is feed-cropped symmetrically.
 */
export const SAFE_ZONES: Record<AdAspectRatio, SafeZoneSpec> = {
  '9:16': {
    margin: { top: 0.14, right: 0.06, bottom: 0.2, left: 0.06 },
    ctaPositions: [
      'middle-center',
      'bottom-center',
      'bottom-left',
      'bottom-right',
    ],
    logoPositions: ['top-left', 'top-center', 'top-right'],
    defaultCtaPosition: 'bottom-center',
    defaultLogoPosition: 'top-center',
  },
  '16:9': {
    margin: { top: 0.08, right: 0.05, bottom: 0.12, left: 0.05 },
    ctaPositions: [
      'bottom-left',
      'bottom-center',
      'bottom-right',
      'middle-center',
    ],
    logoPositions: ['top-left', 'top-right', 'bottom-right'],
    defaultCtaPosition: 'bottom-center',
    defaultLogoPosition: 'top-right',
  },
  '1:1': {
    margin: { top: 0.08, right: 0.08, bottom: 0.12, left: 0.08 },
    ctaPositions: [
      'bottom-center',
      'bottom-left',
      'bottom-right',
      'middle-center',
    ],
    logoPositions: ['top-left', 'top-center', 'top-right'],
    defaultCtaPosition: 'bottom-center',
    defaultLogoPosition: 'top-left',
  },
};

// --- BrandOverlaySpec — the Remotion-consumable contract -----------------------

/**
 * Deterministic overlay contract consumed by the Remotion composition layer
 * (SYN-43/48 — the render pass itself is deferred). Everything here is
 * pixel-space instruction for the RENDER STEP; none of it may be interpolated
 * into an AI prompt.
 */
export interface BrandOverlaySpec {
  version: 1;
  aspectRatio: AdAspectRatio;
  colors: {
    primary: string;
    secondary: string | null;
    accent: string | null;
  };
  font: { id: BrandFontId; stack: string };
  logo: { url: string; placement: OverlayGridPosition } | null;
  cta: { text: string; position: OverlayGridPosition } | null;
  /** The safe-zone inset the composition must respect. */
  safeZone: SafeZoneSpec['margin'];
}

export interface BuildOverlayOptions {
  aspectRatio: AdAspectRatio;
  /** Defaults to the ratio's `defaultCtaPosition`. */
  ctaPosition?: OverlayGridPosition;
  /** Defaults to the ratio's `defaultLogoPosition`. */
  logoPlacement?: OverlayGridPosition;
  allowedLogoHosts?: readonly string[];
}

export type BrandOverlayBuild =
  | { ok: true; spec: BrandOverlaySpec }
  | { ok: false; issues: BrandStyleIssue[] };

/**
 * Build the deterministic BrandOverlaySpec from a flat brand style. Validates
 * the style AND that the requested CTA/logo grid cells are inside the safe
 * zone for the aspect ratio. Same input → same output, always.
 */
export function buildBrandOverlaySpec(
  input: BrandStyleInput,
  opts: BuildOverlayOptions
): BrandOverlayBuild {
  const validated = validateBrandStyle(input, {
    allowedLogoHosts: opts.allowedLogoHosts,
  });
  const issues: BrandStyleIssue[] = validated.ok ? [] : [...validated.issues];

  const zone = SAFE_ZONES[opts.aspectRatio];
  if (!zone) {
    issues.push({
      field: 'aspectRatio',
      message: `Unknown aspect ratio "${opts.aspectRatio}".`,
    });
    return { ok: false, issues };
  }

  const ctaPosition = opts.ctaPosition ?? zone.defaultCtaPosition;
  if (!zone.ctaPositions.includes(ctaPosition)) {
    issues.push({
      field: 'ctaPosition',
      message: `CTA position "${ctaPosition}" is outside the ${opts.aspectRatio} safe zone (allowed: ${zone.ctaPositions.join(', ')}).`,
    });
  }

  const logoPlacement = opts.logoPlacement ?? zone.defaultLogoPosition;
  if (!zone.logoPositions.includes(logoPlacement)) {
    issues.push({
      field: 'logoPlacement',
      message: `Logo placement "${logoPlacement}" is outside the ${opts.aspectRatio} safe zone (allowed: ${zone.logoPositions.join(', ')}).`,
    });
  }

  if (issues.length > 0 || !validated.ok) {
    return { ok: false, issues };
  }

  const style = validated.value;
  const font = getBrandFont(style.font)!;

  return {
    ok: true,
    spec: {
      version: 1,
      aspectRatio: opts.aspectRatio,
      colors: {
        primary: style.primaryColor,
        secondary: style.secondaryColor,
        accent: style.accentColor,
      },
      font: { id: font.id, stack: font.stack },
      logo: style.logoUrl
        ? { url: style.logoUrl, placement: logoPlacement }
        : null,
      cta: style.ctaText
        ? { text: style.ctaText, position: ctaPosition }
        : null,
      safeZone: { ...zone.margin },
    },
  };
}

// --- Additive composition onto AdGenerationRequest -----------------------------

/**
 * AdGenerationRequest + optional brand overlay. ADDITIVE extension only —
 * `ad-templates.ts` (closed 3-key rendering contract, locked test) is not
 * modified; the overlay rides alongside and is consumed by the render step.
 */
export interface BrandedAdGenerationRequest extends AdGenerationRequest {
  /** Applied by the Remotion render step — never by the AI model. */
  brandOverlay?: BrandOverlaySpec;
}

/**
 * The ONLY sanctioned composition point (UI layer). Pure additive spread:
 * the prompt string, seed, variables and every substrate field pass through
 * byte-identical — brand fields never enter prompt text.
 */
export function withBrandOverlay(
  request: AdGenerationRequest,
  overlay: BrandOverlaySpec
): BrandedAdGenerationRequest {
  return { ...request, brandOverlay: overlay };
}

// --- BrandDNA seeding -----------------------------------------------------------

/** The subset of the BrandDNA row the seeder reads (structural — testable). */
export interface BrandDnaSeedSource {
  businessName?: string | null;
  primaryColour?: string | null;
  secondaryColour?: string | null;
  neutralColour?: string | null;
  logoUrl?: string | null;
}

export const DEFAULT_PRESET_NAME = 'Brand default';

/** Deterministic fallback when BrandDNA has no usable primary colour. */
export const FALLBACK_PRIMARY_COLOR = '#0f172a';

export interface SeededBrandPresetInput {
  name: string;
  primaryColor: string;
  secondaryColor: string | null;
  accentColor: string | null;
  font: BrandFontId;
  logoUrl: string | null;
  ctaText: null;
  isDefault: true;
}

/**
 * Build the default BrandPreset create-input from an org's BrandDNA (or null
 * when the org has none). Invalid/missing DNA values degrade field-by-field to
 * deterministic fallbacks — the seeded preset ALWAYS passes
 * `validateBrandStyle`. Extracted logo URLs that fail the https/origin
 * allowlist are dropped (seeded as null), never smuggled through.
 */
export function seedBrandPresetFromDna(
  dna: BrandDnaSeedSource | null,
  opts: { allowedLogoHosts?: readonly string[] } = {}
): SeededBrandPresetInput {
  const allowedHosts = opts.allowedLogoHosts ?? resolveAllowedLogoHosts();
  const hexOrNull = (value: string | null | undefined): string | null =>
    value && HEX_COLOR_REGEX.test(value) ? value : null;

  const primary = hexOrNull(dna?.primaryColour) ?? FALLBACK_PRIMARY_COLOR;
  const logoUrl =
    dna?.logoUrl && isAllowedLogoUrl(dna.logoUrl, allowedHosts)
      ? dna.logoUrl
      : null;

  const businessName = dna?.businessName?.trim();
  const name = businessName
    ? `${businessName} default`.slice(0, PRESET_NAME_MAX_LENGTH)
    : DEFAULT_PRESET_NAME;

  return {
    name,
    primaryColor: primary,
    secondaryColor: hexOrNull(dna?.secondaryColour),
    accentColor: hexOrNull(dna?.neutralColour),
    font: DEFAULT_BRAND_FONT_ID,
    logoUrl,
    ctaText: null,
    isDefault: true,
  };
}
