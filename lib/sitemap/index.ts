/**
 * lib/sitemap — public entry point.
 *
 * SYN-840 sitemap.xml regeneration for the SYN-834 NRPG → DR pipeline.
 * Pure XML merge + the retired Google/Bing ping client (sends nothing;
 * every result is reported as retired).
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
