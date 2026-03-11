/**
 * Backlink Outreach API — Save Outreach Attempt (Phase 95)
 *
 * POST /api/backlinks/outreach — Record an outreach attempt for a prospect
 *
 * Updates prospect status to 'contacted', sets contactedAt and pitchSent=true.
 *
 * @module app/api/backlinks/outreach/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';

// ─── Validation ─────────────────────────────────────────────────────────────

const OutreachSchema = z.object({
  prospectId:    z.string().min(1),
  orgId:         z.string().min(1),
  outreachEmail: z.string().email().optional(),
  pitchResponse: z.string().max(5000).optional(),
  notes:         z.string().max(5000).optional(),
});

// ─── POST /api/backlinks/outreach ────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = OutreachSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { prospectId, orgId, outreachEmail, pitchResponse, notes } = parsed.data;

    // Verify prospect belongs to this user
    const existing = await prisma.backlinkProspect.findFirst({
      where: { id: prospectId, userId, orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    }

    // Update prospect: mark as contacted
    const prospect = await prisma.backlinkProspect.update({
      where: { id: prospectId },
      data: {
        status:        'contacted',
        pitchSent:     true,
        contactedAt:   new Date(),
        outreachEmail: outreachEmail ?? existing.outreachEmail,
        pitchResponse: pitchResponse ?? null,
        notes:         notes ?? existing.notes,
      },
    });

    return NextResponse.json({ prospect });
  } catch (err) {
    console.error('[POST /api/backlinks/outreach]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
