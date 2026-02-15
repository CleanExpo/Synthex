/**
 * Team Member Role Management API
 *
 * @description API endpoints for managing member roles:
 * - PATCH: Change member's role
 * - GET: Get member's current roles
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 *
 * FAILURE MODE: Returns error responses on failure
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { ResponseOptimizer } from '@/lib/api/response-optimizer';
import { logger } from '@/lib/logger';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';

// Validation schema for role changes
const ChangeRoleSchema = z.object({
  roleId: z.string().min(1, 'Role ID is required'),
});

// ============================================================================
// TYPES
// ============================================================================

/** Role record */
interface RoleRecord {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  isDefault?: boolean;
  isSystem?: boolean;
  organizationId: string;
}

/** User role record */
interface UserRoleRecord {
  userId: string;
  roleId: string;
  grantedAt?: Date;
  grantedBy?: string;
  expiresAt?: Date;
  role?: RoleRecord;
}

/** Extended prisma client for role operations */
interface PrismaWithRoles {
  userRole?: {
    findMany: (args: Record<string, unknown>) => Promise<UserRoleRecord[]>;
    create: (args: Record<string, unknown>) => Promise<UserRoleRecord>;
    deleteMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
  };
  role?: {
    findMany: (args: Record<string, unknown>) => Promise<RoleRecord[]>;
    findFirst: (args: Record<string, unknown>) => Promise<RoleRecord | null>;
  };
  permissionAudit?: {
    create: (args: Record<string, unknown>) => Promise<void>;
  };
}

// ============================================================================
// GET - Get Member's Current Roles
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_READ
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        403
      );
    }

    // Get requesting user ID
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { memberId } = await params;

    if (!memberId) {
      return NextResponse.json(
        { error: 'Member ID is required' },
        { status: 400 }
      );
    }

    // Get requesting user's organization
    const requestingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    if (!requestingUser?.organizationId) {
      return NextResponse.json(
        { error: 'You must belong to an organization' },
        { status: 403 }
      );
    }

    // Verify member belongs to same organization
    const member = await prisma.user.findFirst({
      where: {
        id: memberId,
        organizationId: requestingUser.organizationId,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Get member's roles in this organization
    const extendedPrisma = prisma as unknown as PrismaWithRoles;
    const userRoles = await extendedPrisma.userRole?.findMany({
      where: { userId: memberId },
      include: {
        role: {
          where: { organizationId: requestingUser.organizationId },
          select: {
            id: true,
            name: true,
            description: true,
            permissions: true,
            isDefault: true,
            isSystem: true,
          },
        },
      },
    }) || [];

    const roles = userRoles
      .filter((ur: UserRoleRecord) => ur.role)
      .map((ur: UserRoleRecord) => ({
        ...ur.role,
        grantedAt: ur.grantedAt,
        grantedBy: ur.grantedBy,
        expiresAt: ur.expiresAt,
      }));

    // Get available roles for the organization
    const availableRoles = await extendedPrisma.role?.findMany({
      where: { organizationId: requestingUser.organizationId },
      select: {
        id: true,
        name: true,
        description: true,
        permissions: true,
        isDefault: true,
        isSystem: true,
      },
      orderBy: { name: 'asc' },
    }) || [];

    return ResponseOptimizer.createResponse(
      {
        success: true,
        member: {
          id: member.id,
          email: member.email,
          name: member.name,
        },
        currentRoles: roles,
        availableRoles,
      },
      { cacheType: 'api', cacheDuration: 60 }
    );
  } catch (error) {
    logger.error('Failed to fetch member roles', { error });
    return ResponseOptimizer.createErrorResponse('Failed to fetch member roles', 500);
  }
}

// ============================================================================
// PATCH - Change Member's Role
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        403
      );
    }

    // Get requesting user ID
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { memberId } = await params;

    if (!memberId) {
      return NextResponse.json(
        { error: 'Member ID is required' },
        { status: 400 }
      );
    }

    // Parse and validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const parseResult = ChangeRoleSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { roleId } = parseResult.data;

    // Get requesting user's organization
    const requestingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    if (!requestingUser?.organizationId) {
      return NextResponse.json(
        { error: 'You must belong to an organization' },
        { status: 403 }
      );
    }

    // Check admin permission
    const isAdmin = await checkUserIsAdmin(userId, requestingUser.organizationId);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only admins can change member roles' },
        { status: 403 }
      );
    }

    // Verify member belongs to same organization
    const member = await prisma.user.findFirst({
      where: {
        id: memberId,
        organizationId: requestingUser.organizationId,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Verify role exists and belongs to same organization
    const extendedPrisma = prisma as unknown as PrismaWithRoles;
    const role = await extendedPrisma.role?.findFirst({
      where: {
        id: roleId,
        organizationId: requestingUser.organizationId,
      },
    });

    if (!role) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      );
    }

    // Get current roles for comparison
    const currentUserRoles = await extendedPrisma.userRole?.findMany({
      where: {
        userId: memberId,
        role: { organizationId: requestingUser.organizationId },
      },
      include: {
        role: { select: { id: true, name: true } },
      },
    }) || [];

    const previousRoleNames = currentUserRoles.map((ur: UserRoleRecord) => ur.role?.name).filter(Boolean);

    // Remove all existing roles in this organization
    if (currentUserRoles.length > 0) {
      await extendedPrisma.userRole?.deleteMany({
        where: {
          userId: memberId,
          roleId: { in: currentUserRoles.map((ur: UserRoleRecord) => ur.roleId) },
        },
      });
    }

    // Assign new role
    await extendedPrisma.userRole?.create({
      data: {
        userId: memberId,
        roleId,
        grantedBy: userId,
      },
    });

    // Log permission audit
    await extendedPrisma.permissionAudit?.create({
      data: {
        action: 'grant',
        targetUserId: memberId,
        targetRoleId: roleId,
        performedBy: userId,
        organizationId: requestingUser.organizationId,
        details: {
          previousRoles: previousRoleNames,
          newRole: role.name,
        },
      },
    });

    await auditLogger.log({
      userId,
      action: 'teams.role_changed',
      resource: 'team_member',
      resourceId: memberId,
      category: 'api',
      severity: 'high',
      outcome: 'success',
      details: {
        memberEmail: member.email,
        previousRoles: previousRoleNames,
        newRole: role.name,
      },
    });

    logger.info('Team member role changed', {
      memberId,
      memberEmail: member.email,
      previousRoles: previousRoleNames,
      newRole: role.name,
      changedBy: userId,
    });

    return ResponseOptimizer.createResponse(
      {
        success: true,
        member: {
          id: member.id,
          email: member.email,
          name: member.name,
        },
        role: {
          id: role.id,
          name: role.name,
          permissions: role.permissions,
        },
        previousRoles: previousRoleNames,
      },
      { cacheType: 'none' }
    );
  } catch (error) {
    logger.error('Failed to change member role', { error });
    return ResponseOptimizer.createErrorResponse('Failed to change member role', 500);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function checkUserIsAdmin(userId: string, organizationId: string): Promise<boolean> {
  try {
    // Get user's roles in this organization
    const extendedPrisma = prisma as unknown as PrismaWithRoles;
    const userRoles = await extendedPrisma.userRole?.findMany({
      where: { userId },
      include: {
        role: {
          where: { organizationId },
          select: {
            name: true,
            permissions: true,
          },
        },
      },
    }) || [];

    // Check if any role has admin permissions
    for (const ur of userRoles) {
      if (ur.role) {
        const roleName = ur.role.name.toLowerCase();
        const permissions = ur.role.permissions || [];

        if (
          roleName === 'admin' ||
          roleName === 'owner' ||
          permissions.includes('admin') ||
          permissions.includes('manage_members') ||
          permissions.includes('manage_roles') ||
          permissions.includes('*')
        ) {
          return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
