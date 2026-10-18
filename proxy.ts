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

export type SessionClaims = {
  onboardingComplete?: boolean;
  role?: string;
};

/**
 * Decode a JWT payload on the Edge without verifying the signature.
 * Auth presence is already established by the cookie; this only reads
 * onboarding/role claims for routing. Malformed tokens return undefined.
 */
export function decodeAuthTokenPayload(
  token: string | undefined
): SessionClaims | undefined {
  if (!token) return undefined;
  const parts = token.split('.');
  const payloadSegment = parts[1];
  if (parts.length < 2 || !payloadSegment) return undefined;
  try {
    const b64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
    const parsed = JSON.parse(atob(pad)) as Record<string, unknown>;
    const claims: SessionClaims = {};
    if (typeof parsed.onboardingComplete === 'boolean') {
      claims.onboardingComplete = parsed.onboardingComplete;
    }
    if (typeof parsed.role === 'string') {
      claims.role = parsed.role;
    }
    return claims;
  } catch {
    return undefined;
  }
}

export function decide(
  pathname: string,
  search: string,
  cookieNames: string[],
  claims?: SessionClaims
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
  if (!hasSession) {
    const returnTo = pathname + search;
    return {
      action: 'redirect',
      target: `/login?redirect=${encodeURIComponent(returnTo)}`,
    };
  }

  const isSuperadmin = claims?.role === 'superadmin';
  const incomplete = claims?.onboardingComplete === false;
  const isAppShell =
    pathname.startsWith('/dashboard') || pathname.startsWith('/admin');

  if (!isSuperadmin && incomplete && isAppShell) {
    return { action: 'redirect', target: '/onboarding' };
  }

  return { action: 'pass' };
}

/**
 * P4 machine principal gate: a `Bearer smk_…` key on any /api route except
 * the MCP transport (its own tool scopes) is resolved here, so a key outside
 * its route allow-list gets 403 whatever the route's own auth helper answers.
 * The route helpers re-resolve the key (lib/auth/jwt-utils.ts,
 * lib/security/api-security-checker.ts) to obtain the key's user. Loaded
 * lazily so ordinary requests never load the database client.
 */
export async function agentGate(
  request: NextRequest
): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/api/') || /^\/api\/mcp(\/|$)/.test(pathname))
    return null;
  if (!request.headers.get('authorization')?.startsWith('Bearer smk_'))
    return null;
  const { resolveAgentPrincipalForRequest } =
    await import('@/lib/auth/agent-principal');
  const principal = await resolveAgentPrincipalForRequest(request);
  if (principal.kind !== 'denied') return null;
  return NextResponse.json(
    {
      error:
        principal.status === 401
          ? 'Unauthorized'
          : principal.status === 429
            ? 'Too Many Requests'
            : 'Forbidden',
      code: principal.code,
    },
    { status: principal.status }
  );
}

export async function proxy(request: NextRequest) {
  const denied = await agentGate(request);
  if (denied) return denied;

  const cookies = request.cookies.getAll();
  const token = cookies.find(c => c.name === 'auth-token')?.value;
  const decision = decide(
    request.nextUrl.pathname,
    request.nextUrl.search,
    cookies.map(c => c.name),
    decodeAuthTokenPayload(token)
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
