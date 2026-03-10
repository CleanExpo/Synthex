/**
 * GET  /api/content-drafts — list all drafts for authenticated user
 * POST /api/content-drafts — create a new draft
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createDraftSchema = z.object({
  platform: z.string().min(1),
  content: z.string().min(1),
  title: z.string().max(200).optional(),
  hashtags: z.array(z.string()).optional(),
  hookType: z.string().optional(),
  tone: z.string().optional(),
  topic: z.string().optional(),
  targetLength: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// GET — list drafts
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const platform = searchParams.get('platform') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const [drafts, total] = await Promise.all([
      prisma.contentDraft.findMany({
        where: {
          userId,
          ...(status && { status }),
          ...(platform && { platform }),
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          platform: true,
          content: true,
          title: true,
          hashtags: true,
          hookType: true,
          tone: true,
          topic: true,
          targetLength: true,
          status: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.contentDraft.count({
        where: {
          userId,
          ...(status && { status }),
          ...(platform && { platform }),
        },
      }),
    ]);

    return NextResponse.json({ drafts, total, limit, offset });
  } catch (error) {
    logger.error('[content-drafts] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drafts' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — create draft
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = createDraftSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { platform, content, title, hashtags, hookType, tone, topic, targetLength, metadata } =
      validation.data;

    const draft = await prisma.contentDraft.create({
      data: {
        userId,
        platform,
        content,
        title: title || topic || `${platform} post`,
        hashtags: hashtags || [],
        hookType,
        tone,
        topic,
        targetLength,
        metadata: (metadata as Prisma.InputJsonValue) || undefined,
        status: 'draft',
      },
    });

    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    logger.error('[content-drafts] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create draft' },
      { status: 500 }
    );
  }
}
