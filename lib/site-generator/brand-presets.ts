/**
 * Per-business SiteBrand presets — the brand half of the Phase 3 template
 * library.
 *
 * `generateSite` consumes a `SiteBrand` (the structural slice of BrandConfig
 * it actually reads); these presets DERIVE that slice from the canonical
 * portfolio registry `@unite-group/brand-config` — the single source of truth
 * for display/legal names, taglines, and brand-voice forbidden words — so the
 * generator never duplicates (and never drifts from) the estate's brand
 * identity.
 *
 * Preset slugs follow the portfolio tenant slugs in
 * `lib/agency/portfolio-brand-configs.ts` ('disaster-recovery',
 * 'restoreassist', ...) rather than the short BrandConfig slugs ('dr', 'ra')
 * — the site generator addresses businesses, not video-pipeline brand keys.
 *
 * `logoPrimary` is intentionally omitted: BrandConfig `logo.primary` is a
 * repo-relative asset path ('logos/dr/primary.svg'), not the absolute URL the
 * JSON-LD `logo` field requires. The profile's own `logoUrl` supplies it.
 */

import { carsi, dr, nrpg, ra } from '@unite-group/brand-config';

import type { SiteBrand } from './types';

/** The registry fields a preset derives from (structural, not BrandConfig). */
interface BrandSource {
  displayName: string;
  legalName: string;
  tagline: string;
  voice: { forbiddenWords: readonly string[] };
}

/**
 * Map a registry brand to the SiteBrand slice the generator consumes.
 * forbiddenWords are lower-cased and de-duplicated to match the SiteBrand
 * contract ("lower-cased words the copy must never contain").
 */
function toSiteBrand(slug: string, source: BrandSource): SiteBrand {
  return {
    slug,
    displayName: source.displayName,
    legalName: source.legalName,
    tagline: source.tagline,
    forbiddenWords: [
      ...new Set(source.voice.forbiddenWords.map(w => w.toLowerCase())),
    ],
  };
}

export const SITE_BRAND_PRESETS: readonly SiteBrand[] = [
  toSiteBrand('carsi', carsi),
  toSiteBrand('disaster-recovery', dr),
  toSiteBrand('nrpg', nrpg),
  toSiteBrand('restoreassist', ra),
];

/** Look up a preset by its business slug, e.g. 'disaster-recovery'. */
export function getSiteBrandPreset(slug: string): SiteBrand | undefined {
  return SITE_BRAND_PRESETS.find(p => p.slug === slug);
}
