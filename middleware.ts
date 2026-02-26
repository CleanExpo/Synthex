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
    `connect-src 'self' https://api.openrouter.ai https://*.supabase.co wss://*.supabase.co https://res.cloudinary.com https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://github.com https://api.github.com${process.env.NEXT_PUBLIC_WS_URL ? ` ${process.env.NEXT_PUBLIC_WS_URL}` : ''}`,
    "frame-src 'self' https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com",
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
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social',
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

  // Check for custom auth-token cookie (used by unified-login for demo/fallback auth)
  const authToken = request.cookies.get('auth-token')?.value;
  const hasCustomAuth = !!authToken;

  // Apply security headers to all responses
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Note: API rate limiting is handled per-route via withRateLimit() in
  // lib/middleware/rate-limiter.ts (backed by Upstash Redis in production).
  // The middleware matcher below excludes /api/ routes.

  // Authentication check for protected routes
  const protectedPaths = ['/dashboard', '/api/protected', '/api/user', '/api/integrations'];
  // CRITICAL: Both /login and /auth/login exist — /login is the active PKCE flow page,
  // /auth/login is the legacy Supabase page. Treat BOTH as auth paths to prevent loops.
  const authPaths = ['/login', '/auth/login', '/auth/register', '/signup'];
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  const isAuthPath = authPaths.some(path => pathname === path || pathname.startsWith(path + '/'));

  // Skip auth checks for ALL OAuth-related paths — cookies are being SET during these redirects,
  // so they won't exist yet. Without this, users loop back to login after Google sign-in.
  if (
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/api/auth/oauth')
  ) {
    return response;
  }

  // Redirect to login if accessing protected route without session OR custom auth token
  // Trust auth-token cookie immediately — it's set by our own OAuth callback
  if (isProtectedPath && !session && !hasCustomAuth) {
    if (!pathname.startsWith('/api/')) {
      // Redirect to /login — the active login page with PKCE Google flow
      // (NOT /auth/login which is the legacy Supabase page)
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(redirectUrl);
    } else {
      // Return 401 for API routes
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }

  // Redirect to dashboard if accessing auth routes with active session OR custom auth
  if (isAuthPath && (session || hasCustomAuth)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // ──────────────────────────────────────────────────────────────────────
  // Onboarding completion check: redirect to /onboarding if incomplete
  // ──────────────────────────────────────────────────────────────────────
  // Check for both Supabase session AND custom auth token (OAuth uses auth-token)
  if ((session || hasCustomAuth) && pathname.startsWith('/dashboard')) {
    try {
      // Get user ID from session or decode from auth-token
      let userId: string | undefined;
      
      if (session) {
        userId = session.user.id;
      } else if (hasCustomAuth && authToken) {
        // Parse JWT token to get user ID
        // Format: header.payload.signature
        try {
          const parts = authToken.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            userId = payload.userId || payload.sub;
          }
        } catch {
          // Token parse failed, skip onboarding check
          console.warn('[Middleware] Could not parse auth token');
        }
      }

      if (!userId) {
        // Could not determine user ID, allow access to dashboard
        return response;
      }

      // Query profiles table for onboarding_completed flag
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', userId)
        .single();

      // If onboarding is incomplete, redirect to /onboarding
      if (profile && !profile.onboarding_completed) {
        return NextResponse.redirect(new URL('/onboarding', request.url));
      }
    } catch (error) {
      // Log error but don't block user — profiles table may not exist
      // or user may not have a profiles entry yet. Proceed to dashboard.
      console.warn('[Middleware] Could not check onboarding status:', error);
    }
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

  // Security logging handled by API routes

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
