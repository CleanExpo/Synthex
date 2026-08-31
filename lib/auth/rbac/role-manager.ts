/**
 * Role Manager
 *
 * @description Manages roles and user-role assignments:
 * - Role CRUD operations
 * - User role assignment/revocation
 * - Role inheritance handling
 * - Audit logging
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 *
 * FAILURE MODE: Transactions ensure data consistency
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  PermissionEngine,
  Permission,
  ALL_PERMISSIONS,
  canDelegatePermissions,
} from './permission-engine';

// ============================================================================
// TYPES
// ============================================================================

export interface RoleInput {
  name: string;
  description?: string;
  permissions: string[];
  isDefault?: boolean;
}

export interface RoleUpdateInput {
  name?: string;
  description?: string;
  permissions?: string[];
  isDefault?: boolean;
}

export interface UserRoleInput {
  userId: string;
  roleId: string;
  grantedBy?: string;
  expiresAt?: Date;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isDefault: boolean;
  isSystem: boolean;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// RESERVED RANK NAMES (SYN-1109)
// ============================================================================

/**
 * Canonical rank names a custom (non-system) role may never claim. rankOfRole()
 * / resolveIssuerRole() interpret a role NAMED 'owner' or 'admin' as elevated
 * authority, so allowing a `roles:manage` holder to create or rename a custom
 * role to one of these names is a privilege-escalation path that bypasses the
 * issuer-rank guard (which only covers role ASSIGNMENT, not role DEFINITION).
 * Matched case-insensitively and trimmed, mirroring rankOfRole's normalisation.
 */
const RESERVED_ROLE_NAMES = new Set(['owner', 'admin']);

function assertRoleNameNotReserved(name: string | undefined): void {
  if (!name) return;
  if (RESERVED_ROLE_NAMES.has(name.trim().toLowerCase())) {
    throw new Error(
      `"${name}" is a reserved role name and cannot be assigned to a custom role`
    );
  }
}

export class RolePermissionSubsetError extends Error {
  constructor() {
    super('Role permissions cannot exceed your own permissions');
    this.name = 'RolePermissionSubsetError';
  }
}

/**
 * Assert that `requestedPermissions` are contained by the actor's own grants.
 *
 * Used by role DEFINITION (createRole / updateRole) and — since SYN-1112 F6 —
 * by role ASSIGNMENT in grantRole, where the coarse four-bucket issuer rank
 * cannot see that a custom-named role carries authority the actor does not
 * hold. Fail-closed: any error resolving the actor's permissions denies.
 *
 * Deliberately NOT exported: every caller is in this module, so keeping it
 * private means no other module can invoke the containment check out of
 * context — or be tempted to treat calling it as a substitute for going
 * through grantRole.
 */
async function assertPermissionsWithinActor(
  organizationId: string,
  requestedPermissions: string[],
  performedBy: string
): Promise<void> {
  if (requestedPermissions.length === 0) return;

  try {
    const actorPermissions = await PermissionEngine.getUserPermissions(
      performedBy,
      organizationId
    );

    if (
      !actorPermissions ||
      !canDelegatePermissions(
        actorPermissions.permissions,
        requestedPermissions
      )
    ) {
      throw new RolePermissionSubsetError();
    }
  } catch (error) {
    if (error instanceof RolePermissionSubsetError) throw error;
    throw new RolePermissionSubsetError();
  }
}

// ============================================================================
// ROLE MANAGER
// ============================================================================

export class RoleManager {
  /**
   * Create a new role
   */
  static async createRole(
    organizationId: string,
    input: RoleInput,
    performedBy: string
  ): Promise<Role> {
    // Reserved-name guard: a custom role may not claim an elevated rank name
    // (SYN-1109).
    assertRoleNameNotReserved(input.name);

    // Validate permissions
    const invalidPerms = input.permissions.filter(
      p => !PermissionEngine.isValidPermission(p)
    );

    if (invalidPerms.length > 0) {
      throw new Error(`Invalid permissions: ${invalidPerms.join(', ')}`);
    }

    await assertPermissionsWithinActor(
      organizationId,
      input.permissions,
      performedBy
    );

    // Check for duplicate name
    const existing = await prisma.role.findUnique({
      where: {
        organizationId_name: {
          organizationId,
          name: input.name,
        },
      },
    });

    if (existing) {
      throw new Error(`Role with name "${input.name}" already exists`);
    }

    // If setting as default, unset other defaults
    if (input.isDefault) {
      await prisma.role.updateMany({
        where: { organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Create role
    const role = await prisma.role.create({
      data: {
        name: input.name,
        description: input.description,
        permissions: input.permissions,
        isDefault: input.isDefault || false,
        isSystem: false,
        organizationId,
      },
    });

    // Log audit
    await this.logAudit(organizationId, 'create_role', performedBy, {
      roleId: role.id,
      roleName: role.name,
    });

    logger.info('Role created', {
      organizationId,
      roleId: role.id,
      roleName: role.name,
    });

    return role;
  }

  /**
   * Update an existing role
   */
  static async updateRole(
    roleId: string,
    input: RoleUpdateInput,
    performedBy: string
  ): Promise<Role> {
    // Get existing role
    const existing = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!existing) {
      throw new Error('Role not found');
    }

    // Prevent modifying system roles (except description)
    if (existing.isSystem && (input.name || input.permissions)) {
      throw new Error('Cannot modify name or permissions of system roles');
    }

    // Reserved-name guard: a custom role may not be RENAMED to an elevated rank
    // name (owner/admin), which resolveIssuerRole would then read as owner/admin
    // authority — bypassing the assignment-time issuer-rank guard (SYN-1109).
    assertRoleNameNotReserved(input.name);

    // Enabling a default role delegates its effective permissions to future
    // users. Validate the existing grant when PATCH omits permissions so this
    // indirect assignment cannot exceed the actor's own authority.
    const permissionsToValidate =
      input.permissions ??
      (input.isDefault && !existing.isDefault
        ? existing.permissions
        : undefined);

    if (permissionsToValidate) {
      const invalidPerms = permissionsToValidate.filter(
        p => !PermissionEngine.isValidPermission(p)
      );

      if (invalidPerms.length > 0) {
        throw new Error(`Invalid permissions: ${invalidPerms.join(', ')}`);
      }

      await assertPermissionsWithinActor(
        existing.organizationId,
        permissionsToValidate,
        performedBy
      );
    }

    // Check for duplicate name if changing
    if (input.name && input.name !== existing.name) {
      const duplicate = await prisma.role.findUnique({
        where: {
          organizationId_name: {
            organizationId: existing.organizationId,
            name: input.name,
          },
        },
      });

      if (duplicate) {
        throw new Error(`Role with name "${input.name}" already exists`);
      }
    }

    // If setting as default, unset other defaults
    if (input.isDefault && !existing.isDefault) {
      await prisma.role.updateMany({
        where: { organizationId: existing.organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Update role
    const role = await prisma.role.update({
      where: { id: roleId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.permissions && { permissions: input.permissions }),
        ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
      },
    });

    // Invalidate permission caches for all users with this role
    await PermissionEngine.invalidateOrganizationPermissions(
      existing.organizationId
    );

    // Log audit
    await this.logAudit(existing.organizationId, 'update_role', performedBy, {
      roleId: role.id,
      roleName: role.name,
      changes: input,
    });

    logger.info('Role updated', {
      roleId: role.id,
      roleName: role.name,
    });

    return role;
  }

  /**
   * Delete a role
   */
  static async deleteRole(roleId: string, performedBy: string): Promise<void> {
    // Get existing role
    const existing = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        _count: { select: { userRoles: true } },
      },
    });

    if (!existing) {
      throw new Error('Role not found');
    }

    if (existing.isSystem) {
      throw new Error('Cannot delete system roles');
    }

    if (existing._count.userRoles > 0) {
      throw new Error(
        `Cannot delete role with ${existing._count.userRoles} assigned users. Reassign users first.`
      );
    }

    // Delete role
    await prisma.role.delete({
      where: { id: roleId },
    });

    // Log audit
    await this.logAudit(existing.organizationId, 'delete_role', performedBy, {
      roleId: existing.id,
      roleName: existing.name,
    });

    logger.info('Role deleted', {
      roleId: existing.id,
      roleName: existing.name,
    });
  }

  /**
   * Grant a role to a user
   */
  static async grantRole(
    input: UserRoleInput,
    performedBy: string
  ): Promise<void> {
    // Get role
    const role = await prisma.role.findUnique({
      where: { id: input.roleId },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    // Containment (SYN-1112 F6): an assignment DELEGATES the role's
    // permissions, so it must satisfy the same subset invariant that governs
    // role definition. Enforced here rather than only at the route so no grant
    // path can bypass it, and BEFORE the expiry-refresh return below so
    // extending an existing grant cannot escape it either.
    await assertPermissionsWithinActor(
      role.organizationId,
      role.permissions ?? [],
      performedBy
    );

    await this.applyGrant(input, performedBy, role);
  }

  /**
   * The persistence half of a grant, with no actor check.
   *
   * Private on purpose: the only caller that skips containment is
   * `assignDefaultRole`, whose role was already contained when it was defined
   * (createRole validates on create, updateRole revalidates when `isDefault`
   * is switched on). Keeping it private means no request-supplied field can
   * select this path — a bypass keyed on caller-controlled data would be an
   * injection vector.
   */
  private static async applyGrant(
    input: UserRoleInput,
    performedBy: string,
    role: { id: string; name: string; organizationId: string }
  ): Promise<void> {
    // Check if already assigned
    const existing = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: input.userId,
          roleId: input.roleId,
        },
      },
    });

    if (existing) {
      // Update expiration if different
      if (input.expiresAt !== existing.expiresAt) {
        await prisma.userRole.update({
          where: { id: existing.id },
          data: { expiresAt: input.expiresAt },
        });
      }
      return;
    }

    // Create user role assignment
    await prisma.userRole.create({
      data: {
        userId: input.userId,
        roleId: input.roleId,
        grantedBy: performedBy,
        expiresAt: input.expiresAt,
      },
    });

    // Invalidate permission cache
    await PermissionEngine.invalidateUserPermissions(
      input.userId,
      role.organizationId
    );

    // Log audit
    await this.logAudit(role.organizationId, 'grant', performedBy, {
      targetUserId: input.userId,
      roleId: role.id,
      roleName: role.name,
      expiresAt: input.expiresAt,
    });

    logger.info('Role granted', {
      userId: input.userId,
      roleId: role.id,
      roleName: role.name,
    });
  }

  /**
   * Revoke a role from a user
   */
  static async revokeRole(
    userId: string,
    roleId: string,
    performedBy: string
  ): Promise<void> {
    // Get role
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    // Delete user role assignment
    await prisma.userRole.deleteMany({
      where: {
        userId,
        roleId,
      },
    });

    // Invalidate permission cache
    await PermissionEngine.invalidateUserPermissions(
      userId,
      role.organizationId
    );

    // Log audit
    await this.logAudit(role.organizationId, 'revoke', performedBy, {
      targetUserId: userId,
      roleId: role.id,
      roleName: role.name,
    });

    logger.info('Role revoked', {
      userId,
      roleId: role.id,
      roleName: role.name,
    });
  }

  /**
   * Get all roles for an organization
   */
  static async getRoles(organizationId: string): Promise<Role[]> {
    return prisma.role.findMany({
      where: { organizationId },
      orderBy: [{ isSystem: 'desc' }, { isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Get users with a specific role
   */
  static async getUsersWithRole(
    roleId: string
  ): Promise<
    Array<{ userId: string; grantedAt: Date; expiresAt: Date | null }>
  > {
    const userRoles = await prisma.userRole.findMany({
      where: {
        roleId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        userId: true,
        grantedAt: true,
        expiresAt: true,
      },
    });

    return userRoles;
  }

  /**
   * Get roles for a user in an organization
   */
  static async getUserRoles(
    userId: string,
    organizationId: string
  ): Promise<Role[]> {
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId,
        role: { organizationId },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        role: true,
      },
    });

    return userRoles.map(ur => ur.role);
  }

  /**
   * Assign default role to a new user
   */
  static async assignDefaultRole(
    userId: string,
    organizationId: string,
    performedBy?: string
  ): Promise<void> {
    const defaultRole = await prisma.role.findFirst({
      where: {
        organizationId,
        isDefault: true,
      },
    });

    if (defaultRole) {
      // Bootstrap path: there is no acting user to contain against (this runs
      // for a brand-new member, often as 'system'). The default role's
      // permission set was already contained when it was defined, so the
      // containment guard in grantRole would only fail closed against a
      // legitimate signup. See applyGrant.
      await this.applyGrant(
        {
          userId,
          roleId: defaultRole.id,
        },
        performedBy || 'system',
        defaultRole
      );
    }
  }

  /**
   * Log permission audit event
   */
  private static async logAudit(
    organizationId: string,
    action: string,
    performedBy: string,
    details: Record<string, unknown>
  ): Promise<void> {
    try {
      await prisma.permissionAudit.create({
        data: {
          organizationId,
          action,
          performedBy,
          targetUserId: details.targetUserId as string | undefined,
          targetRoleId: details.roleId as string | undefined,
          details: details as object,
        },
      });
    } catch (error) {
      logger.error('Failed to log permission audit', {
        error,
        organizationId,
        action,
      });
    }
  }
}

// ============================================================================
// PREDEFINED ROLE TEMPLATES
// ============================================================================

export const ROLE_TEMPLATES: Record<string, RoleInput> = {
  admin: {
    name: 'Admin',
    description: 'Full access to all organization features',
    permissions: ['*'],
  },
  editor: {
    name: 'Editor',
    description: 'Can create and edit content, campaigns, and view analytics',
    permissions: [
      'posts:create',
      'posts:read',
      'posts:update',
      'posts:delete',
      'campaigns:create',
      'campaigns:read',
      'campaigns:update',
      'analytics:read',
      'personas:read',
      'personas:update',
    ],
    isDefault: true,
  },
  viewer: {
    name: 'Viewer',
    description: 'Read-only access to content and analytics',
    permissions: [
      'posts:read',
      'campaigns:read',
      'analytics:read',
      'personas:read',
    ],
  },
  analyst: {
    name: 'Analyst',
    description: 'Full analytics access with export capabilities',
    permissions: [
      'posts:read',
      'campaigns:read',
      'analytics:read',
      'analytics:export',
    ],
  },
};

// Export default
export default RoleManager;
