/**
 * PATCH  /api/content-drafts/[id] — update a draft
 * DELETE /api/content-drafts/[id] — delete a draft
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const updateDraftSchema = z.object({
  platform: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  title: z.string().max(200).optional(),
  hashtags: z.array(z.string()).optional(),
  hookType: z.string().optional(),
  tone: z.string().optional(),
  topic: z.string().optional(),
  targetLength: z.string().optional(),
  status: z.enum(['draft', 'scheduled', 'published']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getDraftForUser(id: string, userId: string) {
  return prisma.contentDraft.findFirst({
    where: { id, userId },
  });
}

// ---------------------------------------------------------------------------
// PATCH — update draft
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Ownership check
    const existing = await getDraftForUser(id, userId);
    if (!existing) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    const body = await request.json();
    const validation = updateDraftSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { metadata, ...rest } = validation.data;
    const draft = await prisma.contentDraft.update({
      where: { id },
      data: {
        ...rest,
        ...(metadata !== undefined && { metadata: metadata as Prisma.InputJsonValue }),
      },
    });

    return NextResponse.json({ draft });
  } catch (error) {
    console.error('[content-drafts] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update draft' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — delete draft
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(_request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Ownership check
    const existing = await getDraftForUser(id, userId);
    if (!existing) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    await prisma.contentDraft.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[content-drafts] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete draft' },
      { status: 500 }
    );
  }
}
