/**
 * Content Library API — Collection Endpoint
 *
 * GET  /api/content-library — List saved content for the authenticated user.
 * POST /api/content-library — Save a new piece of content to the library.
 *
 * Auth: getUserIdFromRequestOrCookies (JWT cookie or Authorization header).
 * Ownership: every query scopes by userId — 404 for unauthorised access.
 *
 * @module app/api/content-library/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

export const runtime = 'nodejs';

// =============================================================================
// Zod Schemas
// =============================================================================

const listQuerySchema = z.object({
  platform: z.string().optional(),
  status: z.enum(['active', 'archived', 'deleted']).optional().default('active'),
  contentType: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

const createSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1),
  contentType: z.enum(['post', 'caption', 'story', 'thread', 'template', 'snippet']),
  platform: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  metadata: z.record(z.unknown()).optional(),
});

// =============================================================================
// GET — List content library items
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const rawQuery: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      rawQuery[key] = value;
    });

    const validation = listQuerySchema.safeParse(rawQuery);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { platform, status, contentType, limit, offset } = validation.data;

    const where: Record<string, unknown> = {
      userId,
      status,
    };

    if (platform) {
      where.platform = platform;
    }

    if (contentType) {
      where.contentType = contentType;
    }

    const [items, total] = await Promise.all([
      prisma.contentLibrary.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          title: true,
          content: true,
          contentType: true,
          platform: true,
          category: true,
          tags: true,
          status: true,
          metadata: true,
          usageCount: true,
          lastUsedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.contentLibrary.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('[content-library] GET error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch content library' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST — Save new content to library
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = createSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { title, content, contentType, platform, category, tags, metadata } = validation.data;

    const item = await prisma.contentLibrary.create({
      data: {
        userId,
        title,
        content,
        contentType,
        platform: platform ?? null,
        category: category ?? null,
        tags: tags ?? [],
        status: 'active',
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        title: true,
        content: true,
        contentType: true,
        platform: true,
        category: true,
        tags: true,
        status: true,
        metadata: true,
        usageCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error) {
    console.error('[content-library] POST error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to save content' },
      { status: 500 }
    );
  }
}
