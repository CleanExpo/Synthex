/**
 * validateExternalUrl — SSRF prevention utility
 *
 * Blocks requests to private/loopback/cloud-metadata addresses.
 * Call this before any server-side fetch() of a user-supplied URL.
 *
 * Throws an Error if the URL is unsafe; returns void if safe.
 */

const BLOCKED_PATTERNS: RegExp[] = [
  /^file:/i,
  /^ftp:/i,
  /localhost/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./, // AWS/GCP/Azure cloud metadata endpoint
  /^::1/, // IPv6 loopback (bare)
  /^\[::1\]/, // IPv6 loopback (URL.hostname bracket form)
  /^\[fd[0-9a-f]{2}:/i, // IPv6 private range bracket form
  /^fd[0-9a-f]{2}:/i, // IPv6 private range (fc00::/7)
  /^0\.0\.0\.0/,
];

export function validateExternalUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('URL must use http or https protocol');
  }

  const hostname = parsed.hostname;
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new Error('URL resolves to a blocked address');
    }
  }
}
