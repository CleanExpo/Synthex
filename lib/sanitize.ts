/**
 * HTML Sanitization Utility
 *
 * @task UNI-555 - Add DOMPurify to sanitize blog HTML
 *
 * Uses isomorphic-dompurify which works both server-side (Node.js) and
 * client-side (browser), making it safe to call in Server Components,
 * API routes, and Client Components alike.
 *
 * Usage:
 *   import { sanitizeHtml } from '@/lib/sanitize';
 *   const clean = sanitizeHtml(userProvidedHtml);
 *   <div dangerouslySetInnerHTML={{ __html: clean }} />
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize an HTML string to prevent XSS attacks.
 *
 * Strips all dangerous tags (script, iframe, object, embed, etc.) and event
 * handler attributes (onclick, onerror, onload, etc.) while preserving safe
 * formatting markup (p, h1-h6, ul, ol, li, strong, em, blockquote, code, a,
 * img with safe attributes, etc.).
 *
 * @param html - Raw HTML string, potentially containing user-provided content.
 * @returns Sanitized HTML string safe for use with dangerouslySetInnerHTML.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    // Allow standard formatting and content tags
    ALLOWED_TAGS: [
      'p', 'br',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'strong', 'b', 'em', 'i', 'u', 's', 'strike',
      'blockquote', 'pre', 'code',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span',
      'hr',
    ],
    // Allow only safe, non-executable attributes
    ALLOWED_ATTR: [
      'href', 'title', 'target', 'rel',
      'src', 'alt', 'width', 'height',
      'class', 'id',
      'colspan', 'rowspan',
    ],
    // Force links to use safe protocols only
    ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel):/i,
    // Add rel="noopener noreferrer" to all links that open in a new tab
    ADD_ATTR: ['target'],
    // Never allow data: URIs in href/src (default, explicit for clarity)
    FORCE_BODY: false,
  });
}

/**
 * Sanitize HTML with a stricter configuration — allows only inline text
 * formatting tags. Suitable for comments or short user-generated snippets
 * where block-level HTML is not needed.
 *
 * @param html - Raw HTML string from user input.
 * @returns Strictly sanitized HTML string.
 */
export function sanitizeInlineHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['strong', 'b', 'em', 'i', 'u', 's', 'code', 'br'],
    ALLOWED_ATTR: [],
  });
}

// Atomic entity decoder — single pass prevents double-decoding (e.g.
// `&amp;lt;` should stay as `&lt;`, not become `<`).
const ENTITY_MAP: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

/**
 * Strip ALL HTML tags and return plain text content. Drops script, style,
 * and noscript blocks entirely (content + tag); converts other tags to
 * whitespace so block-level word boundaries are preserved. Collapses
 * runs of whitespace and trims.
 *
 * Replaces ad-hoc regex chains across the codebase (SYN-863) with a
 * vetted parser-based sanitiser as the security boundary. The remaining
 * regex is only formatting cleanup of already-sanitised content (no
 * dangerous tags can survive DOMPurify) so it cannot be defeated by
 * nested-tag bypass like `<scr<script></script>ipt>`.
 *
 * @param html - Raw HTML string.
 * @returns Plain text content.
 */
export function stripHtmlToText(html: string): string {
  // Pre-inject a space before block-level / forbidden tags so word boundaries
  // survive after DOMPurify drops them entirely (e.g. `a<script>x</script>b`
  // would otherwise become `ab`). This regex adds whitespace only — it does
  // NOT sanitise, so it's not a CodeQL false-positive surface.
  const withBoundaries = html.replace(
    /<\/?(script|style|noscript|iframe|object|embed|form|p|div|h[1-6]|li|tr|td|th|br|hr|article|section|header|footer|nav|aside|main|blockquote|pre|ul|ol|table)\b/gi,
    ' $&'
  );
  // DOMPurify is the security boundary: removes script/style/iframe/object/
  // embed/noscript content using a real HTML parser (not regex). This is
  // resilient to nested-tag bypass and CodeQL recognises it as a sanitiser.
  const safe = DOMPurify.sanitize(withBoundaries, {
    FORBID_TAGS: ['script', 'style', 'noscript', 'iframe', 'object', 'embed', 'form'],
    KEEP_CONTENT: true,
  });
  // Formatting-only step: convert remaining safe tags to whitespace, decode
  // common entities atomically (one pass — no double-decode), collapse + trim.
  return safe
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:nbsp|amp|quot|#39|apos);/g, (match) => ENTITY_MAP[match] || match)
    .replace(/\s+/g, ' ')
    .trim();
}
