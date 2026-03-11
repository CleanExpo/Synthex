/**
 * Awards API — Generate Nomination (Phase 94)
 *
 * POST /api/awards/[id]/generate-nomination
 *   — Generates an AI nomination for the given award and saves it to the record
 *
 * @module app/api/awards/[id]/generate-nomination/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { generateNomination } from '@/lib/awards/nomination-writer';

// ─── Validation ─────────────────────────────────────────────────────────────

const GenerateNominationSchema = z.object({
  brand: z.object({
    canonicalName:  z.string().min(1).max(200),
    description:    z.string().min(1).max(1000),
    credentials:    z.array(z.string()).optional(),
    achievements:   z.array(z.string()).optional(),
    location:       z.string().max(200).optional(),
  }),
  byokApiKey: z.string().optional(),
});

// ─── POST /api/awards/[id]/generate-nomination ────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    // Verify the award belongs to the user
    const award = await prisma.awardListing.findFirst({ where: { id, userId } });
    if (!award) {
      return NextResponse.json({ error: 'Award not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = GenerateNominationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const { brand, byokApiKey } = parsed.data;

    // Generate the nomination
    const draft = await generateNomination(
      {
        award: {
          name:      award.name,
          category:  award.category,
          organizer: award.organizer,
        },
        brand,
      },
      byokApiKey,
    );

    // Save nomination draft back to the award record
    await prisma.awardListing.update({
      where: { id },
      data: { nominationDraft: draft.body },
    });

    return NextResponse.json({ draft });
  } catch (err) {
    console.error('[POST /api/awards/[id]/generate-nomination]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
