/**
 * Awards API — List & Create (Phase 94)
 *
 * GET  /api/awards — List award listings for the current user
 * POST /api/awards — Create a new award listing
 *
 * @module app/api/awards/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';

// ─── Validation ─────────────────────────────────────────────────────────────

const CreateAwardSchema = z.object({
  orgId:          z.string().min(1),
  name:           z.string().min(1).max(300),
  organizer:      z.string().min(1).max(200),
  category:       z.string().min(1).max(200),
  deadline:       z.string().datetime().optional(),
  submissionUrl:  z.string().url().optional(),
  status:         z.enum(['researched', 'in-progress', 'submitted', 'won', 'shortlisted', 'not-selected']).optional().default('researched'),
  description:    z.string().max(5000).optional(),
  nominationDraft: z.string().optional(),
  entryFee:       z.string().max(100).optional(),
  isRecurring:    z.boolean().optional().default(false),
  recurrenceNote: z.string().max(300).optional(),
  priority:       z.enum(['low', 'medium', 'high']).optional().default('medium'),
  notes:          z.string().max(5000).optional(),
});

// ─── GET /api/awards ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status  = searchParams.get('status');
    const orgId   = searchParams.get('orgId');
    const limit   = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);
    const offset  = parseInt(searchParams.get('offset') ?? '0', 10);

    const where: Record<string, unknown> = { userId };
    if (status) where.status = status;
    if (orgId)  where.orgId  = orgId;

    const [awards, total] = await Promise.all([
      prisma.awardListing.findMany({
        where,
        orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.awardListing.count({ where }),
    ]);

    return NextResponse.json({ awards, total, limit, offset });
  } catch (err) {
    console.error('[GET /api/awards]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/awards ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CreateAwardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const award = await prisma.awardListing.create({
      data: {
        userId,
        orgId:          data.orgId,
        name:           data.name,
        organizer:      data.organizer,
        category:       data.category,
        deadline:       data.deadline ? new Date(data.deadline) : null,
        submissionUrl:  data.submissionUrl ?? null,
        status:         data.status,
        description:    data.description ?? null,
        nominationDraft: data.nominationDraft ?? null,
        entryFee:       data.entryFee ?? null,
        isRecurring:    data.isRecurring,
        recurrenceNote: data.recurrenceNote ?? null,
        priority:       data.priority,
        notes:          data.notes ?? null,
      },
    });

    return NextResponse.json({ award }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/awards]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
