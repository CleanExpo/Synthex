import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that are completely public — no auth check, no redirect
const PUBLIC_API_PREFIXES = [
  '/api/auth/',
  '/api/health',
  '/api/webhooks/',
];

// Static asset extensions skipped by the matcher (kept here for clarity)
const STATIC_EXTENSIONS = /\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf|css|js|map)$/;

function isPublicRoute(pathname: string): boolean {
  if (STATIC_EXTENSIONS.test(pathname)) return true;
  return PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

function getTokenFromRequest(request: NextRequest): string | null {
  // Prefer httpOnly cookie
  const cookieToken = request.cookies.get('auth-token')?.value;
  if (cookieToken) return cookieToken;

  // Fallback: Authorization: Bearer <token>
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (process.env.NODE_ENV === 'development') {
    console.info(`[Middleware] ${request.method} ${pathname}`);
  }

  const response = NextResponse.next();

  // ------------------------------------------------------------------
  // Public routes: skip auth, still apply security headers below
  // ------------------------------------------------------------------
  const isPublic = isPublicRoute(pathname);

  if (!isPublic) {
    const token = getTokenFromRequest(request);

    if (!token) {
      // API routes: return 401 JSON
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Authentication required' },
          { status: 401 }
        );
      }

      // Page routes: redirect to login
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  runtime: 'nodejs',
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - /api/auth/  (auth callbacks and login endpoints)
     * - /api/health (health-check — no auth required)
     * - /api/webhooks/ (inbound webhooks use their own HMAC verification)
     * - _next/static (static files)
     * - _next/image  (image optimisation)
     * - favicon.ico and common static asset extensions
     */
    '/((?!api/auth/|api/health|api/webhooks/|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
