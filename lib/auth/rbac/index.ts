/**
 * RBAC (Role-Based Access Control) Module
 *
 * @description Unified exports for the RBAC system:
 * - Permission Engine: Core permission checking
 * - Role Manager: Role CRUD and user assignments
 * - Access Control: Route protection middleware
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 *
 * USAGE:
 * ```typescript
 * import {
 *   withPermission,
 *   RoleManager,
 *   hasPermission,
 * } from '@/lib/auth/rbac';
 *
 * // Protect a route
 * export const GET = withPermission('posts', 'read', handler);
 *
 * // Check permission programmatically
 * const canEdit = await hasPermission(userId, orgId, 'posts', 'update');
 *
 * // Manage roles
 * await RoleManager.grantRole({ userId, roleId }, performedBy);
 * ```
 */

// Permission Engine
export {
  PermissionEngine,
  hasPermission,
  requirePermission,
  PermissionDeniedError,
  PERMISSIONS,
  ALL_PERMISSIONS,
  type ResourceType,
  type ActionType,
  type Permission,
  type PermissionCheck,
  type PermissionResult,
  type UserPermissions,
} from './permission-engine';

// Role Manager
export {
  RoleManager,
  ROLE_TEMPLATES,
  type RoleInput,
  type RoleUpdateInput,
  type UserRoleInput,
  type Role,
} from './role-manager';

// Access Control Middleware
export {
  withPermission,
  withPermissions,
  withAnyPermission,
  withCustomAccess,
  withOrganizationAccess,
  extractAccessContext,
  extractUserId,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createErrorResponse,
  type AccessControlContext,
  type RouteHandler,
  type ProtectedRouteHandler,
} from './access-control';

// ============================================================================
// CONVENIENCE RE-EXPORTS
// ============================================================================

/**
 * Quick permission check for common operations
 */
export const Permissions = {
  // Posts
  canCreatePost: (userId: string, orgId: string) =>
    hasPermission(userId, orgId, 'posts', 'create'),
  canReadPosts: (userId: string, orgId: string) =>
    hasPermission(userId, orgId, 'posts', 'read'),
  canUpdatePost: (userId: string, orgId: string) =>
    hasPermission(userId, orgId, 'posts', 'update'),
  canDeletePost: (userId: string, orgId: string) =>
    hasPermission(userId, orgId, 'posts', 'delete'),
  canApprovePosts: (userId: string, orgId: string) =>
    hasPermission(userId, orgId, 'posts', 'approve'),

  // Campaigns
  canCreateCampaign: (userId: string, orgId: string) =>
    hasPermission(userId, orgId, 'campaigns', 'create'),
  canReadCampaigns: (userId: string, orgId: string) =>
    hasPermission(userId, orgId, 'campaigns', 'read'),
  canUpdateCampaign: (userId: string, orgId: string) =>
    hasPermission(userId, orgId, 'campaigns', 'update'),
  canManageCampaigns: (userId: string, orgId: string) =>
    hasPermission(userId, orgId, 'campaigns', 'manage'),

  // Analytics
  canViewAnalytics: (userId: string, orgId: string) =>
    hasPermission(userId, orgId, 'analytics', 'read'),
  canExportAnalytics: (userId: string, orgId: string) =>
    hasPermission(userId, orgId, 'analytics', 'export'),

  // Users
  canInviteUsers: (userId: string, orgId: string) =>
    hasPermission(userId, orgId, 'users', 'invite'),
  canManageUsers: (userId: string, orgId: string) =>
    hasPermission(userId, orgId, 'users', 'update'),

  // Roles
  canManageRoles: (userId: string, orgId: string) =>
    hasPermission(userId, orgId, 'roles', 'manage'),

  // Organization
  canManageOrg: (userId: string, orgId: string) =>
    hasPermission(userId, orgId, 'organization', 'manage'),

  // Billing
  canViewBilling: (userId: string, orgId: string) =>
    hasPermission(userId, orgId, 'billing', 'read'),
  canManageBilling: (userId: string, orgId: string) =>
    hasPermission(userId, orgId, 'billing', 'manage'),
};

// ============================================================================
// TYPE GUARDS
// ============================================================================

import type { ResourceType, ActionType } from './permission-engine';
import { PERMISSIONS } from './permission-engine';
import { hasPermission } from './permission-engine';

/**
 * Check if a string is a valid resource type
 */
export function isResourceType(value: string): value is ResourceType {
  return value in PERMISSIONS;
}

/**
 * Check if a string is a valid action type for a resource
 */
export function isValidAction(resource: ResourceType, action: string): action is ActionType {
  return PERMISSIONS[resource]?.includes(action as ActionType) ?? false;
}

/**
 * Parse a permission string (e.g., 'posts:read') into resource and action
 */
export function parsePermission(
  permission: string
): { resource: ResourceType; action: ActionType } | null {
  const [resource, action] = permission.split(':');

  if (!resource || !action) return null;
  if (!isResourceType(resource)) return null;
  if (!isValidAction(resource, action)) return null;

  return { resource, action: action as ActionType };
}
