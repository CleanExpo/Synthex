/**
 * Unit tests for the INFRA-1 crawl core (SYN-990) — pure logic, no network.
 */

import {
  aggregateCrawl,
  extractInternalLinks,
  isAllowed,
  monthsBetween,
  normalizeUrl,
  parseRobotsDisallow,
  parseSitemap,
  parseSitemapIndex,
  type CrawledPage,
} from '../../src/skills/agentic-marketing-intelligence/crawl-core';

describe('normalizeUrl', () => {
  const base = 'https://synthex.social/blog/';
  it('resolves relative URLs against the base', () => {
    expect(normalizeUrl('../pricing', base)).toBe('https://synthex.social/pricing');
  });
  it('drops the fragment', () => {
    expect(normalizeUrl('/features#top', base)).toBe('https://synthex.social/features');
  });
  it('returns null for off-origin, mailto, tel, and javascript hrefs', () => {
    expect(normalizeUrl('https://google.com/', base)).toBeNull();
    expect(normalizeUrl('mailto:a@b.com', base)).toBeNull();
    expect(normalizeUrl('tel:123', base)).toBeNull();
    expect(normalizeUrl('javascript:void(0)', base)).toBeNull();
  });
  it('optionally strips the query string', () => {
    expect(normalizeUrl('/p?a=1', base, { stripQuery: true })).toBe('https://synthex.social/p');
    expect(normalizeUrl('/p?a=1', base)).toBe('https://synthex.social/p?a=1');
  });
});

describe('extractInternalLinks', () => {
  it('extracts same-origin hrefs (quoted, single-quoted, unquoted) and dedupes; drops external', () => {
    const html = `
      <a href="/a">A</a>
      <a href='/b'>B</a>
      <a href=/a>dup A</a>
      <a href="https://external.com/x">ext</a>
      <a href="mailto:x@y.com">mail</a>
      <area href="/not-an-anchor">
    `;
    const links = extractInternalLinks(html, 'https://synthex.social/');
    expect(links).toContain('https://synthex.social/a');
    expect(links).toContain('https://synthex.social/b');
    expect(links.filter(l => l.endsWith('/a'))).toHaveLength(1); // deduped
    expect(links.some(l => l.includes('external.com'))).toBe(false);
    expect(links.some(l => l.includes('not-an-anchor'))).toBe(false); // <area> ignored
  });
});

describe('monthsBetween', () => {
  it('computes whole-ish months and clamps future dates to 0', () => {
    const now = Date.parse('2026-05-29T00:00:00Z');
    expect(monthsBetween('2026-02-28T00:00:00Z', now)).toBeCloseTo(3, 0);
    expect(monthsBetween('2027-01-01T00:00:00Z', now)).toBe(0);
    expect(monthsBetween(undefined, now)).toBeUndefined();
    expect(monthsBetween('not-a-date', now)).toBeUndefined();
  });
});

describe('aggregateCrawl', () => {
  it('counts inbound internal links, preserves depth, derives monthsSinceUpdate', () => {
    const now = Date.parse('2026-05-29T00:00:00Z');
    const pages: CrawledPage[] = [
      { url: 'https://s.io/', depth: 0, outLinks: ['https://s.io/a', 'https://s.io/b'] },
      { url: 'https://s.io/a', depth: 1, outLinks: ['https://s.io/b'], lastmod: '2026-05-01T00:00:00Z' },
      { url: 'https://s.io/b', depth: 1, outLinks: [], lastModifiedHeader: '2024-05-29T00:00:00Z' },
    ];
    const out = aggregateCrawl(pages, now);
    const byUrl = Object.fromEntries(out.map(p => [p.url, p]));
    expect(byUrl['https://s.io/b'].inboundInternalLinks).toBe(2); // from home + /a
    expect(byUrl['https://s.io/a'].inboundInternalLinks).toBe(1);
    expect(byUrl['https://s.io/'].clickDepthFromHome).toBe(0);
    expect(byUrl['https://s.io/a'].monthsSinceUpdate).toBeCloseTo(0.9, 0); // ~28 days
    expect(byUrl['https://s.io/b'].monthsSinceUpdate).toBeGreaterThan(11); // ~2 yrs, header fallback
  });
});

describe('parseSitemap / parseSitemapIndex', () => {
  it('extracts loc + lastmod from a urlset', () => {
    const xml = `<urlset><url><loc>https://s.io/a</loc><lastmod>2026-05-01</lastmod></url>
      <url><loc>https://s.io/b</loc></url></urlset>`;
    const map = parseSitemap(xml);
    expect(map.get('https://s.io/a')).toBe('2026-05-01');
    expect(map.get('https://s.io/b')).toBeUndefined();
    expect(parseSitemapIndex(xml)).toHaveLength(0);
  });
  it('extracts child sitemaps from an index', () => {
    const xml = `<sitemapindex><sitemap><loc>https://s.io/sm1.xml</loc></sitemap>
      <sitemap><loc>https://s.io/sm2.xml</loc></sitemap></sitemapindex>`;
    expect(parseSitemapIndex(xml)).toEqual(['https://s.io/sm1.xml', 'https://s.io/sm2.xml']);
  });
});

describe('robots.txt', () => {
  it('collects Disallow rules under User-agent: * and applies prefix matching', () => {
    const robots = `User-agent: Googlebot\nDisallow: /private-google\n\nUser-agent: *\nDisallow: /admin\nDisallow: /tmp\nAllow: /`;
    const dis = parseRobotsDisallow(robots);
    expect(dis).toEqual(['/admin', '/tmp']);
    expect(isAllowed('/blog/post', dis)).toBe(true);
    expect(isAllowed('/admin/users', dis)).toBe(false);
    expect(isAllowed('/private-google', dis)).toBe(true); // not under * group
  });
});
