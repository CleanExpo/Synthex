/**
 * Tenant Context Management
 *
 * @description Provides tenant context throughout the application:
 * - AsyncLocalStorage for request-scoped tenant data
 * - Tenant isolation utilities
 * - Context propagation across async boundaries
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 *
 * FAILURE MODE: Throws error if tenant context not initialized
 */

import { AsyncLocalStorage } from 'async_hooks';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  domain?: string;
  customDomain?: string;
  plan: TenantPlan;
  settings: TenantSettings;
  status: TenantStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type TenantPlan = 'free' | 'starter' | 'pro' | 'enterprise';
export type TenantStatus = 'active' | 'suspended' | 'pending' | 'deleted';

export interface TenantSettings {
  branding?: {
    logo?: string;
    primaryColor?: string;
    favicon?: string;
  };
  features?: {
    maxUsers: number;
    maxPosts: number;
    maxCampaigns: number;
    apiAccess: boolean;
    customIntegrations: boolean;
    whiteLabeling: boolean;
  };
  security?: {
    mfaRequired: boolean;
    ssoEnabled: boolean;
    ipWhitelist?: string[];
    sessionTimeout: number;
  };
  notifications?: {
    emailEnabled: boolean;
    slackEnabled: boolean;
    webhookUrl?: string;
  };
}

export interface TenantContext {
  tenant: Tenant;
  userId?: string;
  sessionId?: string;
  requestId: string;
  permissions?: string[];
}

// ============================================================================
// ASYNC LOCAL STORAGE
// ============================================================================

const tenantStorage = new AsyncLocalStorage<TenantContext>();

// ============================================================================
// TENANT CONTEXT MANAGER
// ============================================================================

export class TenantContextManager {
  /**
   * Run a function within a tenant context
   */
  static run<T>(context: TenantContext, fn: () => T): T {
    return tenantStorage.run(context, fn);
  }

  /**
   * Run an async function within a tenant context
   */
  static async runAsync<T>(context: TenantContext, fn: () => Promise<T>): Promise<T> {
    return tenantStorage.run(context, fn);
  }

  /**
   * Get the current tenant context
   */
  static getContext(): TenantContext | undefined {
    return tenantStorage.getStore();
  }

  /**
   * Get the current tenant (throws if not in context)
   */
  static getTenant(): Tenant {
    const context = this.getContext();
    if (!context?.tenant) {
      throw new TenantContextError('No tenant context available');
    }
    return context.tenant;
  }

  /**
   * Get the current tenant ID (throws if not in context)
   */
  static getTenantId(): string {
    return this.getTenant().id;
  }

  /**
   * Get the current tenant safely (returns null if not in context)
   */
  static getTenantSafe(): Tenant | null {
    return this.getContext()?.tenant || null;
  }

  /**
   * Check if currently in a tenant context
   */
  static hasTenantContext(): boolean {
    return !!this.getContext()?.tenant;
  }

  /**
   * Get user ID from context
   */
  static getUserId(): string | undefined {
    return this.getContext()?.userId;
  }

  /**
   * Get request ID from context
   */
  static getRequestId(): string {
    return this.getContext()?.requestId || 'unknown';
  }

  /**
   * Check if user has permission
   */
  static hasPermission(permission: string): boolean {
    const permissions = this.getContext()?.permissions || [];
    return permissions.includes(permission) || permissions.includes('*');
  }

  /**
   * Require permission (throws if not granted)
   */
  static requirePermission(permission: string): void {
    if (!this.hasPermission(permission)) {
      throw new TenantPermissionError(`Permission denied: ${permission}`);
    }
  }
}

// ============================================================================
// ERROR CLASSES
// ============================================================================

export class TenantContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantContextError';
  }
}

export class TenantPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantPermissionError';
  }
}

export class TenantNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Tenant not found: ${identifier}`);
    this.name = 'TenantNotFoundError';
  }
}

export class TenantSuspendedError extends Error {
  constructor(tenantId: string) {
    super(`Tenant is suspended: ${tenantId}`);
    this.name = 'TenantSuspendedError';
  }
}

// ============================================================================
// PLAN LIMITS
// ============================================================================

export const PLAN_LIMITS: Record<TenantPlan, TenantSettings['features']> = {
  free: {
    maxUsers: 1,
    maxPosts: 50,
    maxCampaigns: 3,
    apiAccess: false,
    customIntegrations: false,
    whiteLabeling: false,
  },
  starter: {
    maxUsers: 5,
    maxPosts: 500,
    maxCampaigns: 10,
    apiAccess: true,
    customIntegrations: false,
    whiteLabeling: false,
  },
  pro: {
    maxUsers: 25,
    maxPosts: 5000,
    maxCampaigns: 50,
    apiAccess: true,
    customIntegrations: true,
    whiteLabeling: false,
  },
  enterprise: {
    maxUsers: -1, // Unlimited
    maxPosts: -1,
    maxCampaigns: -1,
    apiAccess: true,
    customIntegrations: true,
    whiteLabeling: true,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a default tenant settings object
 */
export function createDefaultSettings(plan: TenantPlan): TenantSettings {
  return {
    features: PLAN_LIMITS[plan],
    security: {
      mfaRequired: plan === 'enterprise',
      ssoEnabled: plan === 'enterprise',
      sessionTimeout: 3600, // 1 hour
    },
    notifications: {
      emailEnabled: true,
      slackEnabled: plan !== 'free',
    },
  };
}

/**
 * Check if tenant has reached a limit
 */
export function checkTenantLimit(
  tenant: Tenant,
  limitType: keyof NonNullable<TenantSettings['features']>,
  currentValue: number
): { allowed: boolean; limit: number; remaining: number } {
  const limit = tenant.settings.features?.[limitType] as number;

  if (limit === -1) {
    return { allowed: true, limit: -1, remaining: -1 };
  }

  const remaining = Math.max(0, limit - currentValue);
  return {
    allowed: currentValue < limit,
    limit,
    remaining,
  };
}

/**
 * Generate a tenant slug from name
 */
export function generateTenantSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  tenantStorage,
  TenantContextManager as default,
};
