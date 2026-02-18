/**
 * Single Bio Page API
 *
 * @description CRUD operations for a single bio page.
 * - GET: Get page details with links
 * - PATCH: Update page settings
 * - DELETE: Delete page
 *
 * SECURITY: All endpoints require authentication and ownership verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

// =============================================================================
// Auth Helper
// =============================================================================

async function getUserFromRequest(request: NextRequest): Promise<{ id: string; email: string } | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    try {
      const token = authHeader.replace('Bearer ', '');
      const decoded = verifyToken(token);
      return { id: decoded.userId, email: decoded.email || '' };
    } catch {
      // Fall through to cookie check
    }
  }

  const authToken = request.cookies.get('auth-token')?.value;
  if (authToken) {
    try {
      const decoded = verifyToken(authToken);
      return { id: decoded.userId, email: decoded.email || '' };
    } catch {
      return null;
    }
  }

  return null;
}

// =============================================================================
// GET - Get page details with links
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { pageId } = await params;

    const page = await prisma.linkBioPage.findFirst({
      where: {
        id: pageId,
        userId: user.id,
      },
      include: {
        links: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      page,
    });
  } catch (error) {
    logger.error('Failed to fetch bio page', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to fetch page' }, { status: 500 });
  }
}

// =============================================================================
// PATCH - Update page settings
// =============================================================================

const updatePageSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
  theme: z.enum(['default', 'minimal', 'gradient', 'dark', 'neon', 'forest']).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  backgroundColor: z.string().optional(),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  buttonStyle: z.enum(['rounded', 'pill', 'square']).optional(),
  socialLinks: z.array(z.object({
    platform: z.string(),
    url: z.string().url(),
  })).optional(),
  isPublished: z.boolean().optional(),
  showBranding: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { pageId } = await params;

    // Verify ownership
    const existing = await prisma.linkBioPage.findFirst({
      where: {
        id: pageId,
        userId: user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const body = await request.json();
    const validation = updatePageSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: `Invalid request: ${validation.error.issues.map(i => i.message).join(', ')}` },
        { status: 400 }
      );
    }

    const data = validation.data;

    const page = await prisma.linkBioPage.update({
      where: { id: pageId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
        ...(data.coverUrl !== undefined && { coverUrl: data.coverUrl }),
        ...(data.theme !== undefined && { theme: data.theme }),
        ...(data.primaryColor !== undefined && { primaryColor: data.primaryColor }),
        ...(data.backgroundColor !== undefined && { backgroundColor: data.backgroundColor }),
        ...(data.textColor !== undefined && { textColor: data.textColor }),
        ...(data.buttonStyle !== undefined && { buttonStyle: data.buttonStyle }),
        ...(data.socialLinks !== undefined && { socialLinks: data.socialLinks }),
        ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
        ...(data.showBranding !== undefined && { showBranding: data.showBranding }),
      },
      include: {
        links: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return NextResponse.json({
      success: true,
      page,
    });
  } catch (error) {
    logger.error('Failed to update bio page', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update page' }, { status: 500 });
  }
}

// =============================================================================
// DELETE - Delete page
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { pageId } = await params;

    // Verify ownership
    const existing = await prisma.linkBioPage.findFirst({
      where: {
        id: pageId,
        userId: user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    await prisma.linkBioPage.delete({
      where: { id: pageId },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    logger.error('Failed to delete bio page', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to delete page' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
