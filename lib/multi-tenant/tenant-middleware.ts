/**
 * Tenant Middleware
 *
 * @description Next.js middleware for tenant resolution and context:
 * - Resolves tenant from request
 * - Sets up tenant context for the request
 * - Enforces tenant isolation
 * - Handles tenant-specific routing
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_APP_DOMAIN: Base app domain (PUBLIC)
 *
 * FAILURE MODE: Returns 404 for unknown tenants, 403 for suspended
 */

import { NextRequest, NextResponse } from 'next/server';
import { TenantResolver, getTenantResolver, ResolvedTenant } from './tenant-resolver';
import {
  TenantContext,
  TenantSuspendedError,
  TenantNotFoundError,
} from './tenant-context';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface TenantMiddlewareConfig {
  publicPaths: string[];
  excludedPaths: string[];
  requireTenant: boolean;
  onTenantResolved?: (tenant: ResolvedTenant, request: NextRequest) => void | Promise<void>;
  onTenantNotFound?: (request: NextRequest) => NextResponse | void;
  onTenantSuspended?: (tenantId: string, request: NextRequest) => NextResponse | void;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: TenantMiddlewareConfig = {
  publicPaths: [
    '/',
    '/login',
    '/signup',
    '/forgot-password',
    '/pricing',
    '/features',
    '/docs',
    '/api/health',
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh',
  ],
  excludedPaths: [
    '/_next',
    '/static',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
  ],
  requireTenant: false,
};

// ============================================================================
// TENANT MIDDLEWARE
// ============================================================================

export class TenantMiddleware {
  private resolver: TenantResolver;
  private config: TenantMiddlewareConfig;

  constructor(config: Partial<TenantMiddlewareConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.resolver = getTenantResolver();
  }

  /**
   * Process request through tenant middleware
   */
  async handle(request: NextRequest): Promise<NextResponse> {
    const pathname = request.nextUrl.pathname;

    // Skip excluded paths
    if (this.isExcludedPath(pathname)) {
      return NextResponse.next();
    }

    // Check if public path
    const isPublicPath = this.isPublicPath(pathname);

    try {
      // Resolve tenant
      const resolved = await this.resolver.resolve(request);

      if (resolved) {
        // Tenant found - proceed with tenant context
        const response = NextResponse.next();

        // Add tenant info to headers for downstream use
        response.headers.set('X-Tenant-ID', resolved.tenant.id);
        response.headers.set('X-Tenant-Slug', resolved.tenant.slug);
        response.headers.set('X-Tenant-Plan', resolved.tenant.plan);

        // Add request ID
        const requestId = crypto.randomUUID();
        response.headers.set('X-Request-ID', requestId);

        // Call onTenantResolved callback
        if (this.config.onTenantResolved) {
          await this.config.onTenantResolved(resolved, request);
        }

        logger.debug('Tenant resolved', {
          tenantId: resolved.tenant.id,
          strategy: resolved.strategy,
          path: pathname,
        });

        return response;
      }

      // No tenant found
      if (isPublicPath || !this.config.requireTenant) {
        // Allow access to public paths without tenant
        return NextResponse.next();
      }

      // Custom handler for not found
      if (this.config.onTenantNotFound) {
        const customResponse = this.config.onTenantNotFound(request);
        if (customResponse) return customResponse;
      }

      // Default: redirect to main site or show error
      return this.handleTenantNotFound(request);

    } catch (error) {
      if (error instanceof TenantSuspendedError) {
        // Custom handler for suspended
        if (this.config.onTenantSuspended) {
          const customResponse = this.config.onTenantSuspended(
            error.message.split(': ')[1],
            request
          );
          if (customResponse) return customResponse;
        }

        return this.handleTenantSuspended(request);
      }

      logger.error('Tenant middleware error', { error, path: pathname });
      return NextResponse.next();
    }
  }

  /**
   * Check if path is excluded from tenant resolution
   */
  private isExcludedPath(pathname: string): boolean {
    return this.config.excludedPaths.some(
      path => pathname.startsWith(path)
    );
  }

  /**
   * Check if path is public (doesn't require tenant)
   */
  private isPublicPath(pathname: string): boolean {
    return this.config.publicPaths.some(
      path => pathname === path || pathname.startsWith(`${path}/`)
    );
  }

  /**
   * Handle tenant not found
   */
  private handleTenantNotFound(request: NextRequest): NextResponse {
    const url = request.nextUrl.clone();

    // For API routes, return JSON error
    if (url.pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          error: 'Tenant not found',
          code: 'TENANT_NOT_FOUND',
          message: 'The requested organization could not be found',
        },
        { status: 404 }
      );
    }

    // For pages, redirect to main site
    url.host = process.env.NEXT_PUBLIC_APP_DOMAIN || 'synthex.app';
    url.pathname = '/not-found';
    return NextResponse.redirect(url);
  }

  /**
   * Handle tenant suspended
   */
  private handleTenantSuspended(request: NextRequest): NextResponse {
    const url = request.nextUrl.clone();

    // For API routes, return JSON error
    if (url.pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          error: 'Tenant suspended',
          code: 'TENANT_SUSPENDED',
          message: 'This organization has been suspended. Please contact support.',
        },
        { status: 403 }
      );
    }

    // For pages, show suspended page
    url.pathname = '/suspended';
    return NextResponse.rewrite(url);
  }
}

// ============================================================================
// MIDDLEWARE FACTORY
// ============================================================================

/**
 * Create tenant middleware with configuration
 */
export function createTenantMiddleware(
  config?: Partial<TenantMiddlewareConfig>
): (request: NextRequest) => Promise<NextResponse> {
  const middleware = new TenantMiddleware(config);
  return (request) => middleware.handle(request);
}

// ============================================================================
// API ROUTE HELPERS
// ============================================================================

/**
 * Get tenant from request headers (set by middleware)
 */
export function getTenantFromHeaders(request: NextRequest): {
  tenantId: string | null;
  tenantSlug: string | null;
  tenantPlan: string | null;
} {
  return {
    tenantId: request.headers.get('X-Tenant-ID'),
    tenantSlug: request.headers.get('X-Tenant-Slug'),
    tenantPlan: request.headers.get('X-Tenant-Plan'),
  };
}

/**
 * Require tenant context in API route
 */
export function requireTenantContext(request: NextRequest): {
  tenantId: string;
  tenantSlug: string;
  tenantPlan: string;
} {
  const { tenantId, tenantSlug, tenantPlan } = getTenantFromHeaders(request);

  if (!tenantId) {
    throw new TenantNotFoundError('Request');
  }

  return {
    tenantId,
    tenantSlug: tenantSlug || '',
    tenantPlan: tenantPlan || 'free',
  };
}

/**
 * Create tenant-scoped Prisma where clause
 */
export function withTenantScope<T extends Record<string, unknown>>(
  where: T,
  tenantId: string
): T & { tenantId: string } {
  return {
    ...where,
    tenantId,
  };
}

/**
 * Create tenant-scoped data for create operations
 */
export function withTenantData<T extends Record<string, unknown>>(
  data: T,
  tenantId: string
): T & { tenantId: string } {
  return {
    ...data,
    tenantId,
  };
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let middlewareInstance: TenantMiddleware | null = null;

export function getTenantMiddleware(
  config?: Partial<TenantMiddlewareConfig>
): TenantMiddleware {
  if (!middlewareInstance) {
    middlewareInstance = new TenantMiddleware(config);
  }
  return middlewareInstance;
}

// Export default
export default TenantMiddleware;
