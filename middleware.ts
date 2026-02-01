import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Note: Using console directly instead of logger for Edge Function compatibility

// Security headers configuration
const securityHeaders = {
  // Content Security Policy
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://cdn.tailwindcss.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://api.openrouter.ai https://*.supabase.co wss://*.supabase.co https://res.cloudinary.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; '),

  // Strict Transport Security
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // Other security headers
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',

  // CORS headers for API routes
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.ai',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
  const pathname = request.nextUrl.pathname;

  // Create Supabase client for auth checks
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // Refresh session if expired
  const { data: { session } } = await supabase.auth.getSession();

  // Apply security headers to all responses
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Note: API rate limiting is handled per-route via withRateLimit() in
  // lib/middleware/rate-limiter.ts (backed by Upstash Redis in production).
  // The middleware matcher below excludes /api/ routes.

  // Authentication check for protected routes
  const protectedPaths = ['/dashboard', '/api/protected', '/api/user', '/api/integrations'];
  const authPaths = ['/auth/login', '/auth/register'];
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  const isAuthPath = authPaths.some(path => pathname.startsWith(path));

  // Allow demo routes without authentication
  if (pathname.startsWith('/demo')) {
    return response;
  }

  // Redirect to login if accessing protected route without session
  if (isProtectedPath && !session) {
    if (!pathname.startsWith('/api/')) {
      // Redirect to login for web pages
      const redirectUrl = new URL('/auth/login', request.url);
      redirectUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(redirectUrl);
    } else {
      // Return 401 for API routes
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }

  // Redirect to dashboard if accessing auth routes with active session
  if (isAuthPath && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // CSRF protection for mutations
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    const origin = request.headers.get('origin');

    // Verify origin/referer for CSRF protection
    if (origin && !origin.includes(request.nextUrl.hostname)) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  // Add request ID for tracing
  const requestId = crypto.randomUUID();
  response.headers.set('X-Request-Id', requestId);

  // Log security events with structured logging (Edge-compatible)
  if (pathname.startsWith('/api/auth')) {
    console.log(JSON.stringify({
      level: 'info',
      message: 'Auth attempt',
      requestId,
      ip: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
      path: pathname,
      timestamp: new Date().toISOString(),
    }));
  }

  return response;
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (rate limited per-route via withRateLimit)
     */
    '/((?!_next/static|_next/image|favicon.ico|public/|api/).*)',
  ],
};
