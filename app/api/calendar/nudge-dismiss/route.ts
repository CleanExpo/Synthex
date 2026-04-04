/**
 * POST /api/calendar/nudge-dismiss
 *
 * Records that the user dismissed a perpetual-reviewer nudge banner
 * at a specific shadow post count threshold (30 | 45 | 60).
 *
 * If all three thresholds have been dismissed, marks org.perpetualReviewer = true
 * and the nudge sequence ends permanently.
 *
 * Body: { threshold: 30 | 45 | 60 }
 *
 * @task SYN-552
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import prisma from '@/lib/prisma';

const DismissSchema = z.object({
  threshold: z.union([z.literal(30), z.literal(45), z.literal(60)]),
});

export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => ({}));
  const parsed = DismissSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { threshold } = parsed.data;
  const { organizationId } = user;

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { nudgeDismissedAt: true, liveModeT: true },
  });

  if (!org) {
    return NextResponse.json(
      { error: 'Organisation not found' },
      { status: 404 }
    );
  }

  // Suppressed if already in live mode
  if (org.liveModeT >= 1) {
    return NextResponse.json({ success: true, suppressed: true });
  }

  const existing =
    (org.nudgeDismissedAt as Record<string, string> | null) ?? {};
  const updated = {
    ...existing,
    [String(threshold)]: new Date().toISOString(),
  };

  // If all three thresholds dismissed → mark perpetual reviewer
  const allDismissed = ['30', '45', '60'].every(t => updated[t]);

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      nudgeDismissedAt: updated,
      ...(allDismissed && { perpetualReviewer: true }),
    },
  });

  return NextResponse.json({
    success: true,
    threshold,
    perpetualReviewer: allDismissed,
  });
}
