/**
 * lib/sitemap — public entry point.
 *
 * SYN-840 sitemap.xml regeneration for the SYN-834 NRPG → DR pipeline.
 * Pure XML merge + Google/Bing ping client (rate-limited 1/hour per
 * target).
 *
 * @see SYN-840 (parent: SYN-834 epic)
 * @see lib/sitemap/README.md
 */

export { DR_SERVICE_CATEGORIES } from './types';

export type {
  DrServiceCategory,
  LocationOpenedEvent,
  PingResult,
  PingTarget,
  SitemapRegenOptions,
  SitemapRegenResult,
  SitemapUrl,
} from './types';

export { buildLandingPageUrl, slugifySuburb, urlForEvent } from './url-builder';

export { buildSitemap, parseSitemap } from './xml';

export { regenerateSitemapForLocations } from './sitemap-regen';

export { pingAllSearchEngines, pingSearchEngine } from './ping-client';
