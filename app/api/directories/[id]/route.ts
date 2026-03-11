/**
 * Directories API — Single Directory (Phase 94)
 *
 * PATCH  /api/directories/[id] — Update a directory listing
 * DELETE /api/directories/[id] — Delete a directory listing
 *
 * @module app/api/directories/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';

// ─── Validation ─────────────────────────────────────────────────────────────

const UpdateDirectorySchema = z.object({
  directoryName:   z.string().min(1).max(200).optional(),
  directoryUrl:    z.string().url().optional(),
  listingUrl:      z.string().url().nullable().optional(),
  category:        z.string().max(200).nullable().optional(),
  status:          z.enum(['identified', 'submitted', 'live', 'needs-update', 'rejected']).optional(),
  domainAuthority: z.number().int().min(0).max(100).nullable().optional(),
  isFree:          z.boolean().optional(),
  submittedAt:     z.string().datetime().nullable().optional(),
  lastReviewedAt:  z.string().datetime().nullable().optional(),
  notes:           z.string().max(5000).nullable().optional(),
  isAiIndexed:     z.boolean().optional(),
});

// ─── Helper ──────────────────────────────────────────────────────────────────

async function getDirectoryForUser(id: string, userId: string) {
  return prisma.directoryListing.findFirst({ where: { id, userId } });
}

// ─── PATCH /api/directories/[id] ─────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const existing = await getDirectoryForUser(id, userId);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = UpdateDirectorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const updated = await prisma.directoryListing.update({
      where: { id },
      data: {
        ...data,
        submittedAt: data.submittedAt !== undefined
          ? (data.submittedAt ? new Date(data.submittedAt) : null)
          : undefined,
        lastReviewedAt: data.lastReviewedAt !== undefined
          ? (data.lastReviewedAt ? new Date(data.lastReviewedAt) : null)
          : undefined,
      },
    });

    return NextResponse.json({ directory: updated });
  } catch (err) {
    console.error('[PATCH /api/directories/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/directories/[id] ────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const existing = await getDirectoryForUser(id, userId);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.directoryListing.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/directories/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
