/**
 * Permission Types & Constants — Client-safe
 *
 * @description Types and static constants for the RBAC permission system.
 * This file has NO server-only imports (no prisma, no ioredis) so it is
 * safe to import in both server and client components.
 *
 * The full PermissionEngine class lives in permission-engine.ts (server-only).
 */

// ============================================================================
// TYPES
// ============================================================================

export type ResourceType =
  | 'posts'
  | 'campaigns'
  | 'analytics'
  | 'personas'
  | 'settings'
  | 'users'
  | 'roles'
  | 'integrations'
  | 'billing'
  | 'organization';

export type ActionType =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'manage'
  | 'export'
  | 'invite'
  | 'approve';

export type Permission = `${ResourceType}:${ActionType}` | '*';

export interface PermissionCheck {
  resource: ResourceType;
  action: ActionType;
  resourceId?: string;
  context?: Record<string, unknown>;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  matchedPermission?: string;
}

export interface UserPermissions {
  userId: string;
  organizationId: string;
  permissions: string[];
  roles: Array<{
    id: string;
    name: string;
    permissions: string[];
  }>;
  cachedAt: Date;
}

// ============================================================================
// PERMISSION DEFINITIONS
// ============================================================================

export const PERMISSIONS: Record<ResourceType, ActionType[]> = {
  posts: ['create', 'read', 'update', 'delete', 'approve'],
  campaigns: ['create', 'read', 'update', 'delete', 'manage'],
  analytics: ['read', 'export'],
  personas: ['create', 'read', 'update', 'delete'],
  settings: ['read', 'update'],
  users: ['read', 'update', 'delete', 'invite'],
  roles: ['create', 'read', 'update', 'delete', 'manage'],
  integrations: ['create', 'read', 'update', 'delete'],
  billing: ['read', 'update', 'manage'],
  organization: ['read', 'update', 'delete', 'manage'],
};

export const ALL_PERMISSIONS: Permission[] = Object.entries(PERMISSIONS).flatMap(
  ([resource, actions]) =>
    actions.map(action => `${resource}:${action}` as Permission)
);
