/**
 * HTML Sanitization Utility
 *
 * @task UNI-555 - sanitize blog/email HTML to prevent XSS
 *
 * Uses `sanitize-html` (pure CommonJS, parses via htmlparser2) rather than
 * isomorphic-dompurify. DOMPurify's server path eagerly loads jsdom -> parse5@8
 * (ESM-only), which throws ERR_REQUIRE_ESM at cold start on Vercel's Node
 * runtime and 500'd every importing route before its handler ran. sanitize-html
 * carries no jsdom/parse5, ending that crash class.
 *
 * Security note: the allowlist below deliberately excludes svg, math, noscript,
 * template, and xmp. Those tags are the namespace-switching vectors that make
 * mutation-XSS (mXSS) exploitable; keeping them out is the primary mXSS defence
 * here. Do NOT add them without a fresh threat-model review.
 *
 * Usage:
 *   import { sanitizeHtml } from '@/lib/sanitize';
 *   const clean = sanitizeHtml(userProvidedHtml);
 */

import sanitizeHtmlLib from 'sanitize-html';

/**
 * Sanitize an HTML string to prevent XSS attacks.
 *
 * Strips all dangerous tags (script, iframe, object, embed, etc.) and event
 * handler attributes (onclick, onerror, onload, etc.) while preserving safe
 * formatting markup (p, h1-h6, ul, ol, li, strong, em, blockquote, code, a,
 * img with safe attributes, etc.). Restricts URLs to https/http/mailto/tel,
 * blocks data:/protocol-relative URLs, and forces rel="noopener noreferrer"
 * on links opening in a new tab.
 *
 * @param html - Raw HTML string, potentially containing user-provided content.
 * @returns Sanitized HTML string safe for use in an email body or with
 *          dangerouslySetInnerHTML.
 */
export function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: [
      'p',
      'br',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'strike',
      'blockquote',
      'pre',
      'code',
      'a',
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'div',
      'span',
      'hr',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      th: ['colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
      '*': ['class', 'id'],
    },
    // Restrict link/resource schemes to the same set as the prior DOMPurify
    // ALLOWED_URI_REGEXP (https/http/mailto/tel) — note: no ftp (sanitize-html
    // allows ftp by default; we drop it to match the prior contract).
    allowedSchemes: ['https', 'http', 'mailto', 'tel'],
    // Block data:/blob: URIs in img src (sanitize-html would otherwise permit
    // data: in img src; DOMPurify's regexp blocked it).
    allowedSchemesByTag: {
      img: ['https', 'http'],
    },
    // Block protocol-relative URLs (//evil.com) — sanitize-html allows these by
    // default; the prior DOMPurify regexp rejected them.
    allowProtocolRelative: false,
    // Drop disallowed tags AND their text content (matches DOMPurify default).
    disallowedTagsMode: 'discard',
    // Force rel="noopener noreferrer" on any <a target="_blank"> (tabnabbing).
    transformTags: {
      a: (tagName, attribs) => {
        if (attribs.target === '_blank') {
          return {
            tagName,
            attribs: { ...attribs, rel: 'noopener noreferrer' },
          };
        }
        return { tagName, attribs };
      },
    },
  });
}
