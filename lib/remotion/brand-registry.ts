/**
 * Brand Registry — bridges the two brand systems used in Synthex.
 *
 * SYSTEM A — `BrandContent` (this directory, `brand-content.ts`)
 *   Per-brand video script + publishing metadata: brandColour, brandName,
 *   tagline, valueProps, hookText, youtubeDescription, hashtags, twitterText,
 *   linkedinText, etc. Used by the existing Remotion pipeline + render service
 *   to produce BrandShowcase / BrandReel / BrandSquare videos and publish them.
 *
 * SYSTEM B — `BrandConfig` (workspace package `@unite-group/brand-config`)
 *   Canonical brand identity primitives: voice (tone, forbiddenWords, cadence),
 *   colour system (primary/secondary/accent + neutral + semantic), typography,
 *   logo, motion (signature, easing, durations, transitionFrames), voiceover
 *   (ElevenLabs voiceId, locale), doNot list, audience, defaultChannel.
 *   Consumed by the Pi-CEO marketing-* and remotion-* skills (globally
 *   installed at `~/.claude/skills/`).
 *
 * The two systems are complementary, not duplicates. SYSTEM A holds video
 * publishing copy; SYSTEM B holds brand identity. This module gives consumers
 * a single entry point that can resolve either side from either ID.
 *
 * Known divergences (as of 2026-05-05):
 *   - `BrandContent.id` uses kebab strings like `'disaster-recovery'` and
 *     `'restore-assist'`; `BrandConfig.slug` uses short codes like `'dr'`
 *     and `'ra'`. The slug map below is the source of truth.
 *   - Several `BrandConfig` files in `@unite-group/brand-config/src/brands/`
 *     are explicitly marked as stubs ("STUB — refined by remotion-brand-research
 *     before first render."). Until those stubs are filled in, do NOT swap
 *     production colour / copy values from `BrandContent` for `BrandConfig`
 *     equivalents — the visual output will change.
 * Migration path:
 *   1. (this PR) Add the registry — both systems queryable from one place
 *   2. Refine `BrandConfig` stubs to match production values
 *   3. Once stubs match, migrate overlapping fields one at a time:
 *      brandColour → BrandConfig.colour.primary, brandName → displayName,
 *      tagline → tagline. Each step is its own PR with visual verification.
 *
 * Linear: SYN-898 (parent: SYN-806)
 */

import { brands, type BrandConfig, type BrandSlug } from '@unite-group/brand-config';

import { BRAND_CONTENT, type BrandContent } from './brand-content';

// ── Slug map — BrandContent.id → BrandConfig.slug ──────────────────────────
//
// The keys here MUST match the `id` values in `brand-content.ts`. Adding a
// new BrandContent entry without an entry here means `getBrandConfig()` will
// return undefined for it.

export const BRAND_SLUG_MAP: Readonly<Record<string, BrandSlug>> = Object.freeze({
  'disaster-recovery': 'dr',
  carsi: 'carsi',
  nrpg: 'nrpg',
  synthex: 'synthex',
  'restore-assist': 'ra',
  'unite-group': 'unite',
});

// ── Forward lookup: BrandContent.id → BrandConfig ──────────────────────────

/**
 * Resolve the canonical `BrandConfig` for a video-pipeline `BrandContent.id`.
 * Returns `undefined` if the ID has no slug mapping or the slug has no
 * BrandConfig entry.
 *
 * @example
 *   getBrandConfig('disaster-recovery')?.voice.tone
 *   // → ['authoritative', 'urgent']  (once the dr stub is filled in)
 */
export function getBrandConfig(brandContentId: string): BrandConfig | undefined {
  const slug = BRAND_SLUG_MAP[brandContentId];
  if (!slug) return undefined;
  return brands[slug];
}

// ── Slug helper: BrandContent.id → BrandSlug ───────────────────────────────

/**
 * Resolve the canonical `BrandSlug` for a video-pipeline `BrandContent.id`.
 * Returns `undefined` if the ID has no slug mapping. Useful when you need
 * the slug for routing / file paths but not the full config.
 */
export function getBrandSlug(brandContentId: string): BrandSlug | undefined {
  return BRAND_SLUG_MAP[brandContentId];
}

// ── Reverse lookup: BrandSlug → BrandContent ───────────────────────────────

/**
 * Resolve the video-pipeline `BrandContent` for a canonical `BrandSlug`.
 * Returns `undefined` for slugs that have no BrandContent entry.
 */
export function getBrandContent(slug: BrandSlug): BrandContent | undefined {
  // Build a reverse map once per module load. BRAND_SLUG_MAP is small (<10
  // entries) so the cost is negligible; doing this lazily keeps the module's
  // top-level work minimal.
  for (const [contentId, mappedSlug] of Object.entries(BRAND_SLUG_MAP)) {
    if (mappedSlug === slug) {
      return BRAND_CONTENT.find(b => b.id === contentId);
    }
  }
  return undefined;
}

// ── Combined view: both systems for a single brand ─────────────────────────

export interface PortfolioBrand {
  /** `BrandConfig.slug` — the canonical short code. */
  slug: BrandSlug;
  /** Brand identity primitives (voice / colour / typography / motion). */
  config: BrandConfig;
  /** Video script + publishing metadata. May be undefined for unmapped slugs. */
  content: BrandContent | undefined;
}

/**
 * Resolve both systems for a slug. Returns `undefined` only if the slug
 * itself is invalid (i.e. not in `BrandConfig`).
 */
export function getPortfolioBrand(slug: BrandSlug): PortfolioBrand | undefined {
  const config = brands[slug];
  if (!config) return undefined;
  return {
    slug,
    config,
    content: getBrandContent(slug),
  };
}
