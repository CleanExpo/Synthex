/**
 * PUT /api/calendar/mode
 *
 * Update the calendar autonomy mode for the authenticated user's organisation.
 *
 * Body: { mode: 'shadow' | 'live' }
 *
 * 'shadow' = all AI posts require manual approval before publishing (default, safe)
 * 'live'   = AI posts publish automatically at their scheduled time
 *
 * Switching to 'live' is a deliberate action — the UI shows a confirmation modal.
 * Switching back to 'shadow' is always instant (safety escape hatch).
 *
 * @task SYN-522
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

// ── Validation ─────────────────────────────────────────────────────────────────

const UpdateModeSchema = z.object({
  mode: z.enum(['shadow', 'live']),
});

// ── Route handler ─────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
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

    // ── Validate body ──────────────────────────────────────────────────────
    const body = await request.json();
    const parsed = UpdateModeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { mode } = parsed.data;

    // ── Update organisation calendar mode ──────────────────────────────────
    await prisma.organization.update({
      where: { id: organizationId },
      data: { calendarMode: mode },
    });

    logger.info('PUT /api/calendar/mode', { organizationId, mode });

    return NextResponse.json({ success: true, calendarMode: mode });
  } catch (err) {
    logger.error('PUT /api/calendar/mode failed', { error: err });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
