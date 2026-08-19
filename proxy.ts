import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const PROTECTED_PREFIXES = ['/dashboard', '/onboarding', '/admin'];

export const ALWAYS_ALLOW_PREFIXES = [
  '/login',
  '/signup',
  '/auth',
  '/forgot-password',
  '/reset-password',
  '/benchmark',
  '/api',
  '/_next',
];

const SESSION_COOKIE_PREFIXES = ['sb-', 'auth-token'];

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
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf|css|js|map|txt|xml|json)$).*)',
  ],
};
