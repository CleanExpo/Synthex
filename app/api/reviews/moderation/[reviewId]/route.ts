/**
 * PATCH /api/reviews/moderation/[reviewId]
 *
 * Updates moderation fields on a GBPReview for the authenticated organisation.
 *
 * Body (all optional):
 *   status          — 'approved' | 'rejected' | 'hidden' | 'pending'
 *   displayOnWidget — boolean
 *   isFeatured      — boolean
 *   widgetOrder     — number | null
 *
 * @task UNI-1642
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

const PatchSchema = z.object({
  status: z.enum(['approved', 'rejected', 'hidden', 'pending']).optional(),
  displayOnWidget: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  widgetOrder: z.number().int().min(0).nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (!user?.organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 403 }
    );
  }

  const { organizationId } = user;
  const { reviewId } = await params;

  // ── Validate body ─────────────────────────────────────────────────────────
  const body = await request.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { status, displayOnWidget, isFeatured, widgetOrder } = parsed.data;

  // ── Org-scope check ───────────────────────────────────────────────────────
  const existing = await prisma.gBPReview.findFirst({
    where: { id: reviewId, organizationId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // ── Update ────────────────────────────────────────────────────────────────
  try {
    const updated = await prisma.gBPReview.update({
      where: { id: reviewId },
      data: {
        ...(status !== undefined && { status }),
        ...(displayOnWidget !== undefined && { displayOnWidget }),
        ...(isFeatured !== undefined && { isFeatured }),
        ...(widgetOrder !== undefined && { widgetOrder }),
        // Record who moderated and when (only on explicit status changes)
        ...(status !== undefined && {
          moderatedBy: userId,
          moderatedAt: new Date(),
        }),
      },
      select: {
        id: true,
        status: true,
        displayOnWidget: true,
        isFeatured: true,
        widgetOrder: true,
        moderatedBy: true,
        moderatedAt: true,
      },
    });

    logger.info('Review moderation updated', {
      reviewId,
      orgId: organizationId,
      changes: parsed.data,
    });

    return NextResponse.json(updated);
  } catch (err) {
    logger.error('PATCH /api/reviews/moderation/[reviewId] failed', {
      error: err,
      reviewId,
      orgId: organizationId,
    });
    return NextResponse.json(
      { error: 'Failed to update review' },
      { status: 500 }
    );
  }
}
