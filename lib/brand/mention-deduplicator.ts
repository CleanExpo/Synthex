/**
 * Brand Builder — Mention Deduplicator
 *
 * URL-based deduplication using canonical URL normalisation.
 * Uses a simple djb2 hash for DB unique constraint (not for security).
 *
 * @module lib/brand/mention-deduplicator
 */

import type { RawMention } from './types';

// ---------------------------------------------------------------------------
// URL Normalisation
// ---------------------------------------------------------------------------

/** Parameters to strip for canonical URL comparison */
const STRIP_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'ref', 'src', 'source', 'fbclid', 'gclid', 'msclkid',
  '_ga', 'mc_cid', 'mc_eid',
]);

/**
 * Normalise a URL for deduplication:
 * - Lowercase origin + pathname
 * - Strip tracking/UTM parameters
 * - Remove trailing slashes
 */
export function normaliseUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);

    // Keep only non-tracking params, sorted for consistency
    const cleaned = new URLSearchParams();
    const sorted = [...u.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [key, value] of sorted) {
      if (!STRIP_PARAMS.has(key.toLowerCase())) {
        cleaned.set(key, value);
      }
    }

    const cleanedSearch = cleaned.toString();
    const pathname = u.pathname.replace(/\/+$/, ''); // remove trailing slashes

    const normalised = `${u.protocol}//${u.host.toLowerCase()}${pathname}${cleanedSearch ? '?' + cleanedSearch : ''}`;
    return normalised.toLowerCase();
  } catch {
    // If URL parsing fails, normalise minimally
    return rawUrl.toLowerCase().replace(/\/+$/, '');
  }
}

// ---------------------------------------------------------------------------
// URL Hash (djb2-style — not for security)
// ---------------------------------------------------------------------------

/**
 * Compute a compact, deterministic hash of a normalised URL.
 * Uses djb2 algorithm — suitable for DB deduplication (not cryptographic).
 */
export function urlHash(url: string): string {
  const normalised = normaliseUrl(url);
  let hash = 5381;
  for (let i = 0; i < normalised.length; i++) {
    hash = ((hash << 5) + hash) ^ normalised.charCodeAt(i);
    hash = hash & 0xffffffff; // force 32-bit
  }
  // Convert to unsigned and base36 for compact representation
  return (hash >>> 0).toString(36);
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

/**
 * Deduplicate a list of RawMentions by normalised URL.
 * When duplicates exist, prefer the one with more data (description, publishedAt).
 * Returns deduplicated array sorted by publishedAt (most recent first).
 */
export function deduplicateMentions(mentions: RawMention[]): RawMention[] {
  const seen = new Map<string, RawMention>();

  for (const mention of mentions) {
    const key = normaliseUrl(mention.url);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, mention);
    } else {
      // Prefer the entry with more data
      const existingScore = (existing.description ? 1 : 0) + (existing.publishedAt ? 1 : 0);
      const newScore      = (mention.description  ? 1 : 0) + (mention.publishedAt  ? 1 : 0);
      if (newScore > existingScore) {
        seen.set(key, mention);
      }
    }
  }

  const results = [...seen.values()];

  // Sort by publishedAt descending (nulls last)
  results.sort((a, b) => {
    if (!a.publishedAt && !b.publishedAt) return 0;
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return b.publishedAt.localeCompare(a.publishedAt);
  });

  return results;
}
