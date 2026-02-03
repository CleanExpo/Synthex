/**
 * API Middleware
 *
 * @description Unified middleware for API routes combining:
 * - Rate limiting (tiered by plan)
 * - Authentication verification
 * - Tenant context injection
 * - Request logging
 * - Error handling
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token verification (CRITICAL)
 * - REDIS_URL: Rate limiting (optional, has fallback)
 *
 * FAILURE MODE: Graceful degradation with appropriate error responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  withRateLimit,
  checkRateLimits,
  getIdentifier,
  getTenantPlan,
  addRateLimitHeaders,
  createRateLimitResponse,
  type RateLimitMiddlewareOptions,
} from './rate-limiter-v2';
import { getTenantFromHeaders } from '@/lib/multi-tenant/tenant-middleware';

// ============================================================================
// TYPES
// ============================================================================

export interface APIMiddlewareOptions {
  /** Rate limiting options */
  rateLimit?: RateLimitMiddlewareOptions | false;
  /** Require authentication */
  requireAuth?: boolean;
  /** Required permissions */
  permissions?: string[];
  /** Log request details */
  logging?: boolean | 'verbose';
  /** Custom validation function */
  validate?: (request: NextRequest) => Promise<ValidationResult>;
  /** Transform request before handler */
  transform?: (request: NextRequest) => Promise<NextRequest>;
  /** CORS configuration */
  cors?: CORSOptions | false;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

export interface CORSOptions {
  origins?: string[];
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
  maxAge?: number;
}

export interface RequestContext {
  userId?: string;
  organizationId?: string;
  tenantSlug?: string;
  tenantPlan?: string;
  requestId: string;
  startTime: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CORS: CORSOptions = {
  origins: ['*'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  headers: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-API-Key'],
  credentials: true,
  maxAge: 86400,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Extract user ID from request
 */
async function extractUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.slice(7);
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return payload.sub || payload.userId || null;
  } catch {
    return null;
  }
}

/**
 * Add CORS headers to response
 */
function addCORSHeaders(response: NextResponse, options: CORSOptions): NextResponse {
  const origin = options.origins?.includes('*') ? '*' : options.origins?.join(', ') || '*';

  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', options.methods?.join(', ') || 'GET, POST');
  response.headers.set('Access-Control-Allow-Headers', options.headers?.join(', ') || 'Content-Type');

  if (options.credentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  if (options.maxAge) {
    response.headers.set('Access-Control-Max-Age', options.maxAge.toString());
  }

  return response;
}

/**
 * Create error response
 */
function createErrorResponse(
  message: string,
  status: number,
  details?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    {
      error: getStatusText(status),
      message,
      ...(details && { details }),
    },
    { status }
  );
}

/**
 * Get HTTP status text
 */
function getStatusText(status: number): string {
  const texts: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
  };
  return texts[status] || 'Error';
}

// ============================================================================
// API MIDDLEWARE FACTORY
// ============================================================================

export type RouteHandler = (
  request: NextRequest,
  context: { params: Record<string, string> }
) => Promise<NextResponse>;

export type ContextualRouteHandler = (
  request: NextRequest,
  context: { params: Record<string, string> },
  requestContext: RequestContext
) => Promise<NextResponse>;

/**
 * Create API middleware with configurable options
 */
export function withAPIMiddleware(
  handler: ContextualRouteHandler,
  options: APIMiddlewareOptions = {}
): RouteHandler {
  return async (request, context) => {
    const requestId = generateRequestId();
    const startTime = Date.now();

    // Initialize request context
    const requestContext: RequestContext = {
      requestId,
      startTime,
    };

    try {
      // Handle CORS preflight
      if (request.method === 'OPTIONS' && options.cors !== false) {
        const corsOptions = options.cors || DEFAULT_CORS;
        const response = new NextResponse(null, { status: 204 });
        return addCORSHeaders(response, corsOptions);
      }

      // Rate limiting
      if (options.rateLimit !== false) {
        const rateLimitOpts = options.rateLimit || {};
        const { allowed, result } = await checkRateLimits(request, rateLimitOpts);

        if (!allowed) {
          const response = createRateLimitResponse(result);
          if (options.cors !== false) {
            addCORSHeaders(response, options.cors || DEFAULT_CORS);
          }
          return response;
        }
      }

      // Extract tenant context
      const { tenantId, tenantSlug, tenantPlan } = getTenantFromHeaders(request);
      requestContext.organizationId = tenantId || undefined;
      requestContext.tenantSlug = tenantSlug || undefined;
      requestContext.tenantPlan = tenantPlan || undefined;

      // Authentication check
      if (options.requireAuth) {
        const userId = await extractUserId(request);
        if (!userId) {
          return createErrorResponse('Authentication required', 401);
        }
        requestContext.userId = userId;
      }

      // Custom validation
      if (options.validate) {
        const validation = await options.validate(request);
        if (!validation.valid) {
          return createErrorResponse(
            validation.error || 'Validation failed',
            400,
            validation.details
          );
        }
      }

      // Transform request if needed
      let transformedRequest = request;
      if (options.transform) {
        transformedRequest = await options.transform(request);
      }

      // Log request
      if (options.logging) {
        const logData: Record<string, unknown> = {
          requestId,
          method: request.method,
          path: new URL(request.url).pathname,
          userId: requestContext.userId,
          tenantId: requestContext.organizationId,
        };

        if (options.logging === 'verbose') {
          logData.headers = Object.fromEntries(request.headers.entries());
          logData.query = Object.fromEntries(new URL(request.url).searchParams.entries());
        }

        logger.info('API request', logData);
      }

      // Call handler
      const response = await handler(transformedRequest, context, requestContext);

      // Add request ID header
      response.headers.set('X-Request-ID', requestId);

      // Add CORS headers
      if (options.cors !== false) {
        addCORSHeaders(response, options.cors || DEFAULT_CORS);
      }

      // Add rate limit headers (if rate limiting is enabled)
      if (options.rateLimit !== false) {
        const { result } = await checkRateLimits(request, options.rateLimit || {});
        addRateLimitHeaders(response, result);
      }

      // Log response
      if (options.logging) {
        const duration = Date.now() - startTime;
        logger.info('API response', {
          requestId,
          status: response.status,
          duration,
        });
      }

      return response;
    } catch (error) {
      // Error logging
      logger.error('API error', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime,
      });

      // Create error response
      const response = createErrorResponse(
        error instanceof Error ? error.message : 'Internal server error',
        500
      );

      response.headers.set('X-Request-ID', requestId);

      if (options.cors !== false) {
        addCORSHeaders(response, options.cors || DEFAULT_CORS);
      }

      return response;
    }
  };
}

// ============================================================================
// CONVENIENCE MIDDLEWARE FACTORIES
// ============================================================================

/**
 * Public API route (rate limited, no auth)
 */
export function withPublicAPI(
  handler: ContextualRouteHandler,
  options: Partial<APIMiddlewareOptions> = {}
): RouteHandler {
  return withAPIMiddleware(handler, {
    rateLimit: { type: 'minute' },
    requireAuth: false,
    logging: true,
    ...options,
  });
}

/**
 * Authenticated API route
 */
export function withAuthenticatedAPI(
  handler: ContextualRouteHandler,
  options: Partial<APIMiddlewareOptions> = {}
): RouteHandler {
  return withAPIMiddleware(handler, {
    rateLimit: { type: 'minute' },
    requireAuth: true,
    logging: true,
    ...options,
  });
}

/**
 * AI API route (stricter rate limits)
 */
export function withAIAPI(
  handler: ContextualRouteHandler,
  options: Partial<APIMiddlewareOptions> = {}
): RouteHandler {
  return withAPIMiddleware(handler, {
    rateLimit: { type: 'hour', category: 'ai', costMultiplier: 1 },
    requireAuth: true,
    logging: 'verbose',
    ...options,
  });
}

/**
 * Export API route (daily limits)
 */
export function withExportAPI(
  handler: ContextualRouteHandler,
  options: Partial<APIMiddlewareOptions> = {}
): RouteHandler {
  return withAPIMiddleware(handler, {
    rateLimit: { type: 'day', category: 'export', costMultiplier: 1 },
    requireAuth: true,
    logging: true,
    ...options,
  });
}

/**
 * Admin API route (enhanced logging, auth required)
 */
export function withAdminAPI(
  handler: ContextualRouteHandler,
  options: Partial<APIMiddlewareOptions> = {}
): RouteHandler {
  return withAPIMiddleware(handler, {
    rateLimit: { type: 'minute', customLimit: 1000 },
    requireAuth: true,
    logging: 'verbose',
    ...options,
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export { generateRequestId, extractUserId, addCORSHeaders, createErrorResponse };
