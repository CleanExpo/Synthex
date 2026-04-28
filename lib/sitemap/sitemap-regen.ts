/**
 * Sitemap regeneration — main API for SYN-840.
 *
 *   regenerateSitemapForLocations(currentXml, events, opts?)
 *     → { xml, added, skipped, totalUrls }
 *
 * Pure function: takes the current sitemap.xml and a batch of
 * LocationOpened events, returns the merged sitemap and the diff. The
 * caller is responsible for the actual file write / cross-repo PR /
 * Google + Bing ping (use `pingAllSearchEngines` for the latter).
 *
 * Idempotent — re-running with the same events does not duplicate URLs.
 *
 * @see SYN-840 (parent: SYN-834 epic)
 * @see lib/sitemap/README.md
 */

import { logger } from '@/lib/logger';
import { urlForEvent } from './url-builder';
import { buildSitemap, parseSitemap } from './xml';
import type {
  LocationOpenedEvent,
  SitemapRegenOptions,
  SitemapRegenResult,
  SitemapUrl,
} from './types';

const DEFAULT_BASE_URL = 'https://disasterrecovery.com.au';
const DEFAULT_CHANGEFREQ: SitemapUrl['changefreq'] = 'monthly';
const DEFAULT_PRIORITY = 0.6;

/**
 * Merge a batch of LocationOpened events into the current sitemap XML.
 *
 * Idempotency rule: a URL is considered "already present" iff its `loc`
 * matches an existing entry. lastmod is NOT updated for existing
 * entries — reopening the same suburb does not bump the date. Caller
 * who explicitly wants a lastmod refresh should remove the entry first.
 *
 * @throws Error on invalid event input (validates each event before merge).
 */
export function regenerateSitemapForLocations(
  currentXml: string,
  events: LocationOpenedEvent[],
  opts: SitemapRegenOptions = {}
): SitemapRegenResult {
  if (!Array.isArray(events)) {
    throw new Error('regenerateSitemapForLocations: events must be an array');
  }
  for (const e of events) {
    validateEvent(e);
  }

  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const changefreq = opts.changefreq ?? DEFAULT_CHANGEFREQ;
  const priority =
    typeof opts.priority === 'number' ? opts.priority : DEFAULT_PRIORITY;
  const now = (opts.now ?? (() => new Date()))();
  const lastmod = now.toISOString();

  const existing = parseSitemap(currentXml);
  const existingByLoc = new Map(existing.map(u => [u.loc, u]));

  const added: SitemapUrl[] = [];
  const skipped: SitemapUrl[] = [];
  const seenThisBatch = new Set<string>();

  for (const event of events) {
    const loc = urlForEvent(event, baseUrl);
    if (seenThisBatch.has(loc)) continue;
    seenThisBatch.add(loc);

    if (existingByLoc.has(loc)) {
      skipped.push(existingByLoc.get(loc)!);
      continue;
    }
    const entry: SitemapUrl = { loc, lastmod, changefreq, priority };
    added.push(entry);
    existingByLoc.set(loc, entry);
  }

  const merged = Array.from(existingByLoc.values());
  const xml = buildSitemap(merged);

  logger.info('[sitemap.regen] merge complete', {
    baseUrl,
    eventCount: events.length,
    addedCount: added.length,
    skippedCount: skipped.length,
    totalUrls: merged.length,
  });

  return {
    xml,
    added,
    skipped,
    totalUrls: merged.length,
  };
}

function validateEvent(event: LocationOpenedEvent): void {
  if (!event || typeof event !== 'object') {
    throw new Error('regenerateSitemapForLocations: event required');
  }
  if (!event.sourceOfTruthJobId) {
    throw new Error(
      'regenerateSitemapForLocations: sourceOfTruthJobId required (Q3.2.4 H8)'
    );
  }
  if (!event.serviceAreaCoverageId) {
    throw new Error(
      'regenerateSitemapForLocations: serviceAreaCoverageId required'
    );
  }
  if (!event.suburb) {
    throw new Error('regenerateSitemapForLocations: suburb required');
  }
  if (!event.serviceCategory) {
    throw new Error('regenerateSitemapForLocations: serviceCategory required');
  }
  if (!['water-damage', 'fire', 'mould'].includes(event.serviceCategory)) {
    throw new Error(
      `regenerateSitemapForLocations: serviceCategory must be water-damage, fire, or mould (got '${event.serviceCategory}')`
    );
  }
}
