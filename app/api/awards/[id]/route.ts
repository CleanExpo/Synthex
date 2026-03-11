/**
 * Awards API — Single Award (Phase 94)
 *
 * PATCH  /api/awards/[id] — Update an award listing
 * DELETE /api/awards/[id] — Delete an award listing
 *
 * @module app/api/awards/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';

// ─── Validation ─────────────────────────────────────────────────────────────

const UpdateAwardSchema = z.object({
  name:            z.string().min(1).max(300).optional(),
  organizer:       z.string().min(1).max(200).optional(),
  category:        z.string().min(1).max(200).optional(),
  deadline:        z.string().datetime().nullable().optional(),
  submissionUrl:   z.string().url().nullable().optional(),
  status:          z.enum(['researched', 'in-progress', 'submitted', 'won', 'shortlisted', 'not-selected']).optional(),
  description:     z.string().max(5000).nullable().optional(),
  nominationDraft: z.string().nullable().optional(),
  entryFee:        z.string().max(100).nullable().optional(),
  isRecurring:     z.boolean().optional(),
  recurrenceNote:  z.string().max(300).nullable().optional(),
  priority:        z.enum(['low', 'medium', 'high']).optional(),
  notes:           z.string().max(5000).nullable().optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getAwardForUser(id: string, userId: string) {
  return prisma.awardListing.findFirst({ where: { id, userId } });
}

// ─── PATCH /api/awards/[id] ───────────────────────────────────────────────────

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

    const existing = await getAwardForUser(id, userId);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = UpdateAwardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const updated = await prisma.awardListing.update({
      where: { id },
      data: {
        ...data,
        deadline: data.deadline !== undefined
          ? (data.deadline ? new Date(data.deadline) : null)
          : undefined,
      },
    });

    return NextResponse.json({ award: updated });
  } catch (err) {
    console.error('[PATCH /api/awards/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/awards/[id] ──────────────────────────────────────────────────

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

    const existing = await getAwardForUser(id, userId);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.awardListing.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/awards/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
