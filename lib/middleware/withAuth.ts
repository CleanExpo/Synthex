/**
 * Authentication Middleware Wrapper
 *
 * Provides a simple wrapper for protecting API routes with authentication.
 * Uses the existing APISecurityChecker for consistent security handling.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 *
 * @module lib/middleware/withAuth
 */

import { NextRequest, NextResponse } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES, SecurityPolicy, SecurityContext } from '@/lib/security/api-security-checker';

// Extended request type with auth context
export interface AuthenticatedRequest extends NextRequest {
  userId: string;
  userRole: string;
  securityContext: SecurityContext;
}

// Handler type for authenticated routes
export type AuthenticatedHandler = (
  request: AuthenticatedRequest,
  context?: { params?: Promise<Record<string, string>> }
) => Promise<NextResponse>;

// Handler type for public routes with optional auth
export type OptionalAuthHandler = (
  request: NextRequest & { userId?: string; userRole?: string; securityContext?: SecurityContext },
  context?: { params?: Promise<Record<string, string>> }
) => Promise<NextResponse>;

/**
 * Wraps an API route handler with authentication requirement
 *
 * @example
 * export const POST = withAuth(async (request) => {
 *   const { userId } = request;
 *   // Handler has access to authenticated user
 *   return NextResponse.json({ userId });
 * });
 */
export function withAuth(
  handler: AuthenticatedHandler,
  policy: SecurityPolicy = DEFAULT_POLICIES.AUTHENTICATED_WRITE
): (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => Promise<NextResponse> {
  return async (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
    // Run security checks
    const result = await APISecurityChecker.check(request, policy);

    if (!result.allowed) {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: result.error || 'Authentication required',
          code: 'AUTH_REQUIRED'
        },
        result.error?.includes('Rate limit') ? 429 : 401,
        result.context
      );
    }

    // Attach auth info to request
    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.userId = result.context.userId!;
    authenticatedRequest.userRole = result.context.userRole || 'user';
    authenticatedRequest.securityContext = result.context;

    // Execute handler
    try {
      return await handler(authenticatedRequest, context);
    } catch (error) {
      console.error('Handler error:', error);
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        },
        500,
        result.context
      );
    }
  };
}

/**
 * Wraps an API route handler with optional authentication
 * User info will be attached if authenticated, but request proceeds either way
 *
 * @example
 * export const GET = withOptionalAuth(async (request) => {
 *   if (request.userId) {
 *     // User is authenticated
 *   }
 *   return NextResponse.json({ public: true });
 * });
 */
export function withOptionalAuth(
  handler: OptionalAuthHandler,
  policy: Partial<SecurityPolicy> = {}
): (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => Promise<NextResponse> {
  return async (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
    // Run security checks with auth not required
    const optionalPolicy: SecurityPolicy = {
      ...DEFAULT_POLICIES.PUBLIC_READ,
      ...policy,
      requireAuth: false
    };

    const result = await APISecurityChecker.check(request, optionalPolicy);

    // Try to extract user info even if not required
    const authHeader = request.headers.get('authorization');
    const cookieToken = request.cookies.get('auth-token')?.value;

    if (authHeader?.startsWith('Bearer ') || cookieToken) {
      // Attempt auth check
      const authResult = await APISecurityChecker.check(request, {
        ...DEFAULT_POLICIES.AUTHENTICATED_READ,
        rateLimit: undefined // Don't count against rate limit twice
      });

      if (authResult.allowed && authResult.context.userId) {
        const authRequest = request as NextRequest & { userId?: string; userRole?: string; securityContext?: SecurityContext };
        authRequest.userId = authResult.context.userId;
        authRequest.userRole = authResult.context.userRole || 'user';
        authRequest.securityContext = authResult.context;
      }
    }

    // Execute handler
    try {
      return await handler(request, context);
    } catch (error) {
      console.error('Handler error:', error);
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        },
        500,
        result.context
      );
    }
  };
}

/**
 * Wraps an API route handler with admin-only requirement
 *
 * @example
 * export const DELETE = withAdmin(async (request) => {
 *   // Only admins can execute this
 *   return NextResponse.json({ success: true });
 * });
 */
export function withAdmin(
  handler: AuthenticatedHandler
): (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => Promise<NextResponse> {
  return withAuth(handler, DEFAULT_POLICIES.ADMIN_ONLY);
}

/**
 * Extracts user ID from request (for routes that manually handle auth)
 * Returns null if not authenticated
 */
export async function extractUserId(request: NextRequest): Promise<string | null> {
  const result = await APISecurityChecker.check(request, {
    ...DEFAULT_POLICIES.AUTHENTICATED_READ,
    rateLimit: undefined // Don't count against rate limit
  });

  return result.allowed ? result.context.userId || null : null;
}

/**
 * Type guard to check if request is authenticated
 */
export function isAuthenticated(
  request: NextRequest
): request is AuthenticatedRequest {
  const authRequest = request as AuthenticatedRequest;
  return 'userId' in request && typeof authRequest.userId === 'string';
}
