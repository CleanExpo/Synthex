/**
 * Synthex edge proxy — safety-first route gating (SYN-792)
 *
 * Next.js 16 renamed `middleware.ts` → `proxy.ts`. This file is the edge
 * gate for every request; its `config.matcher` controls where it runs.
 *
 * ## The bug this fixes (P0)
 *
 * The prior implementation treated every non-API route as protected and
 * redirected unauthenticated users to `/auth/login?redirect=<path>` without
 * short-circuiting `/auth/login` itself. Result: the login page redirected
 * to itself in an infinite loop. `curl -sSL /agencies` hit 50 redirects and
 * gave up; Google/Bing bots couldn't index a single public page; marketing
 * pages and the signup funnel were all unreachable.
 *
 * ## Design — safety first
 *
 * - **Default: allow** (NextResponse.next). Marketing pages, SEO crawlers,
 *   and every public surface pass through untouched.
 * - **Protect only**: `/dashboard/*`, `/onboarding/*`, `/admin/*`.
 * - **Short-circuit auth pages** (`/login`, `/signup`, `/auth/*`,
 *   `/forgot-password`, `/reset-password`): ALWAYS pass through, even for
 *   unauthenticated users. This is the explicit fix for the redirect loop.
 * - **API routes short-circuit**: they do their own auth (`lib/auth/`,
 *   `withAuth`, bearer-token checks) and return 401 JSON when unauthorised.
 * - **Cookie-only session check**: looks for any cookie with the `sb-`
 *   prefix (`@supabase/ssr`) or the legacy `auth-token` cookie. No Supabase
 *   API call from the edge — keeps the bundle small and avoids cold starts.
 *   Stale cookies pass the edge; the page-level guard does the real check.
 *
 * @task SYN-792
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Paths that require authentication. Prefix match. */
export const PROTECTED_PREFIXES = ['/dashboard', '/onboarding', '/admin'];

/** Paths that MUST always pass through — even for unauthenticated users.
 *  If ANY of these match, proxy returns next() immediately. This is the
 *  explicit short-circuit that prevents the `/auth/login` self-loop. */
export const ALWAYS_ALLOW_PREFIXES = [
  '/login',
  '/signup',
  '/auth', // covers /auth/login, /auth/signup, /auth/callback, /auth/*
  '/forgot-password',
  '/reset-password',
  '/benchmark', // SYN-779 — public benchmark landing page
  '/api', // API routes do their own auth and return 401 JSON
  '/_next', // Next.js internals
];

/** Session-cookie prefixes we treat as "logged in" for the edge check.
 *  `sb-` matches @supabase/ssr cookies; `auth-token` is the legacy JWT
 *  cookie set by the custom auth flow. */
const SESSION_COOKIE_PREFIXES = ['sb-', 'auth-token'];

/** Pure decision function — exported for unit testing without touching
 *  NextResponse (Jest stubs global Request/Response in tests/jest.setup.js,
 *  which breaks Next's response construction). */
export type ProxyDecision =
  | { action: 'pass' }
  | { action: 'redirect'; target: string };

export function decide(
  pathname: string,
  search: string,
  cookieNames: string[]
): ProxyDecision {
  if (ALWAYS_ALLOW_PREFIXES.some(p => pathname.startsWith(p))) {
    return { action: 'pass' };
  }

  const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p));
  if (!isProtected) {
    return { action: 'pass' };
  }

  const hasSession = cookieNames.some(n =>
    SESSION_COOKIE_PREFIXES.some(prefix => n.startsWith(prefix))
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

export function proxy(request: NextRequest) {
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
  // Apply to everything except static assets. Auth pages, API routes, and
  // framework internals are short-circuited in the handler above; the
  // matcher excludes pure static assets so the function doesn't run at all
  // for them.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf|css|js|map|txt|xml|json)$).*)',
  ],
};
