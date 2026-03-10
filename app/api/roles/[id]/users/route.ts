/**
 * Role Users API Route
 *
 * @description Manage users assigned to a role (grant/revoke)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 *
 * @module app/api/roles/[id]/users/route
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

const grantRoleSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  expiresAt: z.string().datetime().optional(),
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
 * GET /api/roles/[id]/users - Get users with this role
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

    // Verify role belongs to organization
    const role = await prisma.role.findUnique({
      where: { id: roleId },
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

    // Get users with this role
    const userRoles = await RoleManager.getUsersWithRole(roleId);

    // Fetch user details
    const userIds = userRoles.map((ur) => ur.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      },
    });

    // Combine user details with role assignment info
    const usersWithRoleInfo = userRoles.map((ur) => {
      const user = users.find((u) => u.id === ur.userId);
      return {
        id: user?.id || ur.userId,
        name: user?.name || 'Unknown',
        email: user?.email || 'unknown@example.com',
        avatar: user?.avatar || null,
        grantedAt: ur.grantedAt.toISOString(),
        expiresAt: ur.expiresAt?.toISOString() || null,
      };
    });

    return NextResponse.json({
      success: true,
      data: usersWithRoleInfo,
    });
  } catch (error: unknown) {
    logger.error('Get role users error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to get role users') },
      { status: 500 }
    );
  }
}

/**
 * POST /api/roles/[id]/users - Grant role to user
 */
export async function POST(
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
    const role = await prisma.role.findUnique({
      where: { id: roleId },
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

    const body = await request.json();
    const validation = grantRoleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { userId: targetUserId, expiresAt } = validation.data;

    // Verify target user exists and is in the same organization
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, organizationId: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Target user not found' },
        { status: 404 }
      );
    }

    if (targetUser.organizationId !== userResult.user.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Target user is not in your organization' },
        { status: 403 }
      );
    }

    await RoleManager.grantRole(
      {
        userId: targetUserId,
        roleId,
        grantedBy: userId,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      },
      userId
    );

    return NextResponse.json({
      success: true,
      message: 'Role granted successfully',
    });
  } catch (error: unknown) {
    logger.error('Grant role error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to grant role') },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/roles/[id]/users?userId=xxx - Revoke role from user
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

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'userId query parameter is required' },
        { status: 400 }
      );
    }

    // Verify role belongs to organization
    const role = await prisma.role.findUnique({
      where: { id: roleId },
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

    await RoleManager.revokeRole(targetUserId, roleId, userId);

    return NextResponse.json({
      success: true,
      message: 'Role revoked successfully',
    });
  } catch (error: unknown) {
    logger.error('Revoke role error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to revoke role') },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
