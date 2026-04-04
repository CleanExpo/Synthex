/**
 * PR Journalist CRM — Coverage Linker (Phase 92)
 *
 * Matches raw coverage (from mention-poller.ts) against open pitches
 * by comparing outlet domains. Returns the pitchId if a match is found.
 *
 * @module lib/pr/coverage-linker
 */

import type { RawCoverage } from './types';
import type { PRPitch, JournalistContact } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal shape needed for linking — pitch + journalist outlet domain */
export type PitchWithJournalist = PRPitch & {
  journalist: Pick<JournalistContact, 'outletDomain'>;
};

// ---------------------------------------------------------------------------
// Domain normalisation helper
// ---------------------------------------------------------------------------

/**
 * Extract and normalise a domain from a URL or domain string.
 * Strips www. prefix, lowercases, trims whitespace.
 */
function normaliseDomain(input: string): string {
  let domain = input.toLowerCase().trim();

  // If it looks like a URL, extract the hostname
  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    try {
      domain = new URL(domain).hostname;
    } catch {
      // Not a valid URL — use as-is
    }
  }

  // Strip www. prefix
  domain = domain.replace(/^www\./, '');

  return domain;
}

// ---------------------------------------------------------------------------
// Main linking function
// ---------------------------------------------------------------------------

/**
 * Match a single coverage item against a list of open pitches.
 *
 * Matching logic: the coverage's outlet domain must match the journalist's
 * outlet domain for the pitch. Only considers pitches with status
 * 'sent', 'opened', or 'replied' — i.e. actively in-flight pitches.
 *
 * @param coverage - Raw coverage item (URL, outlet, etc.)
 * @param pitches - Array of open pitches with journalist data
 * @returns The matched pitchId, or null if no match
 */
export function linkCoverage(
  coverage: RawCoverage,
  pitches: PitchWithJournalist[]
): string | null {
  const coverageDomain = normaliseDomain(coverage.outletDomain || coverage.url);

  // Only match against actively in-flight pitches
  const openStatuses = new Set(['sent', 'opened', 'replied']);
  const openPitches = pitches.filter((p) => openStatuses.has(p.status));

  for (const pitch of openPitches) {
    const journalistDomain = normaliseDomain(pitch.journalist.outletDomain);
    if (journalistDomain && coverageDomain && journalistDomain === coverageDomain) {
      return pitch.id;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Batch linking
// ---------------------------------------------------------------------------

/**
 * Link multiple coverage items against open pitches.
 * Returns a map of coverage URL → pitchId for matched items.
 *
 * @param coverageItems - Array of raw coverage items
 * @param pitches - Array of open pitches with journalist data
 * @returns Map of coverage URL to pitchId
 */
export function linkCoverageBatch(
  coverageItems: RawCoverage[],
  pitches: PitchWithJournalist[]
): Map<string, string> {
  const results = new Map<string, string>();

  for (const coverage of coverageItems) {
    const pitchId = linkCoverage(coverage, pitches);
    if (pitchId) {
      results.set(coverage.url, pitchId);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// URL hash generator (matches BrandMention pattern)
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic hash for a URL for deduplication.
 * Uses the same djb2-style approach as BrandMention.urlHash.
 */
export function hashUrl(url: string): string {
  // Normalise: lowercase, strip trailing slash, strip query params
  let normalised = url.toLowerCase().trim();
  try {
    const parsed = new URL(normalised);
    // Keep only scheme + host + pathname for dedup
    normalised = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`.replace(/\/$/, '');
  } catch {
    // Not a valid URL — hash as-is
  }

  // Simple djb2 hash (same family as BrandMention)
  let hash = 5381;
  for (let i = 0; i < normalised.length; i++) {
    hash = ((hash << 5) + hash) + normalised.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
