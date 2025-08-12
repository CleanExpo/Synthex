import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW);

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const pathname = request.nextUrl.pathname;
  
  // Apply security headers to all responses
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  // Rate limiting for API routes
  if (pathname.startsWith('/api/')) {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    
    const rateLimitKey = `${ip}:${pathname}`;
    const rateLimitData = rateLimitStore.get(rateLimitKey);
    
    if (rateLimitData) {
      if (rateLimitData.resetTime > now) {
        if (rateLimitData.count >= RATE_LIMIT_MAX_REQUESTS) {
          return new NextResponse('Too Many Requests', {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((rateLimitData.resetTime - now) / 1000)),
              'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': new Date(rateLimitData.resetTime).toISOString()
            }
          });
        }
        rateLimitData.count++;
      } else {
        rateLimitData.count = 1;
        rateLimitData.resetTime = now + RATE_LIMIT_WINDOW;
      }
    } else {
      rateLimitStore.set(rateLimitKey, {
        count: 1,
        resetTime: now + RATE_LIMIT_WINDOW
      });
    }
    
    // Add rate limit headers
    const currentLimit = rateLimitStore.get(rateLimitKey)!;
    response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT_MAX_REQUESTS));
    response.headers.set('X-RateLimit-Remaining', String(Math.max(0, RATE_LIMIT_MAX_REQUESTS - currentLimit.count)));
    response.headers.set('X-RateLimit-Reset', new Date(currentLimit.resetTime).toISOString());
  }
  
  // Authentication check for protected routes
  const protectedPaths = ['/dashboard', '/api/protected'];
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  
  if (isProtectedPath) {
    const token = request.cookies.get('auth-token');
    
    if (!token && !pathname.startsWith('/api/')) {
      // Redirect to login for web pages
      return NextResponse.redirect(new URL('/login', request.url));
    } else if (!token && pathname.startsWith('/api/')) {
      // Return 401 for API routes
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }
  
  // CSRF protection for mutations
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    const csrfToken = request.headers.get('x-csrf-token');
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    
    // Verify origin/referer for CSRF protection
    if (origin && !origin.includes(request.nextUrl.hostname)) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }
  
  // Add request ID for tracing
  const requestId = crypto.randomUUID();
  response.headers.set('X-Request-Id', requestId);
  
  // Log security events (integrate with monitoring service)
  if (pathname.startsWith('/api/auth')) {
    console.log(`[Security] Auth attempt from ${request.ip} at ${pathname}`);
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
     */
    '/((?!_next/static|_next/image|favicon.ico|public/|api/).*)',
  ],
};
