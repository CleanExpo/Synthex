/**
 * PR Distribution Records (Phase 93)
 *
 * GET /api/pr/press-releases/[id]/distributions
 *
 * Returns all PRDistribution records for a press release.
 * Ownership-gated to the authenticated user's org.
 *
 * @module app/api/pr/press-releases/[id]/distributions/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

// ── Validation ───────────────────────────────────────────────────────────────

const patchDistributionSchema = z.object({
  distributionId: z.string().min(1),
  status: z.enum(['pending', 'submitted', 'published', 'failed']),
  channelUrl: z.string().url().max(2048).optional(),
});

// ─── GET /api/pr/press-releases/[id]/distributions ────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership via the parent PressRelease
    const release = await prisma.pressRelease.findFirst({
      where: { id, orgId: userId },
      select: { id: true },
    });

    if (!release) {
      return NextResponse.json(
        { error: 'Press release not found' },
        { status: 404 }
      );
    }

    const distributions = await prisma.pRDistribution.findMany({
      where: { releaseId: id },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: {
        id: true,
        releaseId: true,
        channel: true,
        channelUrl: true,
        status: true,
        submittedAt: true,
        publishedAt: true,
        notes: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ distributions });
  } catch (error) {
    console.error('[PR distributions GET]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/pr/press-releases/[id]/distributions ─────────────────────────
// Allows marking a manual-submission distribution as published.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership via the parent PressRelease
    const release = await prisma.pressRelease.findFirst({
      where: { id, orgId: userId },
      select: { id: true },
    });

    if (!release) {
      return NextResponse.json(
        { error: 'Press release not found' },
        { status: 404 }
      );
    }

    const rawBody = await request.json();
    const parsed = patchDistributionSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const body = parsed.data;

    const updated = await prisma.pRDistribution.update({
      where: { id: body.distributionId },
      data: {
        status: body.status,
        publishedAt: body.status === 'published' ? new Date() : undefined,
        channelUrl: body.channelUrl,
      },
    });

    return NextResponse.json({ distribution: updated });
  } catch (error) {
    console.error('[PR distributions PATCH]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
