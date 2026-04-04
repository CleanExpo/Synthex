/**
 * PATCH /api/calendar/pause
 *
 * Toggle auto-publish pause for the authenticated user's organisation.
 * When paused, no auto-publish actions fire regardless of calendar schedule.
 *
 * Body: { paused: boolean }
 *
 * @task SYN-551
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

const PauseSchema = z.object({
  paused: z.boolean(),
});

export async function PATCH(request: NextRequest) {
  try {
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

    const body = await request.json();
    const parsed = PauseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { paused } = parsed.data;
    const { organizationId } = user;

    await prisma.organization.update({
      where: { id: organizationId },
      data: { autoPublishPaused: paused },
    });

    logger.info('PATCH /api/calendar/pause', { organizationId, paused });

    return NextResponse.json({ success: true, autoPublishPaused: paused });
  } catch (err) {
    logger.error('PATCH /api/calendar/pause failed', { error: err });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
