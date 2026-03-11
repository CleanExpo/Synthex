/**
 * AI Backlink Prospector — Opportunity Finder (Phase 95)
 *
 * Finds link building opportunities using Google Custom Search JSON API.
 * Free tier: 100 queries/day. $5 per 1000 queries beyond that.
 *
 * API docs: https://developers.google.com/custom-search/v1/overview
 * GET https://www.googleapis.com/customsearch/v1?key={KEY}&cx={CX}&q={QUERY}
 *
 * @module lib/backlinks/opportunity-finder
 */

import type {
  SearchOpportunity,
  BacklinkOpportunityType,
  CSEResponse,
  CSEItem,
} from './types';

const CSE_API_BASE = 'https://www.googleapis.com/customsearch/v1';

// ---------------------------------------------------------------------------
// Helper: call Google CSE API
// ---------------------------------------------------------------------------

async function searchGoogle(
  query: string,
  opportunityType: BacklinkOpportunityType
): Promise<SearchOpportunity[]> {
  const apiKey = process.env.GOOGLE_CSE_KEY;
  const cx     = process.env.GOOGLE_CSE_ID;

  if (!apiKey || !cx) {
    console.warn('[opportunity-finder] GOOGLE_CSE_KEY or GOOGLE_CSE_ID not set — skipping CSE search');
    return [];
  }

  try {
    const params = new URLSearchParams({
      key: apiKey,
      cx,
      q: query,
      num: '10',
    });

    const res = await fetch(`${CSE_API_BASE}?${params.toString()}`, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(`[opportunity-finder] CSE API returned ${res.status} for query: ${query}`);
      return [];
    }

    const data: CSEResponse = await res.json();

    if (data.error) {
      console.warn('[opportunity-finder] CSE API error:', data.error.message);
      return [];
    }

    return (data.items ?? []).map((item: CSEItem) => ({
      url: item.link,
      domain: extractDomain(item.link),
      title: item.title,
      snippet: item.snippet ?? '',
      opportunityType,
    }));
  } catch (err) {
    console.warn('[opportunity-finder] CSE search failed:', err);
    return [];
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Opportunity discovery strategies
// ---------------------------------------------------------------------------

/**
 * Find resource pages that list external links in a topic area.
 * Target: .edu, .org, .gov resource pages.
 */
export async function findResourcePages(
  topic: string,
  userDomain: string
): Promise<SearchOpportunity[]> {
  const query = `"${topic}" "resources" OR "useful links" OR "recommended sites" -site:${userDomain}`;
  return searchGoogle(query, 'resource-page');
}

/**
 * Find sites that accept guest post contributions.
 */
export async function findGuestPostSites(
  topic: string,
  userDomain: string
): Promise<SearchOpportunity[]> {
  const query = `"write for us" OR "guest post" OR "contribute" "${topic}" -site:${userDomain}`;
  return searchGoogle(query, 'guest-post');
}

/**
 * Find pages that may have broken outbound links on the given topic.
 */
export async function findBrokenLinkTargets(topic: string): Promise<SearchOpportunity[]> {
  const query = `"${topic}" "resources" OR "links" "404" OR "broken" OR "outdated"`;
  return searchGoogle(query, 'broken-link');
}

/**
 * Find domains that link to a competitor domain.
 * Note: Google CSE does not support the link: operator directly.
 * We use a heuristic: search for the competitor domain name across blogs/resources.
 */
export async function findCompetitorLinkSources(
  competitorDomain: string
): Promise<SearchOpportunity[]> {
  const cleanDomain = competitorDomain.replace(/^https?:\/\//, '').replace(/^www\./, '');
  const query = `"${cleanDomain}" -site:${cleanDomain} "resources" OR "recommended" OR "tools"`;
  return searchGoogle(query, 'competitor-link');
}

/**
 * Find journalist mentions and editorial coverage of a brand/topic.
 */
export async function findJournalistMentions(
  brandName: string,
  topic: string
): Promise<SearchOpportunity[]> {
  const query = `"${brandName}" "${topic}" site:*.com OR site:*.com.au OR site:*.co.uk -site:${brandName.toLowerCase().replace(/\s+/g, '')}`;
  return searchGoogle(query, 'journalist-mention');
}

// ---------------------------------------------------------------------------
// Aggregate finder: run all strategies in parallel
// ---------------------------------------------------------------------------

export interface FindOpportunitiesParams {
  topic: string;
  userDomain: string;
  brandName?: string;
  competitorDomains?: string[];
}

/**
 * Run all five opportunity-finding strategies in parallel and deduplicate results.
 */
export async function findAllOpportunities(
  params: FindOpportunitiesParams
): Promise<SearchOpportunity[]> {
  const { topic, userDomain, brandName, competitorDomains = [] } = params;

  const searches: Promise<SearchOpportunity[]>[] = [
    findResourcePages(topic, userDomain),
    findGuestPostSites(topic, userDomain),
    findBrokenLinkTargets(topic),
  ];

  if (brandName) {
    searches.push(findJournalistMentions(brandName, topic));
  }

  for (const competitor of competitorDomains.slice(0, 2)) {
    searches.push(findCompetitorLinkSources(competitor));
  }

  const results = await Promise.allSettled(searches);
  const all: SearchOpportunity[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      all.push(...result.value);
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  return all.filter(item => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}
