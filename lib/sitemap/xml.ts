/**
 * Pure W3C urlset sitemap parser + serialiser.
 *
 * No external XML library — sitemap.org spec is small enough that a
 * regex-based parser is safer (no XXE attack surface, no transitive
 * dependency churn). We do NOT support sitemap-index files yet —
 * SYN-840 is single-sitemap only; revisit when DR exceeds 50k URLs.
 *
 * @see https://www.sitemaps.org/protocol.html
 * @see SYN-840 (parent: SYN-834 epic)
 */

import type { SitemapUrl } from './types';

const URLSET_OPEN =
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
const URLSET_CLOSE = '</urlset>';
const XML_DECL = '<?xml version="1.0" encoding="UTF-8"?>';

/**
 * Decode a small subset of XML entities used in URLs / lastmod.
 */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Encode XML entities for safe embedding in element text.
 */
function encodeXmlEntities(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Parse a W3C urlset XML document into structured entries. Whitespace is
 * tolerant. Unknown child elements (e.g. image:image extensions) are
 * ignored on the round-trip — caller should not rely on this for
 * lossless preservation of Image/News/Video sitemaps. SYN-840 only
 * mutates url/lastmod/changefreq/priority.
 *
 * Returns empty array if input is empty or contains no `<url>` blocks.
 */
export function parseSitemap(xml: string): SitemapUrl[] {
  if (!xml || typeof xml !== 'string') return [];
  const urls: SitemapUrl[] = [];
  const urlBlockRegex = /<url\b[^>]*>([\s\S]*?)<\/url>/g;
  let match: RegExpExecArray | null;
  while ((match = urlBlockRegex.exec(xml)) !== null) {
    const block = match[1];
    const loc = extractTag(block, 'loc');
    if (!loc) continue;
    const lastmod = extractTag(block, 'lastmod') ?? '';
    const changefreq = extractTag(block, 'changefreq') as
      | SitemapUrl['changefreq']
      | undefined;
    const priorityRaw = extractTag(block, 'priority');
    const priority =
      priorityRaw && Number.isFinite(Number(priorityRaw))
        ? Number(priorityRaw)
        : undefined;

    const entry: SitemapUrl = {
      loc: decodeXmlEntities(loc),
      lastmod: decodeXmlEntities(lastmod),
    };
    if (changefreq) entry.changefreq = changefreq;
    if (typeof priority === 'number') entry.priority = priority;
    urls.push(entry);
  }
  return urls;
}

function extractTag(block: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
  const m = block.match(re);
  return m ? m[1].trim() : undefined;
}

/**
 * Serialise structured entries back to a W3C urlset XML document.
 * Stable ordering = ascending by `loc`, so diffs stay readable when the
 * caller commits the file to git.
 */
export function buildSitemap(urls: SitemapUrl[]): string {
  const sorted = [...urls].sort((a, b) => a.loc.localeCompare(b.loc));
  const body = sorted.map(formatUrlBlock).join('\n');
  return `${XML_DECL}\n${URLSET_OPEN}\n${body}\n${URLSET_CLOSE}\n`;
}

function formatUrlBlock(u: SitemapUrl): string {
  const parts = [
    `    <loc>${encodeXmlEntities(u.loc)}</loc>`,
    `    <lastmod>${encodeXmlEntities(u.lastmod)}</lastmod>`,
  ];
  if (u.changefreq) {
    parts.push(`    <changefreq>${u.changefreq}</changefreq>`);
  }
  if (typeof u.priority === 'number') {
    parts.push(`    <priority>${u.priority.toFixed(1)}</priority>`);
  }
  return ['  <url>', ...parts, '  </url>'].join('\n');
}
