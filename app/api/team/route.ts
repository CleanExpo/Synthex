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
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';

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
    console.error('Team API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team members' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/team (Invite member)
// ============================================================================

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
    const { email, role = 'viewer' } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

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
    let invitedUser = await prisma.user.findUnique({
      where: { email },
    });

    if (invitedUser) {
      // Update existing user's organization
      await prisma.user.update({
        where: { id: invitedUser.id },
        data: { organizationId: adminUser.organizationId },
      });
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
    console.error('Team invite error:', error);
    return NextResponse.json(
      { error: 'Failed to invite team member' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
