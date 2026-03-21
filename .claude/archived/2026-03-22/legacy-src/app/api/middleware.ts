/**
 * GLOBAL API MIDDLEWARE
 * 
 * ⚠️ CRITICAL: This middleware runs for EVERY API request
 * It enforces security policies and environment validation
 * 
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: For authentication (CRITICAL)
 * - DATABASE_URL: For database connections (CRITICAL)
 * - RATE_LIMIT_MAX: Max requests per window (INTERNAL)
 * - RATE_LIMIT_WINDOW_MS: Rate limit window (INTERNAL)
 * 
 * FAILURE MODE: API requests will be rejected if validation fails
 */

import { NextRequest, NextResponse } from 'next/server';
import { envValidator, ValidationResult } from '@/lib/security/env-validator';
import { APISecurityChecker, DEFAULT_POLICIES, SecurityPolicy } from '@/lib/security/api-security-checker';

// Cache validation result
let cachedValidation: ValidationResult | null = null;
let lastValidationTime = 0;
const VALIDATION_CACHE_MS = 60000; // Re-validate every minute

/**
 * Route-specific security policies
 */
const ROUTE_POLICIES: Record<string, SecurityPolicy> = {
  // Public endpoints
  '/api/health': DEFAULT_POLICIES.PUBLIC_READ,
  '/api/status': DEFAULT_POLICIES.PUBLIC_READ,
  
  // Authentication endpoints
  '/api/auth/login': {
    ...DEFAULT_POLICIES.PUBLIC_READ,
    rateLimit: { maxRequests: 5, windowMs: 60000 }, // Strict rate limit
    maxBodySize: 1024, // 1KB max
    auditLog: true
  },
  '/api/auth/register': {
    ...DEFAULT_POLICIES.PUBLIC_READ,
    rateLimit: { maxRequests: 3, windowMs: 300000 }, // 3 per 5 minutes
    maxBodySize: 2048, // 2KB max
    auditLog: true
  },
  '/api/auth/logout': DEFAULT_POLICIES.AUTHENTICATED_READ,
  '/api/auth/refresh': DEFAULT_POLICIES.AUTHENTICATED_READ,
  
  // User endpoints
  '/api/user/profile': DEFAULT_POLICIES.AUTHENTICATED_READ,
  '/api/user/update': DEFAULT_POLICIES.AUTHENTICATED_WRITE,
  '/api/user/delete': {
    ...DEFAULT_POLICIES.AUTHENTICATED_WRITE,
    auditLog: true,
    preventCSRF: true
  },
  
  // AI endpoints
  '/api/ai/generate': {
    ...DEFAULT_POLICIES.AUTHENTICATED_WRITE,
    rateLimit: { maxRequests: 20, windowMs: 60000 },
    maxBodySize: 10240, // 10KB
    timeout: 30000 // 30 seconds
  },
  '/api/ai/analyze': {
    ...DEFAULT_POLICIES.AUTHENTICATED_WRITE,
    rateLimit: { maxRequests: 10, windowMs: 60000 },
    maxBodySize: 102400, // 100KB
    timeout: 60000 // 60 seconds
  },
  
  // Admin endpoints
  '/api/admin/*': DEFAULT_POLICIES.ADMIN_ONLY,
  
  // Webhook endpoints
  '/api/webhooks/stripe': {
    ...DEFAULT_POLICIES.WEBHOOK,
    auditLog: true
  },
  '/api/webhooks/github': {
    ...DEFAULT_POLICIES.WEBHOOK,
    auditLog: true
  },
  
  // Default for unmatched routes
  '*': DEFAULT_POLICIES.AUTHENTICATED_READ
};

/**
 * Get security policy for a given path
 */
function getSecurityPolicy(path: string): SecurityPolicy {
  // Exact match
  if (ROUTE_POLICIES[path]) {
    return ROUTE_POLICIES[path];
  }
  
  // Wildcard match
  for (const [pattern, policy] of Object.entries(ROUTE_POLICIES)) {
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      if (path.startsWith(prefix)) {
        return policy;
      }
    }
  }
  
  // Default policy
  return ROUTE_POLICIES['*'];
}

/**
 * Validate environment variables
 */
function validateEnvironment(): ValidationResult {
  const now = Date.now();
  
  // Use cached result if recent
  if (cachedValidation && (now - lastValidationTime) < VALIDATION_CACHE_MS) {
    return cachedValidation;
  }
  
  // Re-validate
  const result = envValidator.validate(false);
  cachedValidation = result;
  lastValidationTime = now;
  
  // Log critical issues
  if (!result.isValid) {
    console.error('🚨 ENVIRONMENT VALIDATION FAILED:');
    for (const error of result.errors) {
      if (error.securityLevel === 'CRITICAL') {
        console.error(`   CRITICAL: ${error.key} - ${error.message}`);
      }
    }
  }
  
  return result;
}

/**
 * Main middleware function
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Skip middleware for static assets
  if (path.startsWith('/_next/') || 
      path.startsWith('/static/') || 
      path.includes('.')) {
    return NextResponse.next();
  }
  
  // Only process API routes
  if (!path.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  try {
    // 1. Validate environment variables
    const envValidation = validateEnvironment();
    
    // Block requests if critical env vars are missing
    if (!envValidation.isValid) {
      const hasCriticalError = envValidation.errors.some(
        e => e.securityLevel === 'CRITICAL'
      );
      
      if (hasCriticalError) {
        console.error(`API request blocked due to missing critical env vars: ${path}`);
        return NextResponse.json(
          { 
            error: 'Server configuration error',
            message: 'The server is not properly configured. Please contact support.',
            requestId: crypto.randomUUID()
          },
          { status: 500 }
        );
      }
    }
    
    // 2. Get security policy for this route
    const policy = getSecurityPolicy(path);
    
    // 3. Run security checks
    const securityResult = await APISecurityChecker.check(request, policy);
    
    // 4. Handle security rejection
    if (!securityResult.allowed) {
      // Determine appropriate status code
      let status = 403; // Forbidden by default
      
      if (securityResult.error?.includes('authentication')) {
        status = 401; // Unauthorized
      } else if (securityResult.error?.includes('rate limit')) {
        status = 429; // Too Many Requests
      } else if (securityResult.error?.includes('body too large')) {
        status = 413; // Payload Too Large
      }
      
      // Create secure error response
      return APISecurityChecker.createSecureResponse(
        {
          error: securityResult.error || 'Access denied',
          requestId: securityResult.context.requestId,
          timestamp: new Date().toISOString()
        },
        status,
        securityResult.context
      );
    }
    
    // 5. Add security headers to response
    const response = NextResponse.next();
    
    // Security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // Request tracking
    response.headers.set('X-Request-ID', securityResult.context.requestId);
    
    // Rate limit headers
    if (policy.rateLimit) {
      response.headers.set('X-RateLimit-Limit', policy.rateLimit.maxRequests.toString());
      response.headers.set('X-RateLimit-Window', policy.rateLimit.windowMs.toString());
    }
    
    // 6. Attach context for use in route handlers
    // This allows route handlers to access security context
    response.headers.set('X-Security-Context', 
      Buffer.from(JSON.stringify(securityResult.context)).toString('base64')
    );
    
    return response;
    
  } catch (error) {
    // Log unexpected errors securely (don't expose details)
    console.error('Middleware error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred',
        requestId: crypto.randomUUID()
      },
      { status: 500 }
    );
  }
}

/**
 * Configure which paths the middleware runs on
 */
export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Exclude static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

/**
 * Helper function for route handlers to get security context
 */
export function getSecurityContext(request: NextRequest): any {
  const contextHeader = request.headers.get('X-Security-Context');
  if (!contextHeader) {
    return null;
  }
  
  try {
    return JSON.parse(Buffer.from(contextHeader, 'base64').toString());
  } catch {
    return null;
  }
}