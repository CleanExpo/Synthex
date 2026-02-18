/**
 * Bio Page Links API
 *
 * @description Manage links on a bio page.
 * - GET: Get links for page
 * - POST: Add new link
 * - PATCH: Update link (order, visibility, content)
 * - DELETE: Remove link
 *
 * SECURITY: All endpoints require authentication and page ownership
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
// Ownership Verification
// =============================================================================

async function verifyPageOwnership(pageId: string, userId: string): Promise<boolean> {
  const page = await prisma.linkBioPage.findFirst({
    where: {
      id: pageId,
      userId,
    },
  });
  return !!page;
}

// =============================================================================
// GET - Get links for page
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

    if (!(await verifyPageOwnership(pageId, user.id))) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const links = await prisma.linkBioLink.findMany({
      where: { pageId },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json({
      success: true,
      links,
    });
  } catch (error) {
    logger.error('Failed to fetch bio links', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 });
  }
}

// =============================================================================
// POST - Add new link
// =============================================================================

const createLinkSchema = z.object({
  title: z.string().min(1).max(100),
  url: z.string().url(),
  description: z.string().max(200).optional(),
  iconType: z.enum(['emoji', 'image', 'lucide']).nullable().optional(),
  iconValue: z.string().max(200).nullable().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { pageId } = await params;

    if (!(await verifyPageOwnership(pageId, user.id))) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const body = await request.json();
    const validation = createLinkSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: `Invalid request: ${validation.error.issues.map(i => i.message).join(', ')}` },
        { status: 400 }
      );
    }

    // Get max order for page
    const maxOrderLink = await prisma.linkBioLink.findFirst({
      where: { pageId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const nextOrder = (maxOrderLink?.order ?? -1) + 1;

    const { title, url, description, iconType, iconValue } = validation.data;

    const link = await prisma.linkBioLink.create({
      data: {
        pageId,
        title,
        url,
        description: description || null,
        iconType: iconType || null,
        iconValue: iconValue || null,
        order: nextOrder,
      },
    });

    return NextResponse.json({
      success: true,
      link,
    });
  } catch (error) {
    logger.error('Failed to create bio link', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create link' }, { status: 500 });
  }
}

// =============================================================================
// PATCH - Update link(s)
// =============================================================================

const updateLinkSchema = z.object({
  linkId: z.string().min(1),
  title: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  description: z.string().max(200).nullable().optional(),
  iconType: z.enum(['emoji', 'image', 'lucide']).nullable().optional(),
  iconValue: z.string().max(200).nullable().optional(),
  order: z.number().int().min(0).optional(),
  isVisible: z.boolean().optional(),
  isHighlighted: z.boolean().optional(),
});

const reorderLinksSchema = z.object({
  linkIds: z.array(z.string()),
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

    if (!(await verifyPageOwnership(pageId, user.id))) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const body = await request.json();

    // Check if this is a reorder operation
    if (body.linkIds && Array.isArray(body.linkIds)) {
      const validation = reorderLinksSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: `Invalid request: ${validation.error.issues.map(i => i.message).join(', ')}` },
          { status: 400 }
        );
      }

      const { linkIds } = validation.data;

      // Update order for each link
      await prisma.$transaction(
        linkIds.map((linkId, index) =>
          prisma.linkBioLink.update({
            where: { id: linkId },
            data: { order: index },
          })
        )
      );

      const links = await prisma.linkBioLink.findMany({
        where: { pageId },
        orderBy: { order: 'asc' },
      });

      return NextResponse.json({
        success: true,
        links,
      });
    }

    // Single link update
    const validation = updateLinkSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: `Invalid request: ${validation.error.issues.map(i => i.message).join(', ')}` },
        { status: 400 }
      );
    }

    const { linkId, ...data } = validation.data;

    // Verify link belongs to page
    const existing = await prisma.linkBioLink.findFirst({
      where: {
        id: linkId,
        pageId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    const link = await prisma.linkBioLink.update({
      where: { id: linkId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.url !== undefined && { url: data.url }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.iconType !== undefined && { iconType: data.iconType }),
        ...(data.iconValue !== undefined && { iconValue: data.iconValue }),
        ...(data.order !== undefined && { order: data.order }),
        ...(data.isVisible !== undefined && { isVisible: data.isVisible }),
        ...(data.isHighlighted !== undefined && { isHighlighted: data.isHighlighted }),
      },
    });

    return NextResponse.json({
      success: true,
      link,
    });
  } catch (error) {
    logger.error('Failed to update bio link', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update link' }, { status: 500 });
  }
}

// =============================================================================
// DELETE - Remove link
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

    if (!(await verifyPageOwnership(pageId, user.id))) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get('linkId');

    if (!linkId) {
      return NextResponse.json({ error: 'linkId is required' }, { status: 400 });
    }

    // Verify link belongs to page
    const existing = await prisma.linkBioLink.findFirst({
      where: {
        id: linkId,
        pageId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    await prisma.linkBioLink.delete({
      where: { id: linkId },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    logger.error('Failed to delete bio link', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to delete link' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
