/**
 * Team Settings API
 *
 * Handles team settings updates and member management.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/teams/[id]/settings/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// =============================================================================
// Schemas
// =============================================================================

const teamSettingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']).optional(),
  settings: z.object({
    allowMemberInvites: z.boolean().optional(),
    requireApprovalForPosts: z.boolean().optional(),
    defaultPostVisibility: z.enum(['public', 'private', 'team']).optional(),
    notifyOnNewMember: z.boolean().optional(),
    notifyOnPostPublished: z.boolean().optional(),
    admins: z.array(z.string()).optional(),
  }).optional(),
});

// =============================================================================
// Auth Helper - Uses centralized JWT utilities (no fallback secrets)
// =============================================================================

import { verifyToken } from '@/lib/auth/jwt-utils';

async function getUserFromRequest(request: NextRequest): Promise<{ id: string; email: string } | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  try {
    const token = authHeader.replace('Bearer ', '');
    const decoded = verifyToken(token);
    return { id: decoded.userId, email: decoded.email || '' };
  } catch {
    return null;
  }
}

/**
 * Check if user has permission to manage team
 */
async function canManageTeam(userId: string, teamId: string): Promise<boolean> {
  // Check if user is a member of the team
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      organizationId: teamId,
    },
  });

  if (!user) return false;

  // Check if user is an admin in team settings
  const team = await prisma.organization.findUnique({
    where: { id: teamId },
    select: { settings: true },
  });

  const settings = team?.settings as { admins?: string[] } | null;
  return settings?.admins?.includes(userId) || false;
}

// =============================================================================
// GET - Get Team Settings
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: teamId } = params;

    // Check if user is a member of the team
    const membership = await prisma.user.findFirst({
      where: {
        id: user.id,
        organizationId: teamId,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Team not found or access denied' },
        { status: 404 }
      );
    }

    const team = await prisma.organization.findUnique({
      where: { id: teamId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Team not found' },
        { status: 404 }
      );
    }

    const settings = team.settings as { admins?: string[] } | null;

    return NextResponse.json({
      success: true,
      data: {
        id: team.id,
        name: team.name,
        slug: team.slug,
        description: team.description,
        plan: team.plan,
        settings: team.settings,
        memberCount: team._count.users,
        members: team.users.map((u) => ({
          userId: u.id,
          role: settings?.admins?.includes(u.id) ? 'admin' : 'member',
          user: u,
        })),
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      },
    });
  } catch (error: unknown) {
    console.error('GET team settings error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH - Update Team Settings
// =============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: teamId } = params;

    // Check permission
    const canManage = await canManageTeam(user.id, teamId);
    if (!canManage) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have permission to manage this team' },
        { status: 403 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const validation = teamSettingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    // Get current team settings
    const currentTeam = await prisma.organization.findUnique({
      where: { id: teamId },
      select: { settings: true },
    });

    const currentSettings = (currentTeam?.settings || {}) as Record<string, unknown>;
    const newSettings = validation.data.settings
      ? { ...currentSettings, ...validation.data.settings }
      : currentSettings;

    // Convert to Prisma-compatible JSON value
    const settingsJson = JSON.parse(JSON.stringify(newSettings));

    // Update team
    const team = await prisma.organization.update({
      where: { id: teamId },
      data: {
        ...(validation.data.name && { name: validation.data.name }),
        ...(validation.data.description !== undefined && { description: validation.data.description }),
        ...(validation.data.plan && { plan: validation.data.plan }),
        settings: settingsJson,
        updatedAt: new Date(),
      },
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'team_settings_updated',
        resource: 'organization',
        resourceId: teamId,
        details: { changes: validation.data },
        severity: 'low',
        category: 'admin',
        outcome: 'success',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Team settings updated',
      data: team,
    });
  } catch (error: unknown) {
    console.error('PATCH team settings error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete Team
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: teamId } = params;

    // Only admins can delete team
    const canManage = await canManageTeam(user.id, teamId);
    if (!canManage) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only team admins can delete the team' },
        { status: 403 }
      );
    }

    const team = await prisma.organization.findUnique({
      where: { id: teamId },
      select: { name: true },
    });

    if (!team) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Team not found' },
        { status: 404 }
      );
    }

    // Delete team and all related data
    await prisma.$transaction([
      // Delete team invitations
      prisma.teamInvitation.deleteMany({ where: { organizationId: teamId } }),
      // Remove organization from users
      prisma.user.updateMany({
        where: { organizationId: teamId },
        data: { organizationId: null },
      }),
      // Delete the team
      prisma.organization.delete({ where: { id: teamId } }),
    ]);

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'team_deleted',
        resource: 'organization',
        resourceId: teamId,
        details: { teamName: team.name },
        severity: 'high',
        category: 'admin',
        outcome: 'success',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Team deleted successfully',
    });
  } catch (error: unknown) {
    console.error('DELETE team error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
