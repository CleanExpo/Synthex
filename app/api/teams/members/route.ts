/**
 * Team Members API
 * GET /api/teams/members - List team members in user's organization
 * POST /api/teams/members - Add a new team member
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';

// Validation schemas
const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'editor', 'viewer']).default('viewer'),
  message: z.string().max(500).optional()
});

const querySchema = z.object({
  role: z.enum(['admin', 'editor', 'viewer']).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  offset: z.string().regex(/^\d+$/).optional()
});

/**
 * GET /api/teams/members
 * Returns team members for the user's organization
 */
export async function GET(request: NextRequest) {
  // Security check - requires authentication
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      401,
      security.context
    );
  }

  try {
    // Get user's organization
    const currentUser = await prisma.user.findUnique({
      where: { id: security.context.userId },
      select: { organizationId: true }
    });

    if (!currentUser?.organizationId) {
      return APISecurityChecker.createSecureResponse(
        {
          error: 'No organization found',
          message: 'You must be part of an organization to view team members'
        },
        400,
        security.context
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const queryParams = {
      role: url.searchParams.get('role') as 'admin' | 'editor' | 'viewer' | null || undefined,
      limit: url.searchParams.get('limit') || undefined,
      offset: url.searchParams.get('offset') || undefined
    };

    const query = querySchema.parse(queryParams);
    const limit = query.limit ? parseInt(query.limit) : 50;
    const offset = query.offset ? parseInt(query.offset) : 0;

    // Build where clause
    const whereClause: {
      organizationId: string;
    } = {
      organizationId: currentUser.organizationId
    };

    // Fetch team members
    const [members, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        orderBy: { createdAt: 'asc' },
        take: Math.min(limit, 100),
        skip: offset,
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          createdAt: true,
          lastLogin: true
        }
      }),
      prisma.user.count({ where: whereClause })
    ]);

    // Get user roles from UserRole table
    const memberIds = members.map(m => m.id);
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId: { in: memberIds }
      },
      include: {
        role: {
          select: { name: true }
        }
      }
    });

    // Map roles to members
    const roleMap = new Map<string, string>();
    userRoles.forEach(ur => {
      roleMap.set(ur.userId, ur.role.name);
    });

    // Format response
    const formattedMembers = members.map(member => ({
      id: member.id,
      name: member.name || 'Unknown',
      email: member.email,
      avatar: member.avatar,
      role: roleMap.get(member.id) || 'viewer',
      joinedAt: member.createdAt.toISOString(),
      lastActive: member.lastLogin?.toISOString() || null
    }));

    // Filter by role if specified
    const filteredMembers = query.role
      ? formattedMembers.filter(m => m.role === query.role)
      : formattedMembers;

    return APISecurityChecker.createSecureResponse(
      {
        data: filteredMembers,
        pagination: {
          total: query.role ? filteredMembers.length : total,
          limit,
          offset,
          hasMore: offset + members.length < total
        },
        organizationId: currentUser.organizationId
      },
      200,
      security.context
    );

  } catch (error) {
    console.error('Team members fetch error:', error);

    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid query parameters', details: error.errors },
        400,
        security.context
      );
    }

    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch team members' },
      500,
      security.context
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * POST /api/teams/members
 * Invites a new member to the organization
 */
export async function POST(request: NextRequest) {
  // Security check - requires authentication with write permissions
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      401,
      security.context
    );
  }

  try {
    // Get user's organization and check permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: security.context.userId },
      select: {
        organizationId: true,
        organization: {
          select: { id: true, name: true }
        }
      }
    });

    if (!currentUser?.organizationId) {
      return APISecurityChecker.createSecureResponse(
        {
          error: 'No organization found',
          message: 'You must be part of an organization to invite members'
        },
        400,
        security.context
      );
    }

    // Check if user has admin role (can invite others)
    const userRole = await prisma.userRole.findFirst({
      where: {
        userId: security.context.userId
      },
      include: {
        role: true
      }
    });

    const isAdmin = userRole?.role?.name === 'admin' ||
                    userRole?.role?.permissions?.includes('invite_members');

    if (!isAdmin && security.context.userRole !== 'admin') {
      return APISecurityChecker.createSecureResponse(
        { error: 'Only administrators can invite new members' },
        403,
        security.context
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const data = addMemberSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser?.organizationId === currentUser.organizationId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'User is already a member of this organization' },
        409,
        security.context
      );
    }

    // Check for existing invitation
    const existingInvitation = await prisma.teamInvitation.findFirst({
      where: {
        email: data.email,
        organizationId: currentUser.organizationId,
        status: 'sent'
      }
    });

    if (existingInvitation) {
      return APISecurityChecker.createSecureResponse(
        { error: 'An invitation has already been sent to this email' },
        409,
        security.context
      );
    }

    // Create invitation
    const invitation = await prisma.teamInvitation.create({
      data: {
        email: data.email,
        role: data.role,
        message: data.message || null,
        status: 'sent',
        userId: security.context.userId,
        organizationId: currentUser.organizationId
      }
    });

    // TODO: Send invitation email
    // await sendInvitationEmail(data.email, currentUser.organization?.name, data.role);

    return APISecurityChecker.createSecureResponse(
      {
        success: true,
        message: `Invitation sent to ${data.email}`,
        data: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          sentAt: invitation.sentAt.toISOString()
        }
      },
      201,
      security.context
    );

  } catch (error) {
    console.error('Team member invitation error:', error);

    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Invalid member data', details: error.errors },
        400,
        security.context
      );
    }

    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to invite team member' },
      500,
      security.context
    );
  } finally {
    await prisma.$disconnect();
  }
}

export const runtime = 'nodejs';
