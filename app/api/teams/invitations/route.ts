/**
 * Team Invitations API
 *
 * @description API endpoints for managing team invitations:
 * - GET: List pending invitations
 * - POST: Create a new invitation
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

/** Team invitation record from database */
interface InvitationRecord {
  id: string;
  email: string;
  role: string;
  message?: string | null;
  campaignAccess?: unknown; // JsonValue from Prisma
  status: string;
  sentAt: Date;
  user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

/** Invitation query where clause */
interface InvitationWhereClause {
  organizationId: string;
  status?: string;
  email?: string;
}

/** Extended Prisma client with optional team models */
interface ExtendedPrismaClient {
  teamInvitation: {
    findFirst: (args: { where: Record<string, unknown> }) => Promise<InvitationRecord | null>;
    findMany: (args: { where: Record<string, unknown>; select?: Record<string, unknown>; orderBy?: Record<string, string>; skip?: number; take?: number }) => Promise<InvitationRecord[]>;
    create: (args: { data: Record<string, unknown> }) => Promise<InvitationRecord>;
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
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

/** Get prisma with extended models */
const extendedPrisma = prisma as unknown as typeof prisma & ExtendedPrismaClient;

// Validation schema for creating invitations
const CreateInvitationSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.string().min(1).default('viewer'),
  message: z.string().max(500).optional(),
  campaignAccess: z.array(z.string()).optional(),
});

// ============================================================================
// GET - List Invitations
// ============================================================================

export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'sent', 'accepted', 'declined', 'expired'
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause: InvitationWhereClause = {
      organizationId: requestingUser.organizationId,
    };

    if (status) {
      whereClause.status = status;
    }

    // Get total count
    const total = await extendedPrisma.teamInvitation.count({ where: whereClause });

    // List invitations
    const invitations = await extendedPrisma.teamInvitation.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        role: true,
        message: true,
        campaignAccess: true,
        status: true,
        sentAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { sentAt: 'desc' },
      skip: offset,
      take: limit,
    });

    // Transform invitations
    const transformedInvitations = invitations.map((inv: InvitationRecord) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      message: inv.message,
      campaignAccess: Array.isArray(inv.campaignAccess) ? inv.campaignAccess : [],
      status: inv.status,
      sentAt: inv.sentAt,
      invitedBy: inv.user
        ? {
            id: inv.user.id,
            name: inv.user.name,
            email: inv.user.email,
          }
        : null,
    }));

    await auditLogger.log({
      userId,
      action: 'teams.invitations_viewed',
      resource: 'team_invitation',
      resourceId: requestingUser.organizationId,
      category: 'api',
      severity: 'low',
      outcome: 'success',
      details: { count: invitations.length },
    });

    return ResponseOptimizer.createResponse(
      {
        success: true,
        data: transformedInvitations,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      { cacheType: 'api', cacheDuration: 60 }
    );
  } catch (error) {
    logger.error('Failed to list invitations', { error });
    return ResponseOptimizer.createErrorResponse('Failed to list invitations', 500);
  }
}

// ============================================================================
// POST - Create Invitation
// ============================================================================

export async function POST(request: NextRequest) {
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

    const parseResult = CreateInvitationSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { email, role, message, campaignAccess } = parseResult.data;

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
            maxUsers: true,
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
        { error: 'Only admins can send invitations' },
        { status: 403 }
      );
    }

    // Check if user already exists in organization
    const existingMember = await prisma.user.findFirst({
      where: {
        email,
        organizationId: requestingUser.organizationId,
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'This email is already a member of your organization' },
        { status: 409 }
      );
    }

    // Check if there's already a pending invitation
    const existingInvitation = await extendedPrisma.teamInvitation.findFirst({
      where: {
        email,
        organizationId: requestingUser.organizationId,
        status: 'sent',
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: 'An invitation has already been sent to this email' },
        { status: 409 }
      );
    }

    // Check organization member limit
    const currentMemberCount = await prisma.user.count({
      where: { organizationId: requestingUser.organizationId },
    });

    const pendingInvitationCount = await extendedPrisma.teamInvitation.count({
      where: {
        organizationId: requestingUser.organizationId,
        status: 'sent',
      },
    });

    const maxUsers = requestingUser.organization?.maxUsers || 5;
    if (currentMemberCount + pendingInvitationCount >= maxUsers) {
      return NextResponse.json(
        { error: `Organization has reached member limit (${maxUsers})` },
        { status: 403 }
      );
    }

    // Create invitation
    const invitation = await extendedPrisma.teamInvitation.create({
      data: {
        email,
        role,
        message: message || null,
        campaignAccess: campaignAccess || [],
        status: 'sent',
        userId,
        organizationId: requestingUser.organizationId,
      },
    });

    // Send invitation email
    let emailQueued = false;
    if (process.env.EMAIL_PROVIDER && process.env.EMAIL_FROM) {
      try {
        await sendTeamInviteEmail({
          to: email,
          role,
          message: message || undefined,
          inviterName: requestingUser.name || requestingUser.email || undefined,
          appUrl: process.env.NEXT_PUBLIC_APP_URL,
        });
        emailQueued = true;
      } catch (e) {
        logger.error('Invite email send failed:', { error: e });
      }
    }

    await auditLogger.log({
      userId,
      action: 'teams.invitation_sent',
      resource: 'team_invitation',
      resourceId: invitation.id,
      category: 'api',
      severity: 'medium',
      outcome: 'success',
      details: {
        inviteeEmail: email,
        role,
        emailQueued,
      },
    });

    logger.info('Team invitation created', {
      invitationId: invitation.id,
      inviteeEmail: email,
      role,
      invitedBy: userId,
      organizationId: requestingUser.organizationId,
    });

    return ResponseOptimizer.createResponse(
      {
        success: true,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          sentAt: invitation.sentAt,
        },
        emailQueued,
      },
      { status: 201, cacheType: 'none' }
    );
  } catch (error) {
    logger.error('Failed to create invitation', { error });
    return ResponseOptimizer.createErrorResponse('Failed to create invitation', 500);
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
          permissions.includes('invite_members') ||
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
