/**
 * CSRF Token Utility (Client-side)
 *
 * Reads the csrf-token cookie (set by middleware) and provides it
 * for inclusion in mutation request headers.
 *
 * The primary CSRF defense is origin-based validation (server-side).
 * The double-submit token is defense-in-depth for older browsers
 * or unusual network configurations where Origin/Referer headers
 * may be stripped.
 */

'use client';

import { checkApiKeyRequired } from '@/lib/utils/api-key-interceptor';

/**
 * Read the CSRF token from the cookie.
 * Returns empty string if not found (origin-based validation will still work).
 */
export function getCSRFToken(): string {
  if (typeof document === 'undefined') return '';

  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrf-token='));

  return match ? match.split('=')[1] : '';
}

/**
 * Returns headers object with CSRF token included.
 * Merge with your existing headers for mutation requests.
 */
export function getCSRFHeaders(): Record<string, string> {
  const token = getCSRFToken();
  return token ? { 'X-CSRF-Token': token } : {};
}

/**
 * Fetch wrapper that automatically includes:
 * - credentials: 'include' (sends auth cookies)
 * - CSRF token header (for mutation requests)
 * - Content-Type: application/json (for POST/PUT/PATCH)
 */
export async function fetchWithCSRF(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  // Add CSRF token for mutations
  if (isMutation) {
    const csrfToken = getCSRFToken();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }

  // Add Content-Type for mutations with body (unless already set or FormData)
  if (isMutation && options.body && !headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });

  // Global 402 interception: prompt user to add AI API key
  checkApiKeyRequired(response);

  return response;
}
