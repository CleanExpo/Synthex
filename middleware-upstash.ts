import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

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
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.ai',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute

// Upstash Redis REST API helper
async function checkRateLimit(key: string): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const now = Date.now();
  const window = RATE_LIMIT_WINDOW;
  const resetTime = now + window;
  
  // If Upstash is not configured, allow all requests
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS, resetTime };
  }
  
  try {
    // Use Upstash REST API for rate limiting
    const url = `${process.env.UPSTASH_REDIS_REST_URL}`;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    const rateLimitKey = `ratelimit:${key}`;
    
    // Get current count
    const getResponse = await fetch(`${url}/get/${rateLimitKey}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    let count = 0;
    let currentResetTime = resetTime;
    
    if (getResponse.ok) {
      const data = await getResponse.json();
      if (data.result) {
        const parsed = JSON.parse(data.result);
        if (parsed.resetTime > now) {
          count = parsed.count;
          currentResetTime = parsed.resetTime;
        }
      }
    }
    
    // Check if limit exceeded
    if (count >= RATE_LIMIT_MAX_REQUESTS) {
      return { allowed: false, remaining: 0, resetTime: currentResetTime };
    }
    
    // Increment count
    count++;
    const ttl = Math.ceil(window / 1000);
    const value = JSON.stringify({ count, resetTime: currentResetTime });
    
    await fetch(`${url}/setex/${rateLimitKey}/${ttl}/${encodeURIComponent(value)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    return { 
      allowed: true, 
      remaining: RATE_LIMIT_MAX_REQUESTS - count, 
      resetTime: currentResetTime 
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // On error, allow the request but log it
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS, resetTime };
  }
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
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
  
  // Rate limiting for API routes
  if (pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const rateLimitKey = `${ip}:${pathname}`;
    
    const { allowed, remaining, resetTime } = await checkRateLimit(rateLimitKey);
    
    if (!allowed) {
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(resetTime).toISOString()
        }
      });
    }
    
    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT_MAX_REQUESTS));
    response.headers.set('X-RateLimit-Remaining', String(remaining));
    response.headers.set('X-RateLimit-Reset', new Date(resetTime).toISOString());
  }
  
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
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};