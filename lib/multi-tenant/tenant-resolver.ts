/**
 * Tenant Resolver
 *
 * @description Resolves tenant from various sources:
 * - Subdomain (e.g., acme.synthex.app)
 * - Custom domain (e.g., marketing.acme.com)
 * - Request header (X-Tenant-ID)
 * - JWT token claims
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_APP_DOMAIN: Base app domain (PUBLIC)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 *
 * FAILURE MODE: Returns null if tenant cannot be resolved
 */

import { NextRequest } from 'next/server';
import { getCache } from '@/lib/cache/cache-manager';
import { logger } from '@/lib/logger';
import {
  Tenant,
  TenantNotFoundError,
  TenantSuspendedError,
  createDefaultSettings,
} from './tenant-context';

// ============================================================================
// TYPES
// ============================================================================

export type ResolutionStrategy = 'subdomain' | 'custom_domain' | 'header' | 'jwt' | 'path';

export interface ResolverConfig {
  baseDomain: string;
  strategies: ResolutionStrategy[];
  cacheEnabled: boolean;
  cacheTTL: number;
}

export interface ResolvedTenant {
  tenant: Tenant;
  strategy: ResolutionStrategy;
  identifier: string;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: ResolverConfig = {
  baseDomain: process.env.NEXT_PUBLIC_APP_DOMAIN || 'synthex.app',
  strategies: ['subdomain', 'custom_domain', 'header'],
  cacheEnabled: true,
  cacheTTL: 300, // 5 minutes
};

// ============================================================================
// TENANT RESOLVER
// ============================================================================

export class TenantResolver {
  private config: ResolverConfig;

  constructor(config: Partial<ResolverConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Resolve tenant from request
   */
  async resolve(request: NextRequest): Promise<ResolvedTenant | null> {
    for (const strategy of this.config.strategies) {
      const identifier = this.extractIdentifier(request, strategy);

      if (identifier) {
        try {
          const tenant = await this.fetchTenant(identifier, strategy);

          if (tenant) {
            // Validate tenant status
            if (tenant.status === 'suspended') {
              throw new TenantSuspendedError(tenant.id);
            }

            if (tenant.status !== 'active') {
              logger.warn('Tenant not active', { tenantId: tenant.id, status: tenant.status });
              continue;
            }

            return { tenant, strategy, identifier };
          }
        } catch (error) {
          if (error instanceof TenantSuspendedError) {
            throw error;
          }
          logger.warn('Tenant resolution failed', { strategy, identifier, error });
        }
      }
    }

    return null;
  }

  /**
   * Extract tenant identifier based on strategy
   */
  private extractIdentifier(request: NextRequest, strategy: ResolutionStrategy): string | null {
    switch (strategy) {
      case 'subdomain':
        return this.extractSubdomain(request);

      case 'custom_domain':
        return this.extractCustomDomain(request);

      case 'header':
        return request.headers.get('X-Tenant-ID');

      case 'jwt':
        return this.extractFromJWT(request);

      case 'path':
        return this.extractFromPath(request);

      default:
        return null;
    }
  }

  /**
   * Extract subdomain from hostname
   */
  private extractSubdomain(request: NextRequest): string | null {
    const hostname = request.headers.get('host') || '';
    const baseDomain = this.config.baseDomain;

    // Check if hostname ends with base domain
    if (!hostname.endsWith(baseDomain)) {
      return null;
    }

    // Extract subdomain
    const subdomain = hostname.slice(0, -(baseDomain.length + 1)); // +1 for the dot

    // Ignore www and empty subdomains
    if (!subdomain || subdomain === 'www' || subdomain === 'app') {
      return null;
    }

    return subdomain;
  }

  /**
   * Extract custom domain (full hostname)
   */
  private extractCustomDomain(request: NextRequest): string | null {
    const hostname = request.headers.get('host') || '';
    const baseDomain = this.config.baseDomain;

    // Only return if NOT the base domain
    if (hostname.endsWith(baseDomain)) {
      return null;
    }

    // Remove port if present
    return hostname.split(':')[0];
  }

  /**
   * Extract tenant from JWT token
   */
  private extractFromJWT(request: NextRequest): string | null {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    try {
      // Decode JWT payload (without verification - that's done elsewhere)
      const token = authHeader.slice(7);
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      return payload.tenantId || payload.tenant_id || null;
    } catch {
      return null;
    }
  }

  /**
   * Extract tenant from URL path (e.g., /t/acme/dashboard)
   */
  private extractFromPath(request: NextRequest): string | null {
    const pathname = request.nextUrl.pathname;
    const match = pathname.match(/^\/t\/([^/]+)/);
    return match?.[1] || null;
  }

  /**
   * Fetch tenant from database or cache
   */
  private async fetchTenant(identifier: string, strategy: ResolutionStrategy): Promise<Tenant | null> {
    const cacheKey = `tenant:${strategy}:${identifier}`;

    // Check cache
    if (this.config.cacheEnabled) {
      const cache = getCache();
      const cached = await cache.get<Tenant>(cacheKey);
      if (cached) {
        logger.debug('Tenant resolved from cache', { identifier, strategy });
        return cached;
      }
    }

    // Fetch from database
    const tenant = await this.fetchFromDatabase(identifier, strategy);

    if (tenant && this.config.cacheEnabled) {
      const cache = getCache();
      await cache.set(cacheKey, tenant, {
        ttl: this.config.cacheTTL,
        tags: [`tenant:${tenant.id}`],
      });
    }

    return tenant;
  }

  /**
   * Fetch tenant from database
   */
  private async fetchFromDatabase(
    identifier: string,
    strategy: ResolutionStrategy
  ): Promise<Tenant | null> {
    // In production, this would use Prisma
    // For now, return a mock tenant for development
    const mockTenants: Record<string, Tenant> = {
      demo: {
        id: 'tenant_demo',
        slug: 'demo',
        name: 'Demo Organization',
        domain: 'demo.synthex.app',
        plan: 'pro',
        settings: createDefaultSettings('pro'),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      acme: {
        id: 'tenant_acme',
        slug: 'acme',
        name: 'Acme Corporation',
        domain: 'acme.synthex.app',
        customDomain: 'marketing.acme.com',
        plan: 'enterprise',
        settings: createDefaultSettings('enterprise'),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    // Try to find by slug, domain, or custom domain
    for (const tenant of Object.values(mockTenants)) {
      if (
        tenant.slug === identifier ||
        tenant.domain === identifier ||
        tenant.customDomain === identifier ||
        tenant.id === identifier
      ) {
        return tenant;
      }
    }

    return null;
  }

  /**
   * Invalidate tenant cache
   */
  async invalidateCache(tenantId: string): Promise<void> {
    const cache = getCache();
    await cache.invalidateByTag(`tenant:${tenantId}`);
    logger.debug('Tenant cache invalidated', { tenantId });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let resolverInstance: TenantResolver | null = null;

export function getTenantResolver(config?: Partial<ResolverConfig>): TenantResolver {
  if (!resolverInstance) {
    resolverInstance = new TenantResolver(config);
  }
  return resolverInstance;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Resolve tenant from request (convenience function)
 */
export async function resolveTenant(request: NextRequest): Promise<ResolvedTenant | null> {
  return getTenantResolver().resolve(request);
}

/**
 * Get tenant by ID
 */
export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  const resolver = getTenantResolver();
  // Use header strategy to look up by ID
  const mockRequest = {
    headers: {
      get: (name: string) => name === 'X-Tenant-ID' ? tenantId : null,
    },
    nextUrl: { pathname: '' },
  } as unknown as NextRequest;

  const result = await resolver.resolve(mockRequest);
  return result?.tenant || null;
}

/**
 * Get tenant by slug
 */
export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const resolver = getTenantResolver();
  // Create a mock request with the slug as subdomain
  const mockRequest = {
    headers: {
      get: (name: string) => name === 'host' ? `${slug}.synthex.app` : null,
    },
    nextUrl: { pathname: '' },
  } as unknown as NextRequest;

  const result = await resolver.resolve(mockRequest);
  return result?.tenant || null;
}

// Export default
export default TenantResolver;
