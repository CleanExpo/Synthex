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
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { orgIdScope } from '@/lib/auth/org-id-scope';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';

// ─── Validation ────────────────────────────────────────────────────────────────

const CreatePitchSchema = z.object({
  journalistId: z.string().cuid(),
  subject: z.string().min(1).max(500),
  angle: z.string().min(1).max(2000),
  bodyDraft: z.string().max(10000).optional(),
  personalisation: z.string().max(2000).optional(),
  campaignId: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
});

// ─── GET /api/pr/pitches ───────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const organizationId = await getEffectiveOrganizationId(userId);
    if (!organizationId) {
      return NextResponse.json(
        { error: 'No organisation context' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const pitches = await prisma.pRPitch.findMany({
      where: {
        ...orgIdScope(organizationId, userId),
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─── POST /api/pr/pitches ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const organizationId = await getEffectiveOrganizationId(userId);
    if (!organizationId) {
      return NextResponse.json(
        { error: 'No organisation context' },
        { status: 403 }
      );
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
      where: { id: data.journalistId, ...orgIdScope(organizationId, userId) },
    });
    if (!journalist) {
      return NextResponse.json(
        { error: 'Journalist not found' },
        { status: 404 }
      );
    }

    const pitch = await prisma.pRPitch.create({
      data: {
        userId,
        orgId: organizationId,
        journalistId: data.journalistId,
        subject: data.subject,
        angle: data.angle,
        bodyDraft: data.bodyDraft,
        personalisation: data.personalisation,
        campaignId: data.campaignId,
        tags: data.tags,
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
