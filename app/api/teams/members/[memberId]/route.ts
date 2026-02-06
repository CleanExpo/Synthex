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
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { ResponseOptimizer } from '@/lib/api/response-optimizer';
import { logger } from '@/lib/logger';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';

// Lazy getter to avoid module load crash
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET required');
  return secret;
}

// Helper to extract user ID from request
async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const token =
    request.cookies.get('auth-token')?.value ||
    request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, getJWTSecret()) as {
      sub?: string;
      userId?: string;
      id?: string;
    };
    return decoded.sub || decoded.userId || decoded.id || null;
  } catch {
    return null;
  }
}

// Validation schema for member updates
const UpdateMemberSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatar: z.string().url().optional().nullable(),
  preferences: z.record(z.any()).optional(),
});

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
    const userId = await getUserIdFromRequest(request);
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
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Get member's roles
    const userRoles = await (prisma as any).userRole.findMany({
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
    });

    const roles = userRoles.map((ur: any) => ({
      id: ur.role.id,
      name: ur.role.name,
      permissions: ur.role.permissions,
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
    const userId = await getUserIdFromRequest(request);
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
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Only allow self-update or admin update
    const isAdmin = await checkUserIsAdmin(userId, requestingUser.organizationId);
    if (userId !== memberId && !isAdmin) {
      return NextResponse.json(
        { error: 'You can only update your own profile unless you are an admin' },
        { status: 403 }
      );
    }

    const { name, avatar, preferences } = parseResult.data;

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (preferences !== undefined) {
      updateData.preferences = {
        ...(member.preferences as any || {}),
        ...preferences,
      };
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
    return ResponseOptimizer.createErrorResponse('Failed to update member', 500);
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
    const userId = await getUserIdFromRequest(request);
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
    const isAdmin = await checkUserIsAdmin(userId, requestingUser.organizationId);
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
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Remove member from organization (soft remove - just unlink)
    await prisma.user.update({
      where: { id: memberId },
      data: { organizationId: null },
    });

    // Remove all user roles for this organization
    const orgRoles = await (prisma as any).role.findMany({
      where: { organizationId: requestingUser.organizationId },
      select: { id: true },
    });

    if (orgRoles.length > 0) {
      await (prisma as any).userRole.deleteMany({
        where: {
          userId: memberId,
          roleId: { in: orgRoles.map((r: any) => r.id) },
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
    return ResponseOptimizer.createErrorResponse('Failed to remove member', 500);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function checkUserIsAdmin(userId: string, organizationId: string): Promise<boolean> {
  try {
    // Get user's roles in this organization
    const userRoles = await (prisma as any).userRole.findMany({
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
    });

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

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
