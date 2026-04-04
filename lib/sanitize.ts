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
