/**
 * Single Role API Route
 *
 * @description GET, PATCH, DELETE for individual roles
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 *
 * @module app/api/roles/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getUserIdFromCookies } from '@/lib/auth/jwt-utils';
import { RoleManager } from '@/lib/auth/rbac/role-manager';
import { PermissionEngine } from '@/lib/auth/rbac/permission-engine';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';
import { logger } from '@/lib/logger';

// =============================================================================
// Schemas
// =============================================================================

const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  permissions: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get user with organizationId, verify roles:manage permission
 */
async function getUserWithPermission(userId: string): Promise<{
  user: { id: string; organizationId: string | null };
  hasPermission: boolean;
} | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, organizationId: true },
  });

  if (!user || !user.organizationId) {
    return null;
  }

  const permissionResult = await PermissionEngine.check(userId, user.organizationId, {
    resource: 'roles',
    action: 'manage',
  });

  return {
    user: user as { id: string; organizationId: string },
    hasPermission: permissionResult.allowed,
  };
}

// =============================================================================
// Route Handlers
// =============================================================================

/**
 * GET /api/roles/[id] - Get single role with user count
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roleId } = await params;

    const userId = await getUserIdFromCookies();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const userResult = await getUserWithPermission(userId);
    if (!userResult) {
      return NextResponse.json(
        { error: 'Not Found', message: 'User or organization not found' },
        { status: 404 }
      );
    }

    if (!userResult.hasPermission) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'roles:manage permission required' },
        { status: 403 }
      );
    }

    // Get role and verify organization ownership
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        _count: {
          select: {
            userRoles: {
              where: {
                OR: [
                  { expiresAt: null },
                  { expiresAt: { gt: new Date() } },
                ],
              },
            },
          },
        },
      },
    });

    if (!role) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Role not found' },
        { status: 404 }
      );
    }

    if (role.organizationId !== userResult.user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Role does not belong to your organization' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        isDefault: role.isDefault,
        isSystem: role.isSystem,
        organizationId: role.organizationId,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
        userCount: role._count.userRoles,
      },
    });
  } catch (error: unknown) {
    logger.error('Get role error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to get role') },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/roles/[id] - Update a role
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roleId } = await params;

    const userId = await getUserIdFromCookies();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const userResult = await getUserWithPermission(userId);
    if (!userResult) {
      return NextResponse.json(
        { error: 'Not Found', message: 'User or organization not found' },
        { status: 404 }
      );
    }

    if (!userResult.hasPermission) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'roles:manage permission required' },
        { status: 403 }
      );
    }

    // Verify role belongs to organization
    const existingRole = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!existingRole) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Role not found' },
        { status: 404 }
      );
    }

    if (existingRole.organizationId !== userResult.user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Role does not belong to your organization' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = updateRoleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, description, permissions, isDefault } = validation.data;

    const role = await RoleManager.updateRole(
      roleId,
      { name, description: description ?? undefined, permissions, isDefault },
      userId
    );

    // Get updated user count
    const userCount = await prisma.userRole.count({
      where: {
        roleId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Role updated successfully',
      data: {
        ...role,
        userCount,
      },
    });
  } catch (error: unknown) {
    logger.error('Update role error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('system roles')) {
      return NextResponse.json(
        { error: 'Forbidden', message: errorMessage },
        { status: 403 }
      );
    }
    if (errorMessage.includes('already exists')) {
      return NextResponse.json(
        { error: 'Conflict', message: errorMessage },
        { status: 409 }
      );
    }
    if (errorMessage.includes('Invalid permissions')) {
      return NextResponse.json(
        { error: 'Validation Error', message: errorMessage },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to update role') },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/roles/[id] - Delete a role
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roleId } = await params;

    const userId = await getUserIdFromCookies();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const userResult = await getUserWithPermission(userId);
    if (!userResult) {
      return NextResponse.json(
        { error: 'Not Found', message: 'User or organization not found' },
        { status: 404 }
      );
    }

    if (!userResult.hasPermission) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'roles:manage permission required' },
        { status: 403 }
      );
    }

    // Verify role belongs to organization
    const existingRole = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!existingRole) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Role not found' },
        { status: 404 }
      );
    }

    if (existingRole.organizationId !== userResult.user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Role does not belong to your organization' },
        { status: 403 }
      );
    }

    await RoleManager.deleteRole(roleId, userId);

    return NextResponse.json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error: unknown) {
    logger.error('Delete role error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('system roles')) {
      return NextResponse.json(
        { error: 'Forbidden', message: errorMessage },
        { status: 403 }
      );
    }
    if (errorMessage.includes('assigned users')) {
      return NextResponse.json(
        { error: 'Conflict', message: errorMessage },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to delete role') },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
