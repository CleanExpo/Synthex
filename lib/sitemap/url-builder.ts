/**
 * Pure URL + slug builder for DR per-suburb landing pages.
 *
 * Output shape: `{baseUrl}/{serviceCategory}/{suburb-slug}/`
 *   e.g. `https://disasterrecovery.com.au/water-damage/brisbane-cbd/`
 *
 * @see SYN-840 (parent: SYN-834 epic)
 */

import type { DrServiceCategory, LocationOpenedEvent } from './types';

const DEFAULT_BASE_URL = 'https://disasterrecovery.com.au';

/**
 * Slugify a suburb name. Australian English style — lowercase, hyphenated,
 * strips punctuation, collapses whitespace.
 *
 *   "Brisbane CBD" → "brisbane-cbd"
 *   "Mount Cotton" → "mount-cotton"
 *   "St. Lucia"    → "st-lucia"
 */
export function slugifySuburb(suburb: string): string {
  if (!suburb || typeof suburb !== 'string') {
    throw new Error('slugifySuburb: suburb must be a non-empty string');
  }
  return suburb
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/[^a-z0-9\s-]/g, ' ') // strip punctuation → space
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Build the canonical landing-page URL for a (serviceCategory × suburb).
 */
export function buildLandingPageUrl(
  serviceCategory: DrServiceCategory,
  suburb: string,
  baseUrl: string = DEFAULT_BASE_URL
): string {
  const slug = slugifySuburb(suburb);
  if (!slug) {
    throw new Error(
      `buildLandingPageUrl: suburb '${suburb}' slugified to empty string`
    );
  }
  const trimmedBase = baseUrl.replace(/\/+$/, '');
  return `${trimmedBase}/${serviceCategory}/${slug}/`;
}

/**
 * Build the URL for a LocationOpened event.
 */
export function urlForEvent(
  event: LocationOpenedEvent,
  baseUrl: string = DEFAULT_BASE_URL
): string {
  return buildLandingPageUrl(event.serviceCategory, event.suburb, baseUrl);
}
