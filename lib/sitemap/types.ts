/**
 * Sitemap regeneration types.
 *
 * Foundation primitive for SYN-840 — keeps the
 * disasterrecovery.com.au sitemap.xml in sync with newly-generated
 * per-suburb landing pages so AI crawlers + Bing/Google can discover
 * them.
 *
 * @see SYN-840 (parent: SYN-834 epic)
 * @see lib/sitemap/README.md
 */

/**
 * Service categories DR generates per-suburb landing pages for.
 * Mirrors SYN-838 page-generator scope.
 */
export type DrServiceCategory = 'water-damage' | 'fire' | 'mould';

export const DR_SERVICE_CATEGORIES: readonly DrServiceCategory[] = [
  'water-damage',
  'fire',
  'mould',
] as const;

/**
 * The `LocationOpened` event emitted by SYN-838 (page generator) once
 * per (suburb × serviceCategory) combo. We define the shape here so
 * SYN-840 can compile and test independently of SYN-838.
 */
export interface LocationOpenedEvent {
  /** Source-of-truth job ID propagated from contractor onboarding (Q3.2.4 H8). */
  sourceOfTruthJobId: string;
  serviceAreaCoverageId: string;
  suburb: string;
  postcode: string;
  serviceCategory: DrServiceCategory;
  /** ISO timestamp of when the page was committed. */
  openedAt: string;
}

/**
 * A sitemap entry — minimal W3C urlset shape.
 *
 * @see https://www.sitemaps.org/protocol.html
 */
export interface SitemapUrl {
  /** Full URL e.g. `https://disasterrecovery.com.au/water-damage/brisbane-cbd/`. */
  loc: string;
  /** ISO 8601 last-modified timestamp. */
  lastmod: string;
  /** Optional change frequency hint. */
  changefreq?:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never';
  /** Optional priority 0.0 – 1.0. */
  priority?: number;
}

/**
 * Result of a sitemap regeneration cycle.
 */
export interface SitemapRegenResult {
  /** Updated sitemap XML (W3C urlset). */
  xml: string;
  /** URLs that were appended this cycle (idempotent — empty if no new urls). */
  added: SitemapUrl[];
  /** URLs that already existed and were left untouched. */
  skipped: SitemapUrl[];
  /** Total URL count after merge. */
  totalUrls: number;
}

/**
 * Search-engine ping targets.
 */
export type PingTarget = 'google' | 'bing';

/**
 * Result of a single ping attempt.
 */
export interface PingResult {
  target: PingTarget;
  /** True iff the ping was sent (false if rate-limited or failed). */
  pinged: boolean;
  /** Reason for skip — present iff pinged=false. */
  reason?: string;
  /** ISO timestamp of the attempt. */
  attemptedAt: string;
  /** HTTP status code if the ping went out. */
  status?: number;
}

/**
 * Options for the regen cycle (testing + per-call overrides).
 */
export interface SitemapRegenOptions {
  /** Override the base URL — defaults to `https://disasterrecovery.com.au`. */
  baseUrl?: string;
  /**
   * Override the changefreq hint applied to new entries.
   * Defaults to `monthly`.
   */
  changefreq?: SitemapUrl['changefreq'];
  /**
   * Override the priority applied to new entries. Defaults to `0.6`.
   */
  priority?: number;
  /**
   * Override `lastmod` for new entries. Defaults to `new Date().toISOString()`.
   * Useful for deterministic tests.
   */
  now?: () => Date;
}
