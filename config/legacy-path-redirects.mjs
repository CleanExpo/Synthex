/**
 * SYN-1219 — dead public paths from the 2026-09-13 SPM walk.
 *
 * Imported by next.config.mjs (`permanent: true` → 308).
 * Canonical destinations are existing App Router routes, not new pages.
 */

/** @type {ReadonlyArray<{ source: string; destination: string; permanent: true }>} */
export const LEGACY_PATH_REDIRECTS = [
  { source: '/register', destination: '/signup', permanent: true },
  { source: '/auth/signup', destination: '/signup', permanent: true },
  { source: '/kickstart', destination: '/opportunity-map', permanent: true },
  { source: '/scan', destination: '/opportunity-map', permanent: true },
  { source: '/brief', destination: '/onboarding/season-brief', permanent: true },
];
