/**
 * Team Invitation Management API
 *
 * @description API endpoints for managing individual invitations:
 * - GET: Get invitation details
 * - PATCH: Update invitation (resend, update role)
 * - DELETE: Cancel/delete invitation
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
import { sendTeamInviteEmail } from '@/lib/email';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Invitation update data */
interface InvitationUpdateData {
  role?: string;
  message?: string;
  campaignAccess?: string[];
}

/** Extended Prisma client with team models */
interface ExtendedPrismaClient {
  teamInvitation: {
    findFirst: (args: { where: Record<string, unknown>; include?: Record<string, unknown> }) => Promise<InvitationDetailRecord | null>;
    update: (args: { where: { id: string }; data: InvitationUpdateData }) => Promise<InvitationDetailRecord>;
    delete: (args: { where: { id: string } }) => Promise<void>;
  };
  userRole: {
    findMany: (args: { where: { userId: string }; include?: Record<string, unknown> }) => Promise<UserRoleRecord[]>;
  };
}

/** User role record */
interface UserRoleRecord {
  role?: {
    name: string;
    permissions?: string[];
  } | null;
}

/** Invitation detail record */
interface InvitationDetailRecord {
  id: string;
  email: string;
  role: string;
  message?: string | null;
  campaignAccess?: unknown;
  status: string;
  sentAt: Date;
  user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  organization?: {
    id: string;
    name: string;
  } | null;
}

/** Get prisma with extended models */
const extendedPrisma = prisma as unknown as typeof prisma & ExtendedPrismaClient;

// Validation schema for updating invitations
const UpdateInvitationSchema = z.object({
  role: z.string().min(1).optional(),
  message: z.string().max(500).optional(),
  campaignAccess: z.array(z.string()).optional(),
  resend: z.boolean().optional(),
});

// ============================================================================
// GET - Get Invitation Details
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Invitation ID is required' },
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

    // Get invitation
    const invitation = await extendedPrisma.teamInvitation.findFirst({
      where: {
        id,
        organizationId: requestingUser.organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    return ResponseOptimizer.createResponse(
      {
        success: true,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          message: invitation.message,
          campaignAccess: invitation.campaignAccess || [],
          status: invitation.status,
          sentAt: invitation.sentAt,
          invitedBy: invitation.user
            ? {
                id: invitation.user.id,
                name: invitation.user.name,
                email: invitation.user.email,
              }
            : null,
          organization: invitation.organization
            ? {
                id: invitation.organization.id,
                name: invitation.organization.name,
              }
            : null,
        },
      },
      { cacheType: 'api', cacheDuration: 60 }
    );
  } catch (error) {
    logger.error('Failed to fetch invitation', { error });
    return ResponseOptimizer.createErrorResponse('Failed to fetch invitation', 500);
  }
}

// ============================================================================
// PATCH - Update Invitation
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Invitation ID is required' },
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

    const parseResult = UpdateInvitationSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { role, message, campaignAccess, resend } = parseResult.data;

    // Get requesting user's organization
    const requestingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        organizationId: true,
        name: true,
        email: true,
        organization: {
          select: {
            name: true,
          },
        },
      },
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
        { error: 'Only admins can update invitations' },
        { status: 403 }
      );
    }

    // Get invitation
    const invitation = await extendedPrisma.teamInvitation.findFirst({
      where: {
        id,
        organizationId: requestingUser.organizationId,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    // Can only update pending invitations
    if (invitation.status !== 'sent') {
      return NextResponse.json(
        { error: 'Can only update pending invitations' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: InvitationUpdateData = {};
    if (role !== undefined) updateData.role = role;
    if (message !== undefined) updateData.message = message;
    if (campaignAccess !== undefined) updateData.campaignAccess = campaignAccess;

    // Update invitation
    const updatedInvitation = await extendedPrisma.teamInvitation.update({
      where: { id },
      data: updateData,
    });

    // Resend email if requested
    let emailQueued = false;
    if (resend && process.env.EMAIL_PROVIDER && process.env.EMAIL_FROM) {
      try {
        await sendTeamInviteEmail({
          to: updatedInvitation.email,
          role: updatedInvitation.role,
          message: updatedInvitation.message || undefined,
          inviterName: requestingUser.name || requestingUser.email || undefined,
          appUrl: process.env.NEXT_PUBLIC_APP_URL,
        });
        emailQueued = true;
      } catch (e) {
        logger.error('Resend invite email failed:', { error: e });
      }
    }

    await auditLogger.log({
      userId,
      action: resend ? 'teams.invitation_resent' : 'teams.invitation_updated',
      resource: 'team_invitation',
      resourceId: id,
      category: 'api',
      severity: 'medium',
      outcome: 'success',
      details: {
        inviteeEmail: updatedInvitation.email,
        updatedFields: Object.keys(updateData),
        resent: resend || false,
      },
    });

    logger.info('Team invitation updated', {
      invitationId: id,
      inviteeEmail: updatedInvitation.email,
      updatedBy: userId,
      resent: resend || false,
    });

    return ResponseOptimizer.createResponse(
      {
        success: true,
        invitation: {
          id: updatedInvitation.id,
          email: updatedInvitation.email,
          role: updatedInvitation.role,
          message: updatedInvitation.message,
          campaignAccess: updatedInvitation.campaignAccess || [],
          status: updatedInvitation.status,
          sentAt: updatedInvitation.sentAt,
        },
        emailQueued,
      },
      { cacheType: 'none' }
    );
  } catch (error) {
    logger.error('Failed to update invitation', { error });
    return ResponseOptimizer.createErrorResponse('Failed to update invitation', 500);
  }
}

// ============================================================================
// DELETE - Cancel/Delete Invitation
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Invitation ID is required' },
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
        { error: 'Only admins can cancel invitations' },
        { status: 403 }
      );
    }

    // Get invitation
    const invitation = await extendedPrisma.teamInvitation.findFirst({
      where: {
        id,
        organizationId: requestingUser.organizationId,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    // Delete invitation
    await extendedPrisma.teamInvitation.delete({
      where: { id },
    });

    await auditLogger.log({
      userId,
      action: 'teams.invitation_cancelled',
      resource: 'team_invitation',
      resourceId: id,
      category: 'api',
      severity: 'medium',
      outcome: 'success',
      details: {
        inviteeEmail: invitation.email,
      },
    });

    logger.info('Team invitation cancelled', {
      invitationId: id,
      inviteeEmail: invitation.email,
      cancelledBy: userId,
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation cancelled',
    });
  } catch (error) {
    logger.error('Failed to cancel invitation', { error });
    return ResponseOptimizer.createErrorResponse('Failed to cancel invitation', 500);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function checkUserIsAdmin(userId: string, organizationId: string): Promise<boolean> {
  try {
    const userRoles = await extendedPrisma.userRole.findMany({
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
