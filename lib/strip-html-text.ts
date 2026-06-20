/**
 * HTML → plain-text extraction (jsdom-free).
 *
 * @task SYN-863 (origin), prod-incident fix — see below.
 *
 * Extracts the visible text of an HTML string. Output is PLAIN TEXT — it is
 * never re-inserted into an HTML sink — so this is a text-extraction utility,
 * not the XSS sanitisation boundary (that lives in `lib/sanitize.ts`).
 *
 * Why this is its own module: `lib/sanitize.ts` eagerly imports
 * `isomorphic-dompurify`, which pulls `jsdom` → `parse5` (ESM-only). On
 * Vercel's Node runtime that chain throws `ERR_REQUIRE_ESM` at cold start,
 * crashing EVERY route that imports the module — regardless of which export it
 * actually calls. The 12 consumers that only need plain text were collateral.
 * They now import from here, which uses `htmlparser2` (pure CommonJS, no jsdom,
 * no parse5) and cannot trigger that crash.
 *
 * Security: htmlparser2 is a real streaming HTML parser, so this is resilient
 * to the regex-bypass patterns CodeQL flagged on the original ad-hoc strip
 * (case/whitespace/nested-tag bypass). Content inside script/style/iframe/etc.
 * is dropped at the parser level — any payload that survives does so as inert
 * text, never as executable markup.
 */

import { Parser } from 'htmlparser2';

// Tags whose *content* must be dropped entirely (tag + children/text).
const SKIP_TAGS = new Set([
  'script',
  'style',
  'noscript',
  'iframe',
  'object',
  'embed',
  'form',
]);

// Tags that imply a word/block boundary — emit whitespace so adjacent text
// doesn't fuse (e.g. `<h1>Welcome</h1><p>To us</p>` → `Welcome To us`).
const BOUNDARY_TAGS = new Set([
  ...SKIP_TAGS,
  'p',
  'div',
  'br',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'tr',
  'td',
  'th',
  'ul',
  'ol',
  'table',
  'article',
  'section',
  'header',
  'footer',
  'nav',
  'aside',
  'main',
  'blockquote',
  'pre',
]);

/**
 * Strip ALL HTML tags and return plain text content. Drops script, style,
 * noscript, iframe, object, embed, and form blocks entirely (tag + content);
 * converts other tags to whitespace so word boundaries survive. Decodes HTML
 * entities, collapses runs of whitespace, and trims.
 *
 * @param html - Raw HTML string.
 * @returns Plain text content.
 */
export function stripHtmlToText(html: string): string {
  let out = '';
  let skipDepth = 0;

  const parser = new Parser(
    {
      onopentag(name) {
        if (BOUNDARY_TAGS.has(name)) out += ' ';
        if (SKIP_TAGS.has(name)) skipDepth++;
      },
      ontext(text) {
        if (skipDepth === 0) out += text;
      },
      onclosetag(name) {
        if (SKIP_TAGS.has(name) && skipDepth > 0) skipDepth--;
        if (BOUNDARY_TAGS.has(name)) out += ' ';
      },
    },
    { decodeEntities: true }
  );

  parser.write(html);
  parser.end();

  return out.replace(/\s+/g, ' ').trim();
}
