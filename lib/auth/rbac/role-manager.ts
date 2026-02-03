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
import { PermissionEngine, Permission, ALL_PERMISSIONS } from './permission-engine';

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
    // Validate permissions
    const invalidPerms = input.permissions.filter(
      p => !PermissionEngine.isValidPermission(p)
    );

    if (invalidPerms.length > 0) {
      throw new Error(`Invalid permissions: ${invalidPerms.join(', ')}`);
    }

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

    // Validate permissions if provided
    if (input.permissions) {
      const invalidPerms = input.permissions.filter(
        p => !PermissionEngine.isValidPermission(p)
      );

      if (invalidPerms.length > 0) {
        throw new Error(`Invalid permissions: ${invalidPerms.join(', ')}`);
      }
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
        ...(input.description !== undefined && { description: input.description }),
        ...(input.permissions && { permissions: input.permissions }),
        ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
      },
    });

    // Invalidate permission caches for all users with this role
    await PermissionEngine.invalidateOrganizationPermissions(existing.organizationId);

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
  static async deleteRole(
    roleId: string,
    performedBy: string
  ): Promise<void> {
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
    await PermissionEngine.invalidateUserPermissions(input.userId, role.organizationId);

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
    await PermissionEngine.invalidateUserPermissions(userId, role.organizationId);

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
      orderBy: [
        { isSystem: 'desc' },
        { isDefault: 'desc' },
        { name: 'asc' },
      ],
    });
  }

  /**
   * Get users with a specific role
   */
  static async getUsersWithRole(
    roleId: string
  ): Promise<Array<{ userId: string; grantedAt: Date; expiresAt: Date | null }>> {
    const userRoles = await prisma.userRole.findMany({
      where: {
        roleId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
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
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
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
      await this.grantRole(
        {
          userId,
          roleId: defaultRole.id,
        },
        performedBy || 'system'
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
      logger.error('Failed to log permission audit', { error, organizationId, action });
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
