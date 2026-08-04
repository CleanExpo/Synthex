/**
 * Read-only brand-asset preflight — SYN-1113.
 *
 * Answers one question before a render job is created: is this brand actually
 * fit to put in front of someone? Three ways it is not, all of which previously
 * passed silently:
 *
 *   1. **The brand is not a brand.** `POST /api/brand-video/generate` took
 *      `brand: z.string().max(120)`, so any free string was accepted, stored and
 *      rendered. The worker never resolved it against `brand-config` — it used
 *      the value exactly once, in a log line — so "Coca-Cola" or "asdf" produced
 *      a video with no brand colour, logo, type or voice, and reported success.
 *   2. **The brand's tokens are unapproved.** `john-coutis` carries
 *      `tokenStatus: 'proposal'`.
 *   3. **The brand's declared logo files do not exist.** 21 such paths are
 *      recorded in `brand-logo-baseline.json` (SYN-1133); no runtime code reads
 *      `brand.logo`, so a missing file never errored.
 *
 * Read-only and pure: no filesystem, no network. Logo presence is read from the
 * committed baseline rather than `fs`, deliberately — `public/` is not readable
 * from a Vercel serverless function, which is the same trap that once silently
 * emptied the reference library in production (see `reference-library.ts`).
 */
import { brands, type BrandSlug } from '@unite-group/brand-config';

import logoBaseline from '@/brand-logo-baseline.json';

export type PreflightCode =
  | 'unknown-brand'
  | 'unapproved-tokens'
  | 'missing-logo-assets';

export interface PreflightFinding {
  code: PreflightCode;
  /** Operator-facing, safe to store on a job's `error` column. */
  message: string;
}

export interface PreflightResult {
  ok: boolean;
  /** Set only when the slug resolved, so callers can use the config directly. */
  slug: BrandSlug | null;
  /** Blocking. */
  findings: PreflightFinding[];
  /** Non-blocking: worth surfacing, not worth refusing over. */
  warnings: PreflightFinding[];
}

const KNOWN_SLUGS = Object.keys(brands) as BrandSlug[];

/** Baseline paths are relative to `public/`, matching `brand.logo` values. */
const MISSING_LOGO_PATHS = new Set<string>(logoBaseline.missing);

/**
 * `findings` block the run; `warnings` do not.
 *
 * A missing logo is a warning rather than a blocker because no runtime code
 * reads `brand.logo` today, so blocking on it would refuse work that never
 * depended on the file. It still needs saying — silence is how 21 of them went
 * missing without anyone noticing.
 */
export function preflightBrandAssets(brand: string): PreflightResult {
  const slug = normaliseSlug(brand);

  if (!slug) {
    return {
      ok: false,
      slug: null,
      findings: [
        {
          code: 'unknown-brand',
          message:
            `Unknown brand "${brand}". Expected one of: ${KNOWN_SLUGS.join(', ')}. ` +
            `A brand outside brand-config has no colour, logo, typography or voice to apply.`,
        },
      ],
      warnings: [],
    };
  }

  const config = brands[slug];
  const findings: PreflightFinding[] = [];
  const warnings: PreflightFinding[] = [];

  if (config.tokenStatus === 'proposal') {
    findings.push({
      code: 'unapproved-tokens',
      message:
        `Brand "${slug}" has tokenStatus 'proposal' — its colours, typography and ` +
        `voice are not signed off, so they must not be used for client-facing output.`,
    });
  }

  const absentLogos = (['primary', 'inverted', 'icon'] as const)
    .map(variant => config.logo[variant])
    .filter(path => MISSING_LOGO_PATHS.has(path));

  if (absentLogos.length > 0) {
    warnings.push({
      code: 'missing-logo-assets',
      message:
        `Brand "${slug}" declares ${absentLogos.length} logo file(s) that do not ` +
        `exist: ${absentLogos.join(', ')}. Anything compositing a logo will omit it.`,
    });
  }

  return { ok: findings.length === 0, slug, findings, warnings };
}

/** Accepts the exact slug, or a display-name-ish variant, case-insensitively. */
function normaliseSlug(brand: string): BrandSlug | null {
  const candidate = brand.trim().toLowerCase().replace(/\s+/g, '-');

  return KNOWN_SLUGS.find(slug => slug === candidate) ?? null;
}
