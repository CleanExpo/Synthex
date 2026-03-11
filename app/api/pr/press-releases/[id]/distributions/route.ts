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
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';

// ─── GET /api/pr/press-releases/[id]/distributions ────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getUserIdFromRequest(request);
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
      return NextResponse.json({ error: 'Press release not found' }, { status: 404 });
    }

    const distributions = await prisma.pRDistribution.findMany({
      where: { releaseId: id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ distributions });
  } catch (error) {
    console.error('[PR distributions GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH /api/pr/press-releases/[id]/distributions ─────────────────────────
// Allows marking a manual-submission distribution as published.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getUserIdFromRequest(request);
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
      return NextResponse.json({ error: 'Press release not found' }, { status: 404 });
    }

    const body = (await request.json()) as {
      distributionId: string;
      status: string;
      channelUrl?: string;
    };

    if (!body.distributionId) {
      return NextResponse.json({ error: 'distributionId required' }, { status: 400 });
    }

    const ALLOWED_STATUSES = ['pending', 'submitted', 'published', 'failed'];
    if (!ALLOWED_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
