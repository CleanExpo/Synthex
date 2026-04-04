import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/withAuth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * POST /api/templates/[id]/use
 * Track template usage (increment usageCount, update lastUsedAt)
 */
async function handlePost(
  request: AuthenticatedRequest,
  context?: { params?: Promise<Record<string, string>> }
) {
  try {
    const { id } = (await context?.params) ?? {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing template ID' },
        { status: 400 }
      );
    }
    const userId = request.userId;

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    // Check template exists and user has access
    const template = await prisma.promptTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    // Check access: owner, org member, public, or system
    const hasAccess =
      template.userId === userId ||
      template.isPublic ||
      template.isSystem ||
      (user?.organizationId && template.organizationId === user.organizationId);

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Increment usage count and update lastUsedAt
    const updatedTemplate = await prisma.promptTemplate.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
      select: {
        id: true,
        usageCount: true,
        lastUsedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      usageCount: updatedTemplate.usageCount,
      lastUsedAt: updatedTemplate.lastUsedAt,
    });
  } catch (error) {
    logger.error('Error tracking template usage:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to track template usage' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handlePost);
