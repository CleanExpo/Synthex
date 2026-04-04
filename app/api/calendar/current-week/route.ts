/**
 * GET /api/calendar/current-week
 *
 * Returns the latest ContentCalendar draft for the authenticated user's
 * organisation, plus the org's current calendarMode (shadow | live).
 *
 * Response shape:
 *   { calendar: ContentCalendar | null, calendarMode: 'shadow' | 'live' }
 *
 * @task SYN-522
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
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

    // ── Fetch org calendar mode + latest calendar ──────────────────────────────
    const [org, calendar] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { calendarMode: true },
      }),
      prisma.contentCalendar.findFirst({
        where: { organizationId },
        orderBy: { weekStart: 'desc' },
      }),
    ]);

    return NextResponse.json({
      calendar: calendar ?? null,
      calendarMode: (org?.calendarMode ?? 'shadow') as 'shadow' | 'live',
    });
  } catch (err) {
    logger.error('GET /api/calendar/current-week failed', { error: err });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
