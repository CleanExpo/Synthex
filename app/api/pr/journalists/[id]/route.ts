/**
 * PR Journalist CRM — Journalist Detail, Update, Delete (Phase 92)
 *
 * GET   /api/pr/journalists/[id] — Get journalist detail with recent pitches
 * PATCH /api/pr/journalists/[id] — Update journalist fields
 * DELETE /api/pr/journalists/[id] — Soft delete (sets doNotContact = true)
 *
 * @module app/api/pr/journalists/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';

// ─── Validation ────────────────────────────────────────────────────────────────

const UpdateJournalistSchema = z.object({
  name:            z.string().min(1).max(200).optional(),
  outlet:          z.string().min(1).max(200).optional(),
  outletDomain:    z.string().min(1).max(200).optional(),
  email:           z.string().email().optional(),
  emailVerified:   z.boolean().optional(),
  emailScore:      z.number().int().min(0).max(100).optional(),
  title:           z.string().max(200).optional(),
  location:        z.string().max(200).optional(),
  beats:           z.array(z.string()).optional(),
  twitterHandle:   z.string().max(100).optional(),
  linkedinUrl:     z.string().url().optional(),
  notes:           z.string().max(5000).optional(),
  tier:            z.enum(['cold', 'warm', 'hot', 'advocate']).optional(),
  lastContactedAt: z.string().datetime().optional(),
  doNotContact:    z.boolean().optional(),
});

// ─── Route params type ─────────────────────────────────────────────────────────

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─── GET /api/pr/journalists/[id] ─────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { id } = await params;

    const contact = await prisma.journalistContact.findFirst({
      where: { id, orgId: userId },
      include: {
        pitches: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ contact });
  } catch (error) {
    console.error('[PR journalists/[id] GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH /api/pr/journalists/[id] ───────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.journalistContact.findFirst({
      where: { id, orgId: userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = UpdateJournalistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const contact = await prisma.journalistContact.update({
      where: { id },
      data: {
        ...data,
        lastContactedAt: data.lastContactedAt ? new Date(data.lastContactedAt) : undefined,
      },
    });

    return NextResponse.json({ contact });
  } catch (error) {
    console.error('[PR journalists/[id] PATCH]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/pr/journalists/[id] ──────────────────────────────────────────

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.journalistContact.findFirst({
      where: { id, orgId: userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Soft delete — set doNotContact = true (never hard delete per CLAUDE.md)
    await prisma.journalistContact.update({
      where: { id },
      data: { doNotContact: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PR journalists/[id] DELETE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
