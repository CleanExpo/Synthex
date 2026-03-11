/**
 * Permission Engine
 *
 * @description Core permission checking and evaluation:
 * - Permission matching with wildcards
 * - Role-based permission aggregation
 * - Permission inheritance
 * - Caching for performance
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 *
 * FAILURE MODE: Denies access on error (fail-secure)
 */

import { prisma } from '@/lib/prisma';
import { getCache } from '@/lib/cache/cache-manager';
import { logger } from '@/lib/logger';

// Re-export types and constants from the client-safe types file.
// Consumers that only need types/constants should import from
// '@/lib/auth/rbac/permission-types' to avoid pulling in server-only deps.
export type {
  ResourceType,
  ActionType,
  Permission,
  PermissionCheck,
  PermissionResult,
  UserPermissions,
} from './permission-types';
export { PERMISSIONS, ALL_PERMISSIONS } from './permission-types';

import type {
  ResourceType,
  ActionType,
  Permission,
  PermissionCheck,
  PermissionResult,
  UserPermissions,
} from './permission-types';
import { PERMISSIONS, ALL_PERMISSIONS } from './permission-types';

// ============================================================================
// PERMISSION ENGINE
// ============================================================================

export class PermissionEngine {
  private static readonly CACHE_TTL = 300; // 5 minutes

  /**
   * Check if a user has a specific permission
   */
  static async check(
    userId: string,
    organizationId: string,
    check: PermissionCheck
  ): Promise<PermissionResult> {
    try {
      // Get user permissions
      const userPerms = await this.getUserPermissions(userId, organizationId);

      if (!userPerms) {
        return { allowed: false, reason: 'User has no permissions in this organization' };
      }

      // Build permission string to check
      const permissionToCheck = `${check.resource}:${check.action}`;

      // Check for wildcard permission first
      if (userPerms.permissions.includes('*')) {
        return { allowed: true, matchedPermission: '*' };
      }

      // Check for exact match
      if (userPerms.permissions.includes(permissionToCheck)) {
        return { allowed: true, matchedPermission: permissionToCheck };
      }

      // Check for resource wildcard (e.g., 'posts:*')
      const resourceWildcard = `${check.resource}:*`;
      if (userPerms.permissions.includes(resourceWildcard)) {
        return { allowed: true, matchedPermission: resourceWildcard };
      }

      // Check for action wildcard (e.g., '*:read')
      const actionWildcard = `*:${check.action}`;
      if (userPerms.permissions.includes(actionWildcard)) {
        return { allowed: true, matchedPermission: actionWildcard };
      }

      // Check for 'manage' permission which implies all actions
      const managePermission = `${check.resource}:manage`;
      if (userPerms.permissions.includes(managePermission)) {
        return { allowed: true, matchedPermission: managePermission };
      }

      return {
        allowed: false,
        reason: `Missing permission: ${permissionToCheck}`,
      };
    } catch (error) {
      logger.error('Permission check failed', { userId, organizationId, check, error });
      return { allowed: false, reason: 'Permission check failed' };
    }
  }

  /**
   * Check multiple permissions at once
   */
  static async checkAll(
    userId: string,
    organizationId: string,
    checks: PermissionCheck[]
  ): Promise<boolean> {
    const results = await Promise.all(
      checks.map(check => this.check(userId, organizationId, check))
    );
    return results.every(r => r.allowed);
  }

  /**
   * Check if user has ANY of the specified permissions
   */
  static async checkAny(
    userId: string,
    organizationId: string,
    checks: PermissionCheck[]
  ): Promise<boolean> {
    const results = await Promise.all(
      checks.map(check => this.check(userId, organizationId, check))
    );
    return results.some(r => r.allowed);
  }

  /**
   * Get all permissions for a user in an organization
   */
  static async getUserPermissions(
    userId: string,
    organizationId: string
  ): Promise<UserPermissions | null> {
    const cache = getCache();
    const cacheKey = `perms:${userId}:${organizationId}`;

    // Check cache
    const cached = await cache.get<UserPermissions>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId,
        role: {
          organizationId,
        },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            permissions: true,
          },
        },
      },
    });

    if (userRoles.length === 0) {
      return null;
    }

    // Aggregate permissions from all roles
    const permissionSet = new Set<string>();
    const roles: UserPermissions['roles'] = [];

    for (const userRole of userRoles) {
      roles.push({
        id: userRole.role.id,
        name: userRole.role.name,
        permissions: userRole.role.permissions,
      });

      for (const perm of userRole.role.permissions) {
        permissionSet.add(perm);
      }
    }

    const userPerms: UserPermissions = {
      userId,
      organizationId,
      permissions: Array.from(permissionSet),
      roles,
      cachedAt: new Date(),
    };

    // Cache the result
    await cache.set(cacheKey, userPerms, {
      ttl: this.CACHE_TTL,
      tags: [`user:${userId}:perms`, `org:${organizationId}:perms`],
    });

    return userPerms;
  }

  /**
   * Invalidate permission cache for a user
   */
  static async invalidateUserPermissions(
    userId: string,
    organizationId?: string
  ): Promise<void> {
    const cache = getCache();

    if (organizationId) {
      await cache.delete(`perms:${userId}:${organizationId}`);
    } else {
      await cache.invalidateByTag(`user:${userId}:perms`);
    }
  }

  /**
   * Invalidate all permission caches for an organization
   */
  static async invalidateOrganizationPermissions(
    organizationId: string
  ): Promise<void> {
    const cache = getCache();
    await cache.invalidateByTag(`org:${organizationId}:perms`);
  }

  /**
   * Expand a permission pattern to all matching permissions
   */
  static expandPermission(pattern: string): Permission[] {
    if (pattern === '*') {
      return ALL_PERMISSIONS;
    }

    const [resource, action] = pattern.split(':');

    if (action === '*') {
      const resourceType = resource as ResourceType;
      return PERMISSIONS[resourceType]?.map(
        a => `${resourceType}:${a}` as Permission
      ) || [];
    }

    if (resource === '*') {
      const actionType = action as ActionType;
      return Object.keys(PERMISSIONS)
        .filter(r => PERMISSIONS[r as ResourceType].includes(actionType))
        .map(r => `${r}:${actionType}` as Permission);
    }

    return [pattern as Permission];
  }

  /**
   * Validate a permission string
   */
  static isValidPermission(permission: string): boolean {
    if (permission === '*') return true;

    const [resource, action] = permission.split(':');

    if (action === '*') {
      return resource in PERMISSIONS;
    }

    if (resource === '*') {
      return Object.values(PERMISSIONS).some(actions =>
        actions.includes(action as ActionType)
      );
    }

    const resourcePerms = PERMISSIONS[resource as ResourceType];
    return resourcePerms?.includes(action as ActionType) || false;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Check permission (convenience function)
 */
export async function hasPermission(
  userId: string,
  organizationId: string,
  resource: ResourceType,
  action: ActionType
): Promise<boolean> {
  const result = await PermissionEngine.check(userId, organizationId, {
    resource,
    action,
  });
  return result.allowed;
}

/**
 * Require permission (throws if denied)
 */
export async function requirePermission(
  userId: string,
  organizationId: string,
  resource: ResourceType,
  action: ActionType
): Promise<void> {
  const result = await PermissionEngine.check(userId, organizationId, {
    resource,
    action,
  });

  if (!result.allowed) {
    throw new PermissionDeniedError(resource, action, result.reason);
  }
}

// ============================================================================
// ERROR CLASS
// ============================================================================

export class PermissionDeniedError extends Error {
  public resource: ResourceType;
  public action: ActionType;

  constructor(resource: ResourceType, action: ActionType, reason?: string) {
    super(reason || `Permission denied: ${resource}:${action}`);
    this.name = 'PermissionDeniedError';
    this.resource = resource;
    this.action = action;
  }
}

// Export default
export default PermissionEngine;
