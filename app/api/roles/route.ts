/**
 * Roles API Route
 *
 * @description CRUD operations for organization roles
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 *
 * @module app/api/roles/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getUserIdFromCookies } from '@/lib/auth/jwt-utils';
import { RoleManager } from '@/lib/auth/rbac/role-manager';
import { PermissionEngine, ALL_PERMISSIONS } from '@/lib/auth/rbac/permission-engine';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';
import { logger } from '@/lib/logger';

// =============================================================================
// Schemas
// =============================================================================

const createRoleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  permissions: z.array(z.string()).min(1, 'At least one permission required'),
  description: z.string().max(500).optional(),
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
 * GET /api/roles - List organization roles
 */
export async function GET() {
  try {
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

    const roles = await RoleManager.getRoles(userResult.user.organizationId!);

    // Add user count to each role
    const rolesWithCounts = await Promise.all(
      roles.map(async (role) => {
        const userCount = await prisma.userRole.count({
          where: {
            roleId: role.id,
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
        });

        return {
          ...role,
          userCount,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: rolesWithCounts,
      availablePermissions: ALL_PERMISSIONS,
    });
  } catch (error: unknown) {
    logger.error('List roles error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to list roles') },
      { status: 500 }
    );
  }
}

/**
 * POST /api/roles - Create a new role
 */
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const validation = createRoleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, permissions, description, isDefault } = validation.data;

    const role = await RoleManager.createRole(
      userResult.user.organizationId!,
      {
        name,
        permissions,
        description,
        isDefault,
      },
      userId
    );

    return NextResponse.json({
      success: true,
      message: 'Role created successfully',
      data: {
        ...role,
        userCount: 0,
      },
    });
  } catch (error: unknown) {
    logger.error('Create role error:', error);

    // Handle known errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to create role') },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
