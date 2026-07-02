/**
 * Team Member Management API
 *
 * @description API endpoints for managing individual team members:
 * - GET: Fetch member details with roles
 * - PATCH: Update member profile/settings
 * - DELETE: Remove member from organization
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
import { Prisma } from '@prisma/client';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { ResponseOptimizer } from '@/lib/api/response-optimizer';
import { logger } from '@/lib/logger';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';

// Validation schema for member updates
const UpdateMemberSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatar: z.string().url().optional().nullable(),
  preferences: z.record(z.string(), z.unknown()).optional(),
});

// ============================================================================
// TYPES
// ============================================================================

/** Role record */
interface RoleRecord {
  id: string;
  name: string;
  permissions: string[];
}

/** User role record */
interface UserRoleRecord {
  userId: string;
  roleId: string;
  grantedAt?: Date;
  role?: RoleRecord;
}

/** Extended prisma client for role operations */
interface PrismaWithRoles {
  userRole?: {
    findMany: (args: Record<string, unknown>) => Promise<UserRoleRecord[]>;
    deleteMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
  };
  role?: {
    findMany: (args: Record<string, unknown>) => Promise<RoleRecord[]>;
  };
}

// ============================================================================
// GET - Fetch Member Details
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

    // Get member details with roles
    const member = await prisma.user.findFirst({
      where: {
        id: memberId,
        organizationId: requestingUser.organizationId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
        lastLogin: true,
        emailVerified: true,
        preferences: true,
      },
    });

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Get member's roles
    const extendedPrisma = prisma as unknown as PrismaWithRoles;
    const userRoles =
      (await extendedPrisma.userRole?.findMany({
        where: { userId: memberId },
        include: {
          role: {
            select: {
              id: true,
              name: true,
              permissions: true,
            },
          },
        },
      })) || [];

    const roles = userRoles.map((ur: UserRoleRecord) => ({
      id: ur.role?.id,
      name: ur.role?.name,
      permissions: ur.role?.permissions,
      grantedAt: ur.grantedAt,
    }));

    await auditLogger.log({
      userId,
      action: 'teams.member_viewed',
      resource: 'team_member',
      resourceId: memberId,
      category: 'api',
      severity: 'low',
      outcome: 'success',
    });

    return ResponseOptimizer.createResponse(
      {
        success: true,
        member: {
          ...member,
          roles,
        },
      },
      { cacheType: 'api', cacheDuration: 60 }
    );
  } catch (error) {
    logger.error('Failed to fetch member', { error });
    return ResponseOptimizer.createErrorResponse('Failed to fetch member', 500);
  }
}

// ============================================================================
// PATCH - Update Member
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
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parseResult = UpdateMemberSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    // Get requesting user's organization and check admin permission
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
    });

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Only allow self-update or admin update
    const isAdmin = await checkUserIsAdmin(
      userId,
      requestingUser.organizationId
    );
    if (userId !== memberId && !isAdmin) {
      return NextResponse.json(
        {
          error: 'You can only update your own profile unless you are an admin',
        },
        { status: 403 }
      );
    }

    const { name, avatar, preferences } = parseResult.data;

    // Build update data - using Prisma.JsonValue for JSON fields
    const updateData: {
      name?: string;
      avatar?: string | null;
      preferences?: Prisma.InputJsonValue;
    } = {};
    if (name !== undefined) updateData.name = name;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (preferences !== undefined) {
      const currentPrefs = (member.preferences || {}) as Record<
        string,
        unknown
      >;
      updateData.preferences = {
        ...currentPrefs,
        ...preferences,
      } as Prisma.InputJsonValue;
    }

    // Update member
    const updatedMember = await prisma.user.update({
      where: { id: memberId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        preferences: true,
        updatedAt: true,
      },
    });

    await auditLogger.log({
      userId,
      action: 'teams.member_updated',
      resource: 'team_member',
      resourceId: memberId,
      category: 'api',
      severity: 'medium',
      outcome: 'success',
      details: { updatedFields: Object.keys(updateData) },
    });

    logger.info('Team member updated', {
      memberId,
      updatedBy: userId,
      fields: Object.keys(updateData),
    });

    return ResponseOptimizer.createResponse(
      {
        success: true,
        member: updatedMember,
      },
      { cacheType: 'none' }
    );
  } catch (error) {
    logger.error('Failed to update member', { error });
    return ResponseOptimizer.createErrorResponse(
      'Failed to update member',
      500
    );
  }
}

// ============================================================================
// DELETE - Remove Member from Organization
// ============================================================================

export async function DELETE(
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

    // Prevent self-removal
    if (userId === memberId) {
      return NextResponse.json(
        { error: 'You cannot remove yourself from the organization' },
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

    // Check admin permission
    const isAdmin = await checkUserIsAdmin(
      userId,
      requestingUser.organizationId
    );
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only admins can remove members' },
        { status: 403 }
      );
    }

    // Verify member belongs to same organization
    const member = await prisma.user.findFirst({
      where: {
        id: memberId,
        organizationId: requestingUser.organizationId,
      },
    });

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Guard: never leave the organisation with zero admins/owners. If the
    // member being removed is an admin/owner and is the last one, reject the
    // operation and make NO write.
    const memberIsAdmin = await checkUserIsAdmin(
      memberId,
      requestingUser.organizationId
    );
    if (memberIsAdmin) {
      const remainingAdmins = await countOtherAdmins(
        memberId,
        requestingUser.organizationId
      );
      if (remainingAdmins === 0) {
        return NextResponse.json(
          { error: 'Cannot remove the last admin of an organisation' },
          { status: 409 }
        );
      }
    }

    // Remove member from organization (soft remove - just unlink)
    await prisma.user.update({
      where: { id: memberId },
      data: { organizationId: null },
    });

    // Remove all user roles for this organization
    const extendedPrisma = prisma as unknown as PrismaWithRoles;
    const orgRoles =
      (await extendedPrisma.role?.findMany({
        where: { organizationId: requestingUser.organizationId },
        select: { id: true },
      })) || [];

    if (orgRoles.length > 0) {
      await extendedPrisma.userRole?.deleteMany({
        where: {
          userId: memberId,
          roleId: { in: orgRoles.map((r: RoleRecord) => r.id) },
        },
      });
    }

    await auditLogger.log({
      userId,
      action: 'teams.member_removed',
      resource: 'team_member',
      resourceId: memberId,
      category: 'api',
      severity: 'high',
      outcome: 'success',
      details: {
        memberEmail: member.email,
        organizationId: requestingUser.organizationId,
      },
    });

    logger.info('Team member removed', {
      memberId,
      memberEmail: member.email,
      removedBy: userId,
      organizationId: requestingUser.organizationId,
    });

    return NextResponse.json({
      success: true,
      message: 'Member removed from organization',
    });
  } catch (error) {
    logger.error('Failed to remove member', { error });
    return ResponseOptimizer.createErrorResponse(
      'Failed to remove member',
      500
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function checkUserIsAdmin(
  userId: string,
  organizationId: string
): Promise<boolean> {
  try {
    // Get user's roles scoped to this organization.
    // NOTE: the org filter must live on the top-level `where` via the `role`
    // relation — a `where` inside a to-one `include` is invalid in Prisma and
    // throws a validation error at runtime (swallowed by the catch below, which
    // would silently deny every real admin). See RoleManager.getUserRoles.
    const extendedPrisma = prisma as unknown as PrismaWithRoles;
    const userRoles =
      (await extendedPrisma.userRole?.findMany({
        where: {
          userId,
          role: { organizationId },
        },
        include: {
          role: {
            select: {
              name: true,
              permissions: true,
            },
          },
        },
      })) || [];

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

/**
 * Count how many OTHER users in the organisation hold an admin/owner role,
 * excluding the given user. Used to prevent orphaning an organisation by
 * removing or demoting its last admin.
 */
async function countOtherAdmins(
  excludeUserId: string,
  organizationId: string
): Promise<number> {
  const extendedPrisma = prisma as unknown as PrismaWithRoles;

  // Resolve the org's admin/owner roles (by name or admin-granting permission).
  const orgRoles =
    (await extendedPrisma.role?.findMany({
      where: { organizationId },
      select: { id: true, name: true, permissions: true },
    })) || [];

  const adminRoleIds = orgRoles
    .filter((r: RoleRecord) => {
      const roleName = (r.name || '').toLowerCase();
      const permissions = r.permissions || [];
      return (
        roleName === 'admin' ||
        roleName === 'owner' ||
        permissions.includes('admin') ||
        permissions.includes('manage_members') ||
        permissions.includes('*')
      );
    })
    .map((r: RoleRecord) => r.id);

  if (adminRoleIds.length === 0) {
    return 0;
  }

  // Distinct other users in this org currently assigned an admin/owner role.
  const adminAssignments =
    (await extendedPrisma.userRole?.findMany({
      where: {
        roleId: { in: adminRoleIds },
        userId: { not: excludeUserId },
      },
      select: { userId: true },
    })) || [];

  const distinctUsers = new Set(
    adminAssignments.map((ur: UserRoleRecord) => ur.userId)
  );
  return distinctUsers.size;
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
