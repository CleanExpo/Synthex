/**
 * PR Journalist CRM — Pitches List & Create (Phase 92)
 *
 * GET  /api/pr/pitches — List pitches (filter by status)
 * POST /api/pr/pitches — Create a pitch
 *
 * @module app/api/pr/pitches/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';

// ─── Validation ────────────────────────────────────────────────────────────────

const CreatePitchSchema = z.object({
  journalistId:    z.string().cuid(),
  subject:         z.string().min(1).max(500),
  angle:           z.string().min(1).max(2000),
  bodyDraft:       z.string().max(10000).optional(),
  personalisation: z.string().max(2000).optional(),
  campaignId:      z.string().optional(),
  tags:            z.array(z.string()).optional().default([]),
});

// ─── GET /api/pr/pitches ───────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const pitches = await prisma.pRPitch.findMany({
      where: {
        orgId: userId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        journalist: {
          select: {
            id: true,
            name: true,
            outlet: true,
            tier: true,
          },
        },
        _count: { select: { coverage: true } },
      },
    });

    return NextResponse.json({ pitches });
  } catch (error) {
    console.error('[PR pitches GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/pr/pitches ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CreatePitchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verify the journalist belongs to this user
    const journalist = await prisma.journalistContact.findFirst({
      where: { id: data.journalistId, orgId: userId },
    });
    if (!journalist) {
      return NextResponse.json({ error: 'Journalist not found' }, { status: 404 });
    }

    const pitch = await prisma.pRPitch.create({
      data: {
        userId,
        orgId: userId,
        journalistId:    data.journalistId,
        subject:         data.subject,
        angle:           data.angle,
        bodyDraft:       data.bodyDraft,
        personalisation: data.personalisation,
        campaignId:      data.campaignId,
        tags:            data.tags,
      },
      include: {
        journalist: {
          select: { id: true, name: true, outlet: true },
        },
      },
    });

    return NextResponse.json({ pitch }, { status: 201 });
  } catch (error) {
    console.error('[PR pitches POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
