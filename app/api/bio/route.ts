/**
 * Link in Bio Pages API
 *
 * @description List and create bio pages.
 * - GET: List user's bio pages
 * - POST: Create new bio page
 *
 * SECURITY: All endpoints require authentication
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
// Slug Generation
// =============================================================================

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function generateRandomSuffix(): string {
  return Math.random().toString(36).substring(2, 6);
}

async function generateUniqueSlug(title: string): Promise<string> {
  const slug = slugify(title);

  // Check if slug exists
  const existing = await prisma.linkBioPage.findUnique({ where: { slug } });

  if (!existing) {
    return slug;
  }

  // Add random suffix
  let attempts = 0;
  while (attempts < 10) {
    const newSlug = `${slug}-${generateRandomSuffix()}`;
    const exists = await prisma.linkBioPage.findUnique({ where: { slug: newSlug } });
    if (!exists) {
      return newSlug;
    }
    attempts++;
  }

  // Fallback: use timestamp
  return `${slug}-${Date.now().toString(36)}`;
}

// =============================================================================
// GET - List user's bio pages
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const pages = await prisma.linkBioPage.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: { links: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Calculate totals
    const totals = pages.reduce(
      (acc, page) => ({
        totalPages: acc.totalPages + 1,
        totalViews: acc.totalViews + page.totalViews,
        totalClicks: acc.totalClicks + page.totalClicks,
      }),
      { totalPages: 0, totalViews: 0, totalClicks: 0 }
    );

    return NextResponse.json({
      success: true,
      pages,
      totals,
    });
  } catch (error) {
    logger.error('Failed to fetch bio pages', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 });
  }
}

// =============================================================================
// POST - Create new bio page
// =============================================================================

const createPageSchema = z.object({
  title: z.string().min(1).max(100),
  bio: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const validation = createPageSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: `Invalid request: ${validation.error.issues.map(i => i.message).join(', ')}` },
        { status: 400 }
      );
    }

    const { title, bio } = validation.data;
    const slug = await generateUniqueSlug(title);

    const page = await prisma.linkBioPage.create({
      data: {
        userId: user.id,
        slug,
        title,
        bio: bio || null,
      },
      include: {
        _count: {
          select: { links: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      page,
    });
  } catch (error) {
    logger.error('Failed to create bio page', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create page' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
