/**
 * AI Backlink Prospector — Domain Scorer (Phase 95)
 *
 * Scores domains using OpenPageRank API (free, 100 req/day).
 * Falls back to heuristic scoring when API is unavailable or quota exceeded.
 *
 * OpenPageRank API: https://www.openpagerank.com/resources/api-documentation/
 * GET https://openpagerank.com/api/v1.0/getPageRank?domains[0]=example.com&domains[1]=other.com
 * Header: API-OPR: {OPEN_PAGE_RANK_API_KEY}
 *
 * @module lib/backlinks/domain-scorer
 */

import type { ScoredDomain, OPRResponse } from './types';

const OPR_API_BASE = 'https://openpagerank.com/api/v1.0';
const OPR_MAX_BATCH = 100; // API limit per request

// ---------------------------------------------------------------------------
// Heuristic domain authority scoring
// ---------------------------------------------------------------------------

/**
 * Estimate domain authority using TLD and domain name patterns.
 * Used as fallback when OpenPageRank API is unavailable.
 */
export function heuristicScore(domain: string): number {
  const lower = domain.toLowerCase();

  // TLD-based scoring
  if (lower.endsWith('.gov') || lower.endsWith('.gov.au'))  return 92;
  if (lower.endsWith('.edu') || lower.endsWith('.edu.au'))  return 87;
  if (lower.endsWith('.ac.uk') || lower.endsWith('.ac.nz'))  return 85;
  if (lower.endsWith('.org.au') || lower.endsWith('.org'))  return 60;
  if (lower.endsWith('.com.au'))                            return 45;
  if (lower.endsWith('.net'))                               return 40;
  if (lower.endsWith('.co.uk') || lower.endsWith('.co.nz')) return 42;
  if (lower.endsWith('.io'))                                return 38;
  if (lower.endsWith('.co'))                                return 35;

  // Known high-authority domain patterns
  const highAuthority = [
    'wikipedia', 'forbes', 'techcrunch', 'entrepreneur', 'inc.com',
    'businessinsider', 'mashable', 'wired', 'reuters', 'bbc',
    'guardian', 'huffpost', 'medium', 'substack', 'nytimes',
    'linkedin', 'hubspot', 'moz', 'semrush', 'ahrefs',
  ];
  if (highAuthority.some(h => lower.includes(h))) return 75;

  // Default for .com
  return 30;
}

// ---------------------------------------------------------------------------
// OpenPageRank API integration
// ---------------------------------------------------------------------------

/**
 * Score a single domain using OpenPageRank API.
 * Falls back to heuristic scoring on error.
 */
export async function scoreDomain(domain: string): Promise<ScoredDomain> {
  const results = await scoreDomains([domain]);
  return results[0]!;
}

/**
 * Score multiple domains in a single API call (max 100 per request).
 * Falls back to heuristic scoring if API key is missing or call fails.
 */
export async function scoreDomains(domains: string[]): Promise<ScoredDomain[]> {
  const apiKey = process.env.OPEN_PAGE_RANK_API_KEY;

  // If no API key, return heuristic scores for all domains
  if (!apiKey) {
    return domains.map(domain => ({
      domain,
      domainAuthority: heuristicScore(domain),
      pageRank: 0,
      source: 'heuristic' as const,
    }));
  }

  // Process in batches of OPR_MAX_BATCH
  const batches: string[][] = [];
  for (let i = 0; i < domains.length; i += OPR_MAX_BATCH) {
    batches.push(domains.slice(i, i + OPR_MAX_BATCH));
  }

  const results: ScoredDomain[] = [];

  for (const batch of batches) {
    try {
      const params = new URLSearchParams();
      batch.forEach((d, i) => params.append(`domains[${i}]`, d));

      const res = await fetch(`${OPR_API_BASE}/getPageRank?${params.toString()}`, {
        headers: { 'API-OPR': apiKey },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        throw new Error(`OpenPageRank API error: ${res.status}`);
      }

      const data: OPRResponse = await res.json();

      for (const item of data.response) {
        if (item.status_code === 200) {
          results.push({
            domain: item.domain,
            domainAuthority: Math.min(100, Math.round(item.page_rank_decimal * 10)),
            pageRank: item.page_rank_decimal,
            source: 'openpagerank',
          });
        } else {
          // Fallback for individual domain failure
          results.push({
            domain: item.domain,
            domainAuthority: heuristicScore(item.domain),
            pageRank: 0,
            source: 'heuristic',
          });
        }
      }
    } catch (err) {
      console.warn('[domain-scorer] OpenPageRank API failed, using heuristics:', err);
      // Fall back to heuristic for this batch
      for (const domain of batch) {
        results.push({
          domain,
          domainAuthority: heuristicScore(domain),
          pageRank: 0,
          source: 'heuristic',
        });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Authority tier classifier
// ---------------------------------------------------------------------------

export function getDomainAuthorityTier(da: number): 'high' | 'medium' | 'low' {
  if (da >= 70) return 'high';
  if (da >= 40) return 'medium';
  return 'low';
}
