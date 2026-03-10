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
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';

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

import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: teamId } = await params;

    // Check if user is a member of the team
    const membership = await prisma.user.findFirst({
      where: {
        id: userId,
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
    logger.error('GET team settings error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to process team settings request') },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH - Update Team Settings
// =============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: teamId } = await params;

    // Check permission
    const canManage = await canManageTeam(userId, teamId);
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

    // Update team and log in a transaction
    const team = await prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: teamId },
        data: {
          ...(validation.data.name && { name: validation.data.name }),
          ...(validation.data.description !== undefined && { description: validation.data.description }),
          ...(validation.data.plan && { plan: validation.data.plan }),
          settings: settingsJson,
          updatedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: userId,
          action: 'team_settings_updated',
          resource: 'organization',
          resourceId: teamId,
          details: { changes: validation.data },
          severity: 'low',
          category: 'admin',
          outcome: 'success',
        },
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      message: 'Team settings updated',
      data: team,
    });
  } catch (error: unknown) {
    logger.error('PATCH team settings error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to process team settings request') },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete Team
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: teamId } = await params;

    // Only admins can delete team
    const canManage = await canManageTeam(userId, teamId);
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

    // Delete team, related data, and log in a single transaction
    await prisma.$transaction(async (tx) => {
      // Delete team invitations
      await tx.teamInvitation.deleteMany({ where: { organizationId: teamId } });
      // Remove organization from users
      await tx.user.updateMany({
        where: { organizationId: teamId },
        data: { organizationId: null },
      });
      // Log audit event before deletion (the resource ID is still valid)
      await tx.auditLog.create({
        data: {
          userId: userId,
          action: 'team_deleted',
          resource: 'organization',
          resourceId: teamId,
          details: { teamName: team.name },
          severity: 'high',
          category: 'admin',
          outcome: 'success',
        },
      });
      // Delete the team
      await tx.organization.delete({ where: { id: teamId } });
    });

    return NextResponse.json({
      success: true,
      message: 'Team deleted successfully',
    });
  } catch (error: unknown) {
    logger.error('DELETE team error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to process team settings request') },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
