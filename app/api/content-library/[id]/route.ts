/**
 * Content Library API — Item Endpoint
 *
 * GET    /api/content-library/[id] — Retrieve a single library item.
 * PATCH  /api/content-library/[id] — Update title, content, tags, etc.
 * DELETE /api/content-library/[id] — Soft-delete (sets status to 'deleted').
 *
 * Ownership: all queries include userId; missing or foreign items return 404.
 *
 * @module app/api/content-library/[id]/route
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

const patchSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).optional(),
  contentType: z.enum(['post', 'caption', 'story', 'thread', 'template', 'snippet']).optional(),
  platform: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['active', 'archived', 'deleted']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// =============================================================================
// Route context type
// =============================================================================

interface RouteContext {
  params: Promise<{ id: string }>;
}

// =============================================================================
// Helper — resolve item with ownership check
// =============================================================================

async function resolveOwnedItem(id: string, userId: string) {
  const item = await prisma.contentLibrary.findFirst({
    where: { id, userId },
  });
  return item;
}

// =============================================================================
// GET — Retrieve a single library item
// =============================================================================

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const item = await resolveOwnedItem(id, userId);
    if (!item) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Content item not found' },
        { status: 404 }
      );
    }

    // Increment usage count on retrieval
    await prisma.contentLibrary.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    return NextResponse.json({ data: item });
  } catch (error) {
    console.error('[content-library/[id]] GET error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch content item' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH — Update a library item
// =============================================================================

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const existing = await resolveOwnedItem(id, userId);
    if (!existing) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Content item not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = patchSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { metadata, ...restData } = validation.data;
    const updateData = {
      ...restData,
      ...(metadata !== undefined && { metadata: metadata as Prisma.InputJsonValue }),
    };

    const updated = await prisma.contentLibrary.update({
      where: { id },
      data: updateData,
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
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('[content-library/[id]] PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to update content item' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE — Soft-delete (status → 'deleted')
// =============================================================================

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const existing = await resolveOwnedItem(id, userId);
    if (!existing) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Content item not found' },
        { status: 404 }
      );
    }

    await prisma.contentLibrary.update({
      where: { id },
      data: { status: 'deleted' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[content-library/[id]] DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to delete content item' },
      { status: 500 }
    );
  }
}
