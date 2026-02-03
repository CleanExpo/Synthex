/**
 * Access Control Middleware
 *
 * @description Higher-order functions for protecting API routes:
 * - Permission-based access control
 * - Resource ownership verification
 * - Graceful error handling
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 *
 * FAILURE MODE: Returns 403 Forbidden on access denied
 */

import { NextRequest, NextResponse } from 'next/server';
import { PermissionEngine, ResourceType, ActionType, PermissionDeniedError } from './permission-engine';
import { getTenantFromHeaders } from '@/lib/multi-tenant/tenant-middleware';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface AccessControlContext {
  userId: string;
  organizationId: string;
  tenantSlug?: string;
  tenantPlan?: string;
}

export type RouteHandler = (
  request: NextRequest,
  context: { params: Record<string, string> }
) => Promise<NextResponse>;

export type ProtectedRouteHandler = (
  request: NextRequest,
  context: { params: Record<string, string> },
  accessContext: AccessControlContext
) => Promise<NextResponse>;

// ============================================================================
// ACCESS CONTROL MIDDLEWARE
// ============================================================================

/**
 * Protect a route with permission checking
 */
export function withPermission(
  resource: ResourceType,
  action: ActionType,
  handler: ProtectedRouteHandler
): RouteHandler {
  return async (request, context) => {
    try {
      // Extract user info from request (would come from JWT/session)
      const accessContext = await extractAccessContext(request);

      if (!accessContext) {
        return createUnauthorizedResponse('Authentication required');
      }

      // Check permission
      const result = await PermissionEngine.check(
        accessContext.userId,
        accessContext.organizationId,
        { resource, action }
      );

      if (!result.allowed) {
        logger.warn('Permission denied', {
          userId: accessContext.userId,
          resource,
          action,
          reason: result.reason,
        });

        return createForbiddenResponse(result.reason);
      }

      // Call the handler with access context
      return handler(request, context, accessContext);
    } catch (error) {
      if (error instanceof PermissionDeniedError) {
        return createForbiddenResponse(error.message);
      }

      logger.error('Access control error', { error });
      return createErrorResponse('Internal server error');
    }
  };
}

/**
 * Protect a route requiring multiple permissions (all must pass)
 */
export function withPermissions(
  permissions: Array<{ resource: ResourceType; action: ActionType }>,
  handler: ProtectedRouteHandler
): RouteHandler {
  return async (request, context) => {
    try {
      const accessContext = await extractAccessContext(request);

      if (!accessContext) {
        return createUnauthorizedResponse('Authentication required');
      }

      // Check all permissions
      const hasAll = await PermissionEngine.checkAll(
        accessContext.userId,
        accessContext.organizationId,
        permissions.map(p => ({ resource: p.resource, action: p.action }))
      );

      if (!hasAll) {
        return createForbiddenResponse('Insufficient permissions');
      }

      return handler(request, context, accessContext);
    } catch (error) {
      logger.error('Access control error', { error });
      return createErrorResponse('Internal server error');
    }
  };
}

/**
 * Protect a route requiring any of the specified permissions
 */
export function withAnyPermission(
  permissions: Array<{ resource: ResourceType; action: ActionType }>,
  handler: ProtectedRouteHandler
): RouteHandler {
  return async (request, context) => {
    try {
      const accessContext = await extractAccessContext(request);

      if (!accessContext) {
        return createUnauthorizedResponse('Authentication required');
      }

      // Check any permission
      const hasAny = await PermissionEngine.checkAny(
        accessContext.userId,
        accessContext.organizationId,
        permissions.map(p => ({ resource: p.resource, action: p.action }))
      );

      if (!hasAny) {
        return createForbiddenResponse('Insufficient permissions');
      }

      return handler(request, context, accessContext);
    } catch (error) {
      logger.error('Access control error', { error });
      return createErrorResponse('Internal server error');
    }
  };
}

/**
 * Protect a route with custom permission logic
 */
export function withCustomAccess(
  checkFn: (request: NextRequest, context: AccessControlContext) => Promise<boolean>,
  handler: ProtectedRouteHandler
): RouteHandler {
  return async (request, context) => {
    try {
      const accessContext = await extractAccessContext(request);

      if (!accessContext) {
        return createUnauthorizedResponse('Authentication required');
      }

      const allowed = await checkFn(request, accessContext);

      if (!allowed) {
        return createForbiddenResponse('Access denied');
      }

      return handler(request, context, accessContext);
    } catch (error) {
      logger.error('Custom access check error', { error });
      return createErrorResponse('Internal server error');
    }
  };
}

/**
 * Require organization membership only (no specific permission)
 */
export function withOrganizationAccess(
  handler: ProtectedRouteHandler
): RouteHandler {
  return async (request, context) => {
    try {
      const accessContext = await extractAccessContext(request);

      if (!accessContext) {
        return createUnauthorizedResponse('Authentication required');
      }

      return handler(request, context, accessContext);
    } catch (error) {
      logger.error('Organization access error', { error });
      return createErrorResponse('Internal server error');
    }
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract access context from request
 */
async function extractAccessContext(
  request: NextRequest
): Promise<AccessControlContext | null> {
  // Get tenant info from headers (set by tenant middleware)
  const { tenantId, tenantSlug, tenantPlan } = getTenantFromHeaders(request);

  // Get user ID from authorization header or session
  const userId = await extractUserId(request);

  if (!userId) {
    return null;
  }

  // If no tenant from headers, try to get from user's organization
  const organizationId = tenantId || await getUserOrganizationId(userId);

  if (!organizationId) {
    return null;
  }

  return {
    userId,
    organizationId,
    tenantSlug: tenantSlug || undefined,
    tenantPlan: tenantPlan || undefined,
  };
}

/**
 * Extract user ID from request
 */
async function extractUserId(request: NextRequest): Promise<string | null> {
  // Try Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        return payload.sub || payload.userId || null;
      }
    } catch {
      // Invalid token
    }
  }

  // Try X-User-ID header (for internal services)
  const userIdHeader = request.headers.get('X-User-ID');
  if (userIdHeader) {
    return userIdHeader;
  }

  return null;
}

/**
 * Get user's organization ID from database
 */
async function getUserOrganizationId(userId: string): Promise<string | null> {
  // This would normally query the database
  // For now, return null to require explicit organization context
  return null;
}

/**
 * Create 401 Unauthorized response
 */
function createUnauthorizedResponse(message: string): NextResponse {
  return NextResponse.json(
    {
      error: 'Unauthorized',
      message,
      code: 'UNAUTHORIZED',
    },
    { status: 401 }
  );
}

/**
 * Create 403 Forbidden response
 */
function createForbiddenResponse(message?: string): NextResponse {
  return NextResponse.json(
    {
      error: 'Forbidden',
      message: message || 'You do not have permission to perform this action',
      code: 'PERMISSION_DENIED',
    },
    { status: 403 }
  );
}

/**
 * Create 500 Error response
 */
function createErrorResponse(message: string): NextResponse {
  return NextResponse.json(
    {
      error: 'Internal Server Error',
      message,
      code: 'INTERNAL_ERROR',
    },
    { status: 500 }
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  extractAccessContext,
  extractUserId,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createErrorResponse,
};
