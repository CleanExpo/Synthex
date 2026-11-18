/**
 * Return-path guard for sign-in and sign-up (SYN-1215).
 *
 * proxy.ts, requireOrganisationPageAccess and the invite-accept page send a
 * signed-out visitor to /login?redirect=<path>. After sign-in the visitor goes
 * back to that path, but only when it is a path on this site. Anything that
 * could leave the site (absolute URLs, protocol-relative `//host`, backslash
 * tricks, control characters) is dropped, as are the auth pages themselves
 * (a loop) and API routes (not a page).
 *
 * Client-safe: no server-only imports.
 */

const PROBE_ORIGIN = 'https://synthex.invalid';
const MAX_LENGTH = 2048;
const BLOCKED_PREFIXES = ['/login', '/signup', '/api'];

export function safeReturnPath(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  if (raw.length === 0 || raw.length > MAX_LENGTH) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  // Backslashes and control characters (tab, newline) are normalised by
  // browsers in ways that can turn a path into another host.
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null;

  let url: URL;
  try {
    url = new URL(raw, PROBE_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PROBE_ORIGIN) return null;

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (decodedPath.startsWith('//') || decodedPath.includes('\\')) return null;

  const isBlocked = BLOCKED_PREFIXES.some(
    p => url.pathname === p || url.pathname.startsWith(`${p}/`)
  );
  if (isBlocked) return null;

  return `${url.pathname}${url.search}${url.hash}`;
}

/** `/signup` or `/login` carrying a safe return path, for cross-links. */
export function withReturnPath(
  base: '/login' | '/signup',
  returnPath: string | null
): string {
  return returnPath
    ? `${base}?redirect=${encodeURIComponent(returnPath)}`
    : base;
}
