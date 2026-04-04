/**
 * Brand Builder — Multi-API Mention Aggregator
 *
 * Queries NewsData.io and GDELT in parallel.
 * GDELT is always available (no auth). NewsData.io requires an API key.
 * Results are deduplicated by canonical URL.
 *
 * @module lib/brand/mention-poller
 */

import type { RawMention, MentionPollResult, MentionApiSource } from './types';
import { deduplicateMentions } from './mention-deduplicator';

// ---------------------------------------------------------------------------
// API response type shapes
// ---------------------------------------------------------------------------

interface NewsdataArticle {
  link?: string;
  title?: string;
  description?: string;
  pubDate?: string;
  source_id?: string;
}

interface NewsdataResponse {
  status?: string;
  results?: NewsdataArticle[];
}

interface GdeltArticle {
  url?: string;
  title?: string;
  seendate?: string;
  domain?: string;
}

interface GdeltResponse {
  articles?: GdeltArticle[];
}

// ---------------------------------------------------------------------------
// Individual API fetchers
// ---------------------------------------------------------------------------

/**
 * Extract domain from a URL string
 */
function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Convert GDELT seendate format "20260311T120000Z" to ISO timestamp
 */
function gdeltDateToIso(seendate: string): string | null {
  try {
    // Format: YYYYMMDDTHHmmssZ
    const m = seendate.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
    if (!m) return null;
    return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
  } catch {
    return null;
  }
}

/**
 * Fetch mentions from NewsData.io
 */
async function fetchNewsdata(brandName: string, apiKey: string): Promise<RawMention[]> {
  const query    = encodeURIComponent(`"${brandName}"`);
  const url      = `https://newsdata.io/api/1/news?apikey=${apiKey}&q=${query}&language=en&size=10`;
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });

  if (!response.ok) return [];

  const data: NewsdataResponse = await response.json();
  if (!Array.isArray(data.results)) return [];

  return data.results
    .filter((a): a is NewsdataArticle & { link: string; title: string } =>
      Boolean(a.link && a.title)
    )
    .map((article): RawMention => ({
      url:         article.link,
      title:       article.title,
      description: article.description ?? null,
      publishedAt: article.pubDate ? new Date(article.pubDate).toISOString() : null,
      source:      article.source_id ?? domainFromUrl(article.link),
      apiSource:   'newsdata' as MentionApiSource,
    }));
}

/**
 * Fetch mentions from GDELT (no auth required)
 */
async function fetchGdelt(brandName: string): Promise<RawMention[]> {
  const query = encodeURIComponent(`"${brandName}"`);
  const url   = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&maxrecords=10&format=json&sort=datedesc`;

  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) return [];

  const data: GdeltResponse = await response.json();
  if (!Array.isArray(data.articles)) return [];

  return data.articles
    .filter((a): a is GdeltArticle & { url: string; title: string } =>
      Boolean(a.url && a.title)
    )
    .map((article): RawMention => ({
      url:         article.url,
      title:       article.title,
      description: null,
      publishedAt: article.seendate ? gdeltDateToIso(article.seendate) : null,
      source:      article.domain ?? domainFromUrl(article.url),
      apiSource:   'gdelt' as MentionApiSource,
    }));
}

// ---------------------------------------------------------------------------
// Main poller
// ---------------------------------------------------------------------------

export interface MentionPollOptions {
  apiKeys?: {
    newsdata?: string;
    gnews?: string;
    guardian?: string;
  };
}

/**
 * Poll multiple mention APIs in parallel for a brand name.
 * Returns deduplicated MentionPollResult.
 *
 * GDELT is always queried (no auth required).
 * Other APIs are only queried if their API key is provided.
 */
export async function pollMentions(
  brandName: string,
  options?: MentionPollOptions
): Promise<MentionPollResult> {
  const apiKeys = options?.apiKeys ?? {};

  // Build list of fetch promises with source tracking
  const fetches: Promise<RawMention[]>[] = [];
  const sources: MentionApiSource[] = [];

  // NewsData.io (requires API key)
  const newsdataKey = apiKeys.newsdata ?? process.env.NEWSDATA_API_KEY;
  if (newsdataKey) {
    fetches.push(fetchNewsdata(brandName, newsdataKey));
    sources.push('newsdata');
  }

  // GDELT — always available
  fetches.push(fetchGdelt(brandName));
  sources.push('gdelt');

  // Run all in parallel, don't fail if one API is down
  const results = await Promise.allSettled(fetches);

  const allMentions: RawMention[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allMentions.push(...result.value);
    }
    // Silently skip rejected API calls — other sources still provide value
  }

  const totalFetched = allMentions.length;
  const deduplicated = deduplicateMentions(allMentions);

  return {
    mentions:     deduplicated,
    newCount:     deduplicated.length,
    totalFetched,
    sources,
    polledAt:     new Date().toISOString(),
  };
}
