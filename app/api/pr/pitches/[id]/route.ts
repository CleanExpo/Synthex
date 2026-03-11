/**
 * PR Journalist CRM — Pitch Detail, Update (Phase 92)
 *
 * GET   /api/pr/pitches/[id] — Get pitch detail with journalist
 * PATCH /api/pr/pitches/[id] — Update pitch (status, content, follow-up)
 *
 * @module app/api/pr/pitches/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { PITCH_TRANSITIONS, type PitchStatus } from '@/lib/pr/types';

// ─── Validation ────────────────────────────────────────────────────────────────

const UpdatePitchSchema = z.object({
  subject:         z.string().min(1).max(500).optional(),
  angle:           z.string().min(1).max(2000).optional(),
  bodyDraft:       z.string().max(10000).optional(),
  personalisation: z.string().max(2000).optional(),
  status:          z.enum(['draft', 'sent', 'opened', 'replied', 'covered', 'declined', 'archived']).optional(),
  sentAt:          z.string().datetime().optional(),
  openedAt:        z.string().datetime().optional(),
  repliedAt:       z.string().datetime().optional(),
  followUpAt:      z.string().datetime().optional(),
  tags:            z.array(z.string()).optional(),
  campaignId:      z.string().optional(),
});

// ─── Route params type ─────────────────────────────────────────────────────────

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─── GET /api/pr/pitches/[id] ─────────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { id } = await params;

    const pitch = await prisma.pRPitch.findFirst({
      where: { id, orgId: userId },
      include: {
        journalist: true,
        coverage: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!pitch) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ pitch });
  } catch (error) {
    console.error('[PR pitches/[id] GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH /api/pr/pitches/[id] ───────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.pRPitch.findFirst({
      where: { id, orgId: userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = UpdatePitchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Validate status transition if status is being changed
    if (data.status && data.status !== existing.status) {
      const currentStatus = existing.status as PitchStatus;
      const allowedTransitions = PITCH_TRANSITIONS[currentStatus] ?? [];
      if (!allowedTransitions.includes(data.status as PitchStatus)) {
        return NextResponse.json(
          {
            error: `Invalid status transition: ${currentStatus} → ${data.status}`,
            allowed: allowedTransitions,
          },
          { status: 400 }
        );
      }
    }

    const pitch = await prisma.pRPitch.update({
      where: { id },
      data: {
        ...data,
        sentAt:     data.sentAt     ? new Date(data.sentAt)     : undefined,
        openedAt:   data.openedAt   ? new Date(data.openedAt)   : undefined,
        repliedAt:  data.repliedAt  ? new Date(data.repliedAt)  : undefined,
        followUpAt: data.followUpAt ? new Date(data.followUpAt) : undefined,
      },
    });

    return NextResponse.json({ pitch });
  } catch (error) {
    console.error('[PR pitches/[id] PATCH]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
