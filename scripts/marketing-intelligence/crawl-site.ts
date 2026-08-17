/**
 * Site crawler — structure + freshness (SYN-990 / INFRA-1).
 *
 * BFS same-origin crawl producing `CrawlPageData[]` (page list, click depth,
 * inbound internal-link counts, months-since-update from sitemap/Last-Modified).
 * Output merges into the scoring pipeline via crawl-adapter.mergeCrawlIntoMetrics().
 *
 * Respects robots.txt (User-agent: *), caps pages, polite concurrency, HTML-only.
 * Core Web Vitals (LCP/INP/CLS) are a follow-up (CrUX/Lighthouse) — left null here;
 * crawl-adapter already handles null CWV.
 *
 * Run:
 *   npx tsx scripts/marketing-intelligence/crawl-site.ts <siteUrl> [maxPages]
 */

import {
  aggregateCrawl,
  extractInternalLinks,
  isAllowed,
  normalizeUrl,
  parseRobotsDisallow,
  parseSitemap,
  parseSitemapIndex,
  type CrawledPage,
} from '../../lib/marketing-intelligence/crawl-core';

const UA = 'SynthexMarketingIntelligenceBot/1.0 (+https://synthex.social)';
const FETCH_TIMEOUT_MS = 15000;

async function getText(
  url: string
): Promise<{
  ok: boolean;
  body: string;
  lastModified?: string;
  contentType: string;
}> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
    });
    const contentType = res.headers.get('content-type') ?? '';
    const lastModified = res.headers.get('last-modified') ?? undefined;
    if (!res.ok) return { ok: false, body: '', lastModified, contentType };
    return { ok: true, body: await res.text(), lastModified, contentType };
  } catch {
    return { ok: false, body: '', contentType: '' };
  }
}

/** Fetch sitemap.xml (and one level of sitemap-index children) → url→lastmod map. */
async function loadSitemap(
  origin: string
): Promise<Map<string, string | undefined>> {
  const merged = new Map<string, string | undefined>();
  const root = await getText(new URL('/sitemap.xml', origin).toString());
  if (!root.ok) return merged;

  const childUrls = parseSitemapIndex(root.body);
  if (childUrls.length > 0) {
    for (const child of childUrls.slice(0, 20)) {
      const c = await getText(child);
      if (c.ok) for (const [u, lm] of parseSitemap(c.body)) merged.set(u, lm);
    }
  } else {
    for (const [u, lm] of parseSitemap(root.body)) merged.set(u, lm);
  }
  return merged;
}

async function main() {
  const siteUrl = process.argv[2];
  const maxPages = Number(process.argv[3] ?? 150);
  const concurrency = 4;
  if (!siteUrl) {
    console.error(
      'usage: tsx scripts/marketing-intelligence/crawl-site.ts <siteUrl> [maxPages]'
    );
    process.exit(1);
  }

  const start = normalizeUrl(siteUrl, siteUrl);
  if (!start) {
    console.error(`invalid siteUrl: ${siteUrl}`);
    process.exit(1);
  }
  const origin = new URL(start).origin;

  const robots = await getText(new URL('/robots.txt', origin).toString());
  const disallows = robots.ok ? parseRobotsDisallow(robots.body) : [];
  const sitemap = await loadSitemap(origin);

  const visited = new Set<string>();
  const pages: CrawledPage[] = [];
  let frontier: { url: string; depth: number }[] = [{ url: start, depth: 0 }];

  while (frontier.length > 0 && visited.size < maxPages) {
    const batch = frontier
      .filter(f => !visited.has(f.url))
      .slice(0, concurrency);
    if (batch.length === 0) break;
    batch.forEach(b => visited.add(b.url));
    frontier = frontier.filter(f => !batch.includes(f));

    const results = await Promise.all(
      batch.map(async ({ url, depth }) => {
        const path = new URL(url).pathname;
        if (!isAllowed(path, disallows)) return null;
        const res = await getText(url);
        if (!res.ok || !res.contentType.includes('text/html')) return null;
        const outLinks = extractInternalLinks(res.body, url);
        const page: CrawledPage = {
          url,
          depth,
          outLinks,
          lastmod: sitemap.get(url),
          lastModifiedHeader: res.lastModified
            ? new Date(res.lastModified).toISOString()
            : undefined,
        };
        return page;
      })
    );

    for (const page of results) {
      if (!page) continue;
      pages.push(page);
      for (const link of page.outLinks) {
        if (
          !visited.has(link) &&
          isAllowed(new URL(link).pathname, disallows)
        ) {
          frontier.push({ url: link, depth: page.depth + 1 });
        }
      }
    }
  }

  const crawlData = aggregateCrawl(pages, Date.now());
  const report = {
    siteUrl: origin,
    crawled_at: new Date().toISOString(),
    pages_crawled: crawlData.length,
    robots_disallow_rules: disallows.length,
    sitemap_entries: sitemap.size,
    truncated: visited.size >= maxPages,
    pages: crawlData,
  };
  console.log(JSON.stringify(report, null, 2));
}

main().catch(err => {
  console.error('crawl-site failed:', err);
  process.exit(1);
});
