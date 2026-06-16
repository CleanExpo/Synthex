/**
 * Website Discovery (SYN-1022)
 *
 * Given only a business NAME (no URL), perform a conservative discovery pass to
 * find the most likely official website. Returns one confident match for the
 * user to confirm, a shortlist to choose from when ambiguous, or an explicit
 * "needs your website" marker — never a silent guess.
 *
 * Uses the already-installed Firecrawl search API (FIRECRAWL_API_KEY). When the
 * key is absent, discovery degrades to asking the user for the URL rather than
 * fabricating one.
 *
 * @module lib/ai/discover-website
 */

import { logger } from '@/lib/logger';
import { validateExternalUrl } from '@/lib/security/validate-url';

export interface DiscoveryCandidate {
  url: string;
  title: string;
  description: string;
  /** Relative confidence score (higher = stronger match). */
  score: number;
}

export interface DiscoveryResult {
  /**
   * resolved   — one clear winner; caller should CONFIRM before scraping.
   * review     — ambiguous; present candidates for the user to choose.
   * unavailable— no usable result / no search key; ask the user for the URL.
   */
  status: 'resolved' | 'review' | 'unavailable';
  /** Set only when status === 'resolved'. */
  url?: string;
  /** Ranked shortlist (≤5) when status is 'resolved' or 'review'. */
  candidates: DiscoveryCandidate[];
  /** Field markers needing user input when status === 'unavailable'. */
  dataRequired: string[];
}

/** Directories / social / aggregators are never treated as the official site. */
const AGGREGATOR_HOSTS = [
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'tiktok.com',
  'pinterest.com',
  'yelp.com',
  'yellowpages.com.au',
  'tripadvisor.com',
  'wikipedia.org',
  'google.com',
  'maps.google.com',
  'crunchbase.com',
  'indeed.com',
  'glassdoor.com',
  'trustpilot.com',
];

/** Margin a top candidate must beat the runner-up by to be a "clear winner". */
const CLEAR_WINNER_MARGIN = 20;

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Score a search result against the business name. Rewards higher search rank,
 * name tokens appearing in the domain (strongest signal), and name tokens in
 * the page title.
 */
function scoreCandidate(
  businessName: string,
  rank: number,
  url: string,
  title: string
): number {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 0;
  }

  let score = Math.max(0, 40 - rank * 8); // search-position weight

  const nameTokens = new Set(tokenize(businessName));
  const domainLabel = host.replace(/\.[a-z.]+$/, '');
  const domainHits = tokenize(domainLabel).filter(t => nameTokens.has(t)).length;
  score += domainHits * 30;

  const titleTokens = new Set(tokenize(title));
  const titleHits = [...nameTokens].filter(t => titleTokens.has(t)).length;
  score += Math.min(20, titleHits * 5);

  return score;
}

function isAggregator(host: string): boolean {
  return AGGREGATOR_HOSTS.some(a => host === a || host.endsWith('.' + a));
}

export async function discoverWebsite(
  businessName: string
): Promise<DiscoveryResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    logger.info('[discover] FIRECRAWL_API_KEY absent — asking user for URL');
    return { status: 'unavailable', candidates: [], dataRequired: ['website'] };
  }

  try {
    const { default: FirecrawlApp } = await import('@mendable/firecrawl-js');
    const firecrawl = new FirecrawlApp({ apiKey });

    const res = await firecrawl.search(`${businessName} official website`, {
      limit: 8,
    } as Parameters<typeof firecrawl.search>[1]);

    const web = (res?.web ?? []) as Array<{
      url?: string;
      title?: string;
      description?: string;
    }>;

    const seenHosts = new Set<string>();
    const candidates: DiscoveryCandidate[] = [];

    web.forEach((r, i) => {
      if (!r.url) return;
      let host: string;
      try {
        host = new URL(r.url).hostname.replace(/^www\./, '');
      } catch {
        return;
      }
      if (isAggregator(host) || seenHosts.has(host)) return;
      // SSRF guard — never surface a private/loopback/metadata URL as a candidate.
      try {
        validateExternalUrl(r.url);
      } catch {
        return;
      }
      seenHosts.add(host);
      candidates.push({
        url: r.url,
        title: r.title ?? '',
        description: r.description ?? '',
        score: scoreCandidate(businessName, i, r.url, r.title ?? ''),
      });
    });

    candidates.sort((a, b) => b.score - a.score);
    const shortlist = candidates.slice(0, 5);

    if (shortlist.length === 0) {
      return {
        status: 'unavailable',
        candidates: [],
        dataRequired: ['website'],
      };
    }

    const [top, second] = shortlist;
    const clearWinner = !second || top.score - second.score >= CLEAR_WINNER_MARGIN;

    if (clearWinner) {
      return { status: 'resolved', url: top.url, candidates: shortlist, dataRequired: [] };
    }
    return { status: 'review', candidates: shortlist, dataRequired: [] };
  } catch (error) {
    logger.warn('[discover] website discovery failed', {
      error: String(error),
    });
    return { status: 'unavailable', candidates: [], dataRequired: ['website'] };
  }
}
