/**
 * POST /api/calendar/live-mode-activate
 *
 * Activates Tier-1 live mode for the authenticated org.
 * Tier 1: autonomous posting for the single best content category
 * in the highest-performing time slot only.
 *
 * Sets:
 *   liveModeT = 1
 *   calendarMode = 'live'
 *   liveModeActivatedAt = now()
 *
 * Can only advance tier (never regress via this route — use /api/calendar/pause
 * or /api/calendar/mode to switch back to shadow).
 *
 * @task SYN-552
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

const ActivateSchema = z.object({
  /** Must be 1 for Tier-1 activation (Tier-2 reserved for future use). */
  tier: z.literal(1),
  /** Client's explicit confirmation of the activation ceremony. */
  confirmed: z.literal(true),
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
  const parsed = ActivateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { organizationId } = user;

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { liveModeT: true, calendarMode: true },
  });

  if (!org) {
    return NextResponse.json(
      { error: 'Organisation not found' },
      { status: 404 }
    );
  }

  // Idempotent — if already at tier 1+, just return current state
  if (org.liveModeT >= 1) {
    return NextResponse.json({
      success: true,
      liveModeT: org.liveModeT,
      calendarMode: org.calendarMode,
      message: 'Already in live mode',
    });
  }

  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      liveModeT: 1,
      calendarMode: 'live',
      liveModeActivatedAt: new Date(),
    },
    select: { liveModeT: true, calendarMode: true, liveModeActivatedAt: true },
  });

  logger.info('POST /api/calendar/live-mode-activate: Tier 1 activated', {
    organizationId,
  });

  return NextResponse.json({
    success: true,
    liveModeT: updated.liveModeT,
    calendarMode: updated.calendarMode,
    liveModeActivatedAt: updated.liveModeActivatedAt,
  });
}
