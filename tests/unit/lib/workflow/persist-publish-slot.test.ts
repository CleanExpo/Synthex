/**
 * Unit tests for persist-publish-slot (SYN-1040 slice 2) — writing approved
 * workflow content into a ContentCalendar slot.
 *
 * appendPublishSlot is the pure transform (no DB); persistPublishSlot is the
 * org-scoped read+write wrapper. The org-scope on the read is the cross-org
 * guard, so a missing/foreign calendar must surface as CalendarNotFoundError and
 * MUST NOT issue a write.
 */
const mockPrisma = {
  contentCalendar: { findFirst: jest.fn(), update: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

import {
  appendPublishSlot,
  persistPublishSlot,
  CalendarNotFoundError,
} from '@/lib/workflow/persist-publish-slot';
import type { ContentCalendarData } from '@/lib/calendar/types';

const scheduledAt = new Date('2026-06-17T01:00:00.000Z'); // a Wednesday

function emptyCalendar(): ContentCalendarData {
  return {
    weekStart: '2026-06-15',
    weekEnd: '2026-06-21',
    slots: [],
    signalsVersion: '1.0',
    digestCount: 3,
  };
}

describe('appendPublishSlot (pure)', () => {
  it('maps approved content and appends it as a new slot', () => {
    const { calendar, slot } = appendPublishSlot(emptyCalendar(), {
      id: 'slot-1',
      content: { caption: 'Winter pipe season is here #plumbing #winter' },
      platform: 'instagram',
      scheduledAt,
    });

    expect(calendar.slots).toHaveLength(1);
    expect(calendar.slots[0]).toBe(slot);
    expect(slot).toMatchObject({
      id: 'slot-1',
      platform: 'instagram',
      captions: ['Winter pipe season is here #plumbing #winter'],
      hashtags: ['#plumbing', '#winter'],
      contentType: 'educational',
    });
  });

  it('preserves existing slots and calendar metadata (append, not replace)', () => {
    const base = emptyCalendar();
    const seeded: ContentCalendarData = {
      ...base,
      slots: [
        {
          id: 'existing',
          dayOfWeek: 0,
          scheduledAt: scheduledAt.toISOString(),
          platform: 'facebook',
          captions: ['hi'],
          hashtags: [],
          contentType: 'engagement',
        },
      ],
    };

    const { calendar } = appendPublishSlot(seeded, {
      id: 'slot-2',
      content: 'second post',
      platform: 'linkedin',
      scheduledAt,
    });

    expect(calendar.slots.map((s) => s.id)).toEqual(['existing', 'slot-2']);
    expect(calendar.signalsVersion).toBe('1.0');
    expect(calendar.weekStart).toBe('2026-06-15');
  });

  it('does not mutate the input calendar', () => {
    const input = emptyCalendar();
    appendPublishSlot(input, {
      id: 'slot-x',
      content: 'x',
      platform: 'twitter',
      scheduledAt,
    });
    expect(input.slots).toHaveLength(0);
  });

  it('throws on an unsupported platform (via the slice-1 mapper)', () => {
    expect(() =>
      appendPublishSlot(emptyCalendar(), {
        id: 'slot-bad',
        content: 'x',
        platform: 'myspace',
        scheduledAt,
      }),
    ).toThrow(/unsupported platform/);
  });
});

describe('persistPublishSlot (org-scoped wrapper)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.contentCalendar.update.mockResolvedValue({ id: 'cal-1' });
  });

  it('reads the calendar org-scoped, appends the slot, and persists', async () => {
    mockPrisma.contentCalendar.findFirst.mockResolvedValue({
      id: 'cal-1',
      slots: emptyCalendar(),
    });

    const result = await persistPublishSlot({
      organizationId: 'org-1',
      calendarId: 'cal-1',
      content: { caption: 'Approved post #ship' },
      platform: 'instagram',
      scheduledAt,
    });

    expect(mockPrisma.contentCalendar.findFirst).toHaveBeenCalledWith({
      where: { id: 'cal-1', organizationId: 'org-1' },
    });

    const updateArg = mockPrisma.contentCalendar.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'cal-1' });
    const persistedSlots = (updateArg.data.slots as ContentCalendarData).slots;
    expect(persistedSlots).toHaveLength(1);
    expect(persistedSlots[0].captions).toEqual(['Approved post #ship']);
    expect(result).toEqual({ calendarId: 'cal-1', slotId: persistedSlots[0].id });
  });

  it('throws CalendarNotFoundError and never writes when the calendar is missing/foreign', async () => {
    mockPrisma.contentCalendar.findFirst.mockResolvedValue(null);

    await expect(
      persistPublishSlot({
        organizationId: 'org-1',
        calendarId: 'cal-other',
        content: 'x',
        platform: 'facebook',
        scheduledAt,
      }),
    ).rejects.toBeInstanceOf(CalendarNotFoundError);

    expect(mockPrisma.contentCalendar.update).not.toHaveBeenCalled();
  });

  it('does not persist (the mapper throws first) on an unsupported platform', async () => {
    mockPrisma.contentCalendar.findFirst.mockResolvedValue({
      id: 'cal-1',
      slots: emptyCalendar(),
    });

    await expect(
      persistPublishSlot({
        organizationId: 'org-1',
        calendarId: 'cal-1',
        content: 'x',
        platform: 'myspace',
        scheduledAt,
      }),
    ).rejects.toThrow(/unsupported platform/);

    expect(mockPrisma.contentCalendar.update).not.toHaveBeenCalled();
  });
});
