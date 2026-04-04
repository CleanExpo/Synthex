/**
 * Bio Page Analytics Tracking API
 *
 * @description Track views and clicks for bio pages.
 * PUBLIC ENDPOINT - No authentication required.
 *
 * POST /api/bio/[pageId]/track
 * Body: { type: 'view' | 'click', linkId?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// =============================================================================
// Validation
// =============================================================================

const trackSchema = z.object({
  type: z.enum(['view', 'click']),
  linkId: z.string().optional(),
});

// =============================================================================
// POST - Track view or click
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { pageId } = await params;

    // Parse and validate body
    const body = await request.json().catch(() => ({}));
    const validation = trackSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      );
    }

    const { type, linkId } = validation.data;

    // Verify page exists (but don't require auth - public endpoint)
    const page = await prisma.linkBioPage.findUnique({
      where: { id: pageId },
      select: { id: true, isPublished: true },
    });

    if (!page) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    // Only track for published pages
    if (!page.isPublished) {
      return NextResponse.json({ success: true });
    }

    if (type === 'view') {
      // Increment page view count
      await prisma.linkBioPage.update({
        where: { id: pageId },
        data: {
          totalViews: { increment: 1 },
        },
      });
    } else if (type === 'click' && linkId) {
      // Increment both page clicks and link clicks
      await prisma.$transaction([
        prisma.linkBioPage.update({
          where: { id: pageId },
          data: {
            totalClicks: { increment: 1 },
          },
        }),
        prisma.linkBioLink.update({
          where: { id: linkId },
          data: {
            clickCount: { increment: 1 },
          },
        }),
      ]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    // Don't expose internal errors for tracking endpoint
    logger.error('Bio tracking failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: true });
  }
}

export const runtime = 'nodejs';
