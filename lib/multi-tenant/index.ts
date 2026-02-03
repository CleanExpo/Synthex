/**
 * Multi-Tenant Module
 *
 * @description Exports all multi-tenant functionality
 */

// Context Management
export {
  TenantContextManager,
  TenantContextManager as default,
  tenantStorage,
  type Tenant,
  type TenantPlan,
  type TenantStatus,
  type TenantSettings,
  type TenantContext,
  TenantContextError,
  TenantPermissionError,
  TenantNotFoundError,
  TenantSuspendedError,
  PLAN_LIMITS,
  createDefaultSettings,
  checkTenantLimit,
  generateTenantSlug,
} from './tenant-context';

// Tenant Resolution
export {
  TenantResolver,
  getTenantResolver,
  resolveTenant,
  getTenantById,
  getTenantBySlug,
  type ResolutionStrategy,
  type ResolverConfig,
  type ResolvedTenant,
} from './tenant-resolver';

// Middleware
export {
  TenantMiddleware,
  getTenantMiddleware,
  createTenantMiddleware,
  getTenantFromHeaders,
  requireTenantContext,
  withTenantScope,
  withTenantData,
  type TenantMiddlewareConfig,
} from './tenant-middleware';
