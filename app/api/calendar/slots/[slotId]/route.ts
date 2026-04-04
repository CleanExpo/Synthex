/**
 * PATCH /api/calendar/slots/[slotId]
 *
 * Update a single slot within a ContentCalendar's JSON slots array.
 * Supported mutations:
 *   - status: 'approved' | 'rejected'
 *   - selectedCaption: 0 | 1 | 2  (index into slot.captions[])
 *
 * The calendar is owned by the authenticated user's org — enforced by
 * querying ContentCalendar with the organisationId scope.
 *
 * @task SYN-522
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import type { ContentCalendarData, CalendarSlot } from '@/lib/calendar/types';

// ── Validation ─────────────────────────────────────────────────────────────────

const PatchSlotSchema = z.object({
  calendarId: z.string().min(1),
  status: z.enum(['approved', 'rejected']).optional(),
  selectedCaption: z.number().int().min(0).max(2).optional(),
});

// ── Route handler ─────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slotId: string }> }
) {
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
    const { slotId } = await params;

    // ── Validate body ──────────────────────────────────────────────────────
    const body = await request.json();
    const parsed = PatchSlotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { calendarId, status, selectedCaption } = parsed.data;

    // ── Fetch calendar (org-scoped) ────────────────────────────────────────
    const calendar = await prisma.contentCalendar.findFirst({
      where: { id: calendarId, organizationId },
    });

    if (!calendar) {
      return NextResponse.json(
        { error: 'Calendar not found' },
        { status: 404 }
      );
    }

    const calendarData = calendar.slots as unknown as ContentCalendarData;

    // ── Mutate the target slot in the JSONB slots array ────────────────────
    const updatedSlots: (CalendarSlot & {
      status?: string;
      selectedCaption?: number;
    })[] = calendarData.slots.map(slot => {
      if (slot.id !== slotId) return slot;

      return {
        ...slot,
        ...(status !== undefined ? { status } : {}),
        ...(selectedCaption !== undefined ? { selectedCaption } : {}),
      };
    });

    const slotFound = calendarData.slots.some(s => s.id === slotId);
    if (!slotFound) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }

    const updatedCalendarData: ContentCalendarData = {
      ...calendarData,
      slots: updatedSlots as CalendarSlot[],
    };

    // ── Persist ────────────────────────────────────────────────────────────
    const updated = await prisma.contentCalendar.update({
      where: { id: calendarId },
      data: {
        slots: updatedCalendarData as unknown as Parameters<
          typeof prisma.contentCalendar.update
        >[0]['data']['slots'],
        updatedAt: new Date(),
      },
    });

    logger.info('PATCH /api/calendar/slots/[slotId]', {
      organizationId,
      calendarId,
      slotId,
      status,
      selectedCaption,
    });

    return NextResponse.json({ success: true, calendarId: updated.id });
  } catch (err) {
    logger.error('PATCH /api/calendar/slots/[slotId] failed', { error: err });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
