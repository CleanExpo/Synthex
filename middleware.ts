/**
 * Synthex edge middleware — safety-first route gating (SYN-792)
 *
 * Fixes the P0 redirect loop on `/auth/login?redirect=/auth/login`.
 *
 * Design:
 *   - Default: allow everything (NextResponse.next()). Marketing pages, SEO
 *     crawlers, and all public surfaces pass through untouched.
 *   - Protect only: /dashboard/*, /onboarding/*, /admin/*
 *   - Short-circuit: auth pages (/login, /signup, /auth/*, /forgot-password,
 *     /reset-password) ALWAYS pass through, even for unauthenticated users.
 *     This is the fix — previous (deployed) middleware wrapped these in a
 *     self-referencing ?redirect= and produced an infinite loop.
 *   - Auth check: cookie presence only (no Supabase API call from edge —
 *     keeps bundle small, avoids cold-start cost). A stale cookie will let
 *     a request through to the page, which does the real Supabase check.
 *
 * @task SYN-792
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Paths that require authentication. Prefix match. */
export const PROTECTED_PREFIXES = ['/dashboard', '/onboarding', '/admin'];

/** Paths that MUST always pass through — even for unauthenticated users.
 *  If ANY of these match, middleware returns next() immediately.
 *  This is the explicit short-circuit that prevents the `/auth/login` self-loop. */
export const ALWAYS_ALLOW_PREFIXES = [
  '/login',
  '/signup',
  '/auth', // covers /auth/login, /auth/signup, /auth/callback, /auth/*
  '/forgot-password',
  '/reset-password',
  '/api', // API routes do their own auth
  '/_next', // Next.js internals
];

/** Supabase session-cookie prefix. `@supabase/ssr` writes cookies named
 *  `sb-<project-ref>-auth-token`. Presence indicates a session exists. */
const SUPABASE_COOKIE_PREFIX = 'sb-';

/** Pure decision function — exported for unit testing without touching
 *  NextResponse (which relies on global Request/Response that Jest stubs). */
export type MiddlewareDecision =
  | { action: 'pass' }
  | { action: 'redirect'; target: string };

export function decide(
  pathname: string,
  search: string,
  cookieNames: string[]
): MiddlewareDecision {
  if (ALWAYS_ALLOW_PREFIXES.some(p => pathname.startsWith(p))) {
    return { action: 'pass' };
  }

  const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p));
  if (!isProtected) {
    return { action: 'pass' };
  }

  const hasSession = cookieNames.some(n =>
    n.startsWith(SUPABASE_COOKIE_PREFIX)
  );
  if (hasSession) {
    return { action: 'pass' };
  }

  const returnTo = pathname + search;
  return {
    action: 'redirect',
    target: `/login?redirect=${encodeURIComponent(returnTo)}`,
  };
}

export function middleware(request: NextRequest) {
  const decision = decide(
    request.nextUrl.pathname,
    request.nextUrl.search,
    request.cookies.getAll().map(c => c.name)
  );

  if (decision.action === 'pass') {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL(decision.target, request.url), 307);
}

export const config = {
  // Apply to everything except static assets and image files.
  // Assets under /_next are also short-circuited in the handler above; the
  // matcher exists to avoid the function running at all for them.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json)$).*)',
  ],
};
