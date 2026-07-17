/**
 * Team Members API Route
 *
 * @description Returns team members for the authenticated user's organization
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import {
  resolveIssuerRole,
  requireIssuerOutranks,
} from '@/lib/auth/rbac/issuer-rank';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  avatar?: string;
  lastActive?: string;
  stats?: {
    posts: number;
    engagement: number;
  };
}

// ============================================================================
// GET /api/team
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Security check - require authentication
    const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_READ);

    if (!security.allowed || !security.context.userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = security.context.userId;

    // Get user with their organization
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        organizationId: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get user's post count
    const postsCount = await prisma.post.count({
      where: { campaign: { userId } },
    });

    // If no organization, return just the current user
    if (!user.organizationId) {
      const currentUser: TeamMember = {
        id: user.id,
        name: user.name || 'You',
        email: user.email,
        role: 'admin',
        avatar: user.avatar || undefined,
        lastActive: new Date().toISOString(),
        stats: {
          posts: postsCount,
          engagement: 0,
        },
      };

      return NextResponse.json([currentUser]);
    }

    // Get all users in the same organization
    const orgMembers = await prisma.user.findMany({
      where: { organizationId: user.organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        lastLogin: true,
      },
    });

    // Build team members list with stats
    const teamMembers: TeamMember[] = await Promise.all(
      orgMembers.map(async (member) => {
        // Get member's post count
        const memberPostCount = await prisma.post.count({
          where: { campaign: { userId: member.id } },
        });

        // Determine role (first user or creator is admin)
        const isAdmin = member.id === userId;

        return {
          id: member.id,
          name: member.name || 'Unknown',
          email: member.email,
          role: isAdmin ? 'admin' : 'editor',
          avatar: member.avatar || undefined,
          lastActive: member.lastLogin?.toISOString(),
          stats: {
            posts: memberPostCount,
            engagement: 0,
          },
        };
      })
    );

    return NextResponse.json(teamMembers);
  } catch (error) {
    logger.error('Team API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team members' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/team (Invite member)
// ============================================================================

const inviteTeamMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'editor', 'viewer']).optional().default('viewer'),
});

export async function POST(request: NextRequest) {
  try {
    // Security check - require admin
    const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.ADMIN_ONLY);

    if (!security.allowed || !security.context.userId) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const adminUserId = security.context.userId;

    const body = await request.json();
    const validation = inviteTeamMemberSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const { email, role } = validation.data;

    // Get user's organization
    const adminUser = await prisma.user.findUnique({
      where: { id: adminUserId },
      select: { organizationId: true },
    });

    if (!adminUser?.organizationId) {
      return NextResponse.json(
        { error: 'No organization found. Create an organization first.' },
        { status: 404 }
      );
    }

    // Check if user exists with that email
    const invitedUser = await prisma.user.findUnique({
      where: { email },
    });

    if (invitedUser) {
      // Cross-tenant guard: never yank an existing user out of a DIFFERENT
      // organisation by silently reassigning their organizationId. Only a user
      // with no org (or already in this org) may be attached here (SYN-1109).
      if (
        invitedUser.organizationId &&
        invitedUser.organizationId !== adminUser.organizationId
      ) {
        return NextResponse.json(
          { error: 'This user already belongs to another organization' },
          { status: 409 }
        );
      }

      // Rank guard: the inviter may never seat a role above their own. The
      // schema enum already excludes 'owner'; this is defence-in-depth and
      // shares the systemic issuer-rank guard (SYN-1108).
      const issuerRole = await resolveIssuerRole(
        adminUserId,
        adminUser.organizationId
      );
      if (!requireIssuerOutranks(issuerRole, role)) {
        return NextResponse.json(
          { error: 'You cannot grant a role above your own' },
          { status: 403 }
        );
      }

      // Attach the user AND write an EXPLICIT accepted membership row in one
      // transaction. Without a TeamMember row, withAuth's no-membership default
      // resolves the added user as OWNER of this org — the SYN-1109 root escalation.
      await prisma.$transaction([
        prisma.user.update({
          where: { id: invitedUser.id },
          data: { organizationId: adminUser.organizationId },
        }),
        prisma.teamMember.upsert({
          where: {
            team_member_user_org: {
              userId: invitedUser.id,
              organizationId: adminUser.organizationId,
            },
          },
          create: {
            userId: invitedUser.id,
            organizationId: adminUser.organizationId,
            role,
            invitedBy: adminUserId,
            acceptedAt: new Date(),
          },
          update: { role, acceptedAt: new Date() },
        }),
      ]);
    } else {
      // Create a team invitation instead
      await prisma.teamInvitation.create({
        data: {
          email,
          role,
          organizationId: adminUser.organizationId,
          userId: adminUserId,
          status: 'sent',
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: invitedUser
        ? 'User added to organization'
        : 'Invitation sent to email',
    });
  } catch (error) {
    logger.error('Team invite error:', error);
    return NextResponse.json(
      { error: 'Failed to invite team member' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
