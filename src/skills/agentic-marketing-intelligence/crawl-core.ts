/**
 * Crawl core — pure logic for the INFRA-1 site crawler (SYN-990).
 *
 * No I/O, no network, no Date.now() (callers pass `nowMs`) — so it is fully
 * deterministic and unit-testable. The runnable crawler
 * (scripts/marketing-intelligence/crawl-site.ts) does the fetching and feeds
 * these functions, producing `CrawlPageData[]` for the crawl-adapter.
 */

import type { CrawlPageData } from './crawl-adapter';

export interface NormalizeOpts {
  /** Drop the query string (treat ?a=1 and the bare URL as the same page). */
  stripQuery?: boolean;
}

/**
 * Resolve `href` against `baseUrl`; return a normalised same-origin absolute URL,
 * or null if it is off-origin / non-navigational / unparseable.
 */
export function normalizeUrl(href: string, baseUrl: string, opts: NormalizeOpts = {}): string | null {
  if (!href) return null;
  const h = href.trim();
  if (/^(mailto:|tel:|javascript:|data:|#)/i.test(h)) return null;

  let u: URL;
  let base: URL;
  try {
    base = new URL(baseUrl);
    u = new URL(h, baseUrl);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.host !== base.host) return null; // same-origin only

  u.hash = '';
  if (opts.stripQuery) u.search = '';
  return u.toString();
}

/**
 * Extract internal (same-host) links from an HTML string. Regex-based, which is
 * sufficient for a structure crawl (we only need hrefs, not a full DOM).
 */
export function extractInternalLinks(html: string, pageUrl: string, opts: NormalizeOpts = {}): string[] {
  const out = new Set<string>();
  // <a ... href="...">  |  '...'  |  unquoted
  const re = /<a\b[^>]*?\shref\s*=\s*("([^"]*)"|'([^']*)'|([^\s">]+))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[2] ?? m[3] ?? m[4] ?? '';
    const n = normalizeUrl(href, pageUrl, opts);
    if (n) out.add(n);
  }
  return [...out];
}

/** Months elapsed between an ISO date and `nowMs` (avg month length). Undefined if unparseable. */
export function monthsBetween(fromIso: string | undefined, nowMs: number): number | undefined {
  if (!fromIso) return undefined;
  const t = Date.parse(fromIso);
  if (Number.isNaN(t)) return undefined;
  const ms = nowMs - t;
  if (ms < 0) return 0;
  return ms / (1000 * 60 * 60 * 24 * 30.4375);
}

export interface CrawledPage {
  url: string;
  depth: number;
  outLinks: string[];
  /** ISO date from sitemap <lastmod>, if available. */
  lastmod?: string;
  /** Last-Modified HTTP header value, if available (fallback for lastmod). */
  lastModifiedHeader?: string;
}

/**
 * Aggregate BFS crawl results into CrawlPageData[]:
 * inbound internal-link counts, click depth from home, and months-since-update.
 */
export function aggregateCrawl(pages: CrawledPage[], nowMs: number): CrawlPageData[] {
  const known = new Set(pages.map(p => p.url));
  const inbound = new Map<string, number>();
  for (const u of known) inbound.set(u, 0);

  for (const p of pages) {
    for (const link of new Set(p.outLinks)) {
      if (link !== p.url && inbound.has(link)) {
        inbound.set(link, (inbound.get(link) ?? 0) + 1);
      }
    }
  }

  return pages.map(p => ({
    url: p.url,
    monthsSinceUpdate: monthsBetween(p.lastmod ?? p.lastModifiedHeader, nowMs),
    inboundInternalLinks: inbound.get(p.url) ?? 0,
    clickDepthFromHome: p.depth,
  }));
}

/** Parse a sitemap.xml into a map of url → lastmod (ISO or undefined). Handles urlset entries. */
export function parseSitemap(xml: string): Map<string, string | undefined> {
  const map = new Map<string, string | undefined>();
  const blocks = xml.match(/<url\b[\s\S]*?<\/url>/gi) ?? [];
  for (const block of blocks) {
    const loc = block.match(/<loc>\s*([\s\S]*?)\s*<\/loc>/i)?.[1]?.trim();
    if (!loc) continue;
    const lastmod = block.match(/<lastmod>\s*([\s\S]*?)\s*<\/lastmod>/i)?.[1]?.trim();
    map.set(loc, lastmod || undefined);
  }
  return map;
}

/** Extract child sitemap <loc> URLs from a <sitemapindex>. Empty if not an index. */
export function parseSitemapIndex(xml: string): string[] {
  if (!/<sitemapindex\b/i.test(xml)) return [];
  const locs: string[] = [];
  const re = /<sitemap\b[\s\S]*?<loc>\s*([\s\S]*?)\s*<\/loc>[\s\S]*?<\/sitemap>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    if (m[1]) locs.push(m[1].trim());
  }
  return locs;
}

/** Parse robots.txt Disallow rules that apply to `User-agent: *` (simple prefix rules). */
export function parseRobotsDisallow(robotsTxt: string): string[] {
  const disallows: string[] = [];
  let appliesToStar = false;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === 'user-agent') {
      appliesToStar = value === '*';
    } else if (field === 'disallow' && appliesToStar && value) {
      disallows.push(value);
    }
  }
  return disallows;
}

/** True if `pathname` is not blocked by any Disallow prefix. */
export function isAllowed(pathname: string, disallows: string[]): boolean {
  return !disallows.some(d => d !== '' && pathname.startsWith(d));
}
