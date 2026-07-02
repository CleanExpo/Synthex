/**
 * Unit Tests — PATCH /api/calendar/slots/[slotId] media mutations (backlog #13).
 *
 * The route already updated `status` and `selectedCaption` (SYN-522). This slice
 * adds the Reel media controls that make the already-wired IG REELS publish path
 * (publishQueue.ts → instagram.ts REELS branch) reachable:
 *   - mediaType: 'REELS' (+ https mediaUrl) marks a slot as an Instagram Reel
 *   - mediaType: null clears it back to a caption-only slot
 *
 * Covers the auth ladder, the cross-field validation (REELS requires an https
 * mediaUrl), the org-scoped calendar guard, set + clear persistence, and that
 * the pre-existing selectedCaption mutation still works alongside.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// ============================================================================
// MOCKS — declared before the route import that consumes them
// ============================================================================

const mockPrisma = {
  user: { findUnique: jest.fn() },
  contentCalendar: { findFirst: jest.fn(), update: jest.fn() },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { PATCH } from '@/app/api/calendar/slots/[slotId]/route';

// ============================================================================
// HELPERS
// ============================================================================

const SLOT_ID = 'slot-1';
const CALENDAR_ID = 'cal-1';
const ORG_ID = 'org-123';

function makeCalendar() {
  return {
    id: CALENDAR_ID,
    organizationId: ORG_ID,
    slots: {
      weekStart: '2026-06-15',
      weekEnd: '2026-06-21',
      signalsVersion: '1.0',
      digestCount: 3,
      slots: [
        {
          id: SLOT_ID,
          dayOfWeek: 0,
          scheduledAt: '2026-06-15T09:00:00.000Z',
          platform: 'instagram',
          captions: ['a', 'b', 'c'],
          hashtags: ['#x'],
          contentType: 'educational',
        },
        {
          id: 'slot-2',
          dayOfWeek: 1,
          scheduledAt: '2026-06-16T09:00:00.000Z',
          platform: 'instagram',
          captions: ['d'],
          hashtags: [],
          contentType: 'promotional',
        },
      ],
    },
  };
}

function patch(body: Record<string, unknown>, slotId = SLOT_ID) {
  const req = createMockNextRequest({ method: 'PATCH', body });
  return PATCH(req, { params: Promise.resolve({ slotId }) });
}

/** Returns the slots array persisted by the route's contentCalendar.update. */
function persistedSlots() {
  const arg = mockPrisma.contentCalendar.update.mock.calls[0][0];
  return arg.data.slots.slots as Array<Record<string, unknown>>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('user-1');
  mockPrisma.user.findUnique.mockResolvedValue({ organizationId: ORG_ID });
  mockPrisma.contentCalendar.findFirst.mockResolvedValue(makeCalendar());
  mockPrisma.contentCalendar.update.mockImplementation(async ({ data }) => ({
    id: CALENDAR_ID,
    ...data,
  }));
});

// ============================================================================
// TESTS
// ============================================================================

describe('PATCH /api/calendar/slots/[slotId] — Reel media (#13)', () => {
  test('401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await patch({ calendarId: CALENDAR_ID, mediaType: null });
    expect(res.status).toBe(401);
    expect(mockPrisma.contentCalendar.update).not.toHaveBeenCalled();
  });

  test('403 when the user has no organisation', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ organizationId: null });
    const res = await patch({ calendarId: CALENDAR_ID, mediaType: null });
    expect(res.status).toBe(403);
    expect(mockPrisma.contentCalendar.update).not.toHaveBeenCalled();
  });

  test('400 when mediaType is REELS but mediaUrl is missing', async () => {
    const res = await patch({ calendarId: CALENDAR_ID, mediaType: 'REELS' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
    expect(mockPrisma.contentCalendar.findFirst).not.toHaveBeenCalled();
  });

  test('400 when mediaUrl is not an https URL', async () => {
    const res = await patch({
      calendarId: CALENDAR_ID,
      mediaType: 'REELS',
      mediaUrl: 'http://cdn.example.com/reel.mp4',
    });
    expect(res.status).toBe(400);
    expect(mockPrisma.contentCalendar.update).not.toHaveBeenCalled();
  });

  test('404 when the calendar is not in the caller org (no cross-org write)', async () => {
    mockPrisma.contentCalendar.findFirst.mockResolvedValue(null);
    const res = await patch({
      calendarId: CALENDAR_ID,
      mediaType: 'REELS',
      mediaUrl: 'https://cdn.example.com/reel.mp4',
    });
    expect(res.status).toBe(404);
    // org-scope is enforced in the where clause
    expect(mockPrisma.contentCalendar.findFirst).toHaveBeenCalledWith({
      where: { id: CALENDAR_ID, organizationId: ORG_ID },
    });
    expect(mockPrisma.contentCalendar.update).not.toHaveBeenCalled();
  });

  test('404 when the slot id is not in the calendar', async () => {
    const res = await patch(
      {
        calendarId: CALENDAR_ID,
        mediaType: 'REELS',
        mediaUrl: 'https://cdn.example.com/reel.mp4',
      },
      'missing-slot'
    );
    expect(res.status).toBe(404);
    expect(mockPrisma.contentCalendar.update).not.toHaveBeenCalled();
  });

  test('200 sets mediaType + mediaUrl on the target slot only', async () => {
    const res = await patch({
      calendarId: CALENDAR_ID,
      mediaType: 'REELS',
      mediaUrl: 'https://cdn.example.com/reel.mp4',
    });
    expect(res.status).toBe(200);

    const slots = persistedSlots();
    const target = slots.find(s => s.id === SLOT_ID)!;
    const other = slots.find(s => s.id === 'slot-2')!;
    expect(target.mediaType).toBe('REELS');
    expect(target.mediaUrl).toBe('https://cdn.example.com/reel.mp4');
    // the untouched slot keeps no media
    expect(other.mediaType).toBeUndefined();
    expect(other.mediaUrl).toBeUndefined();
  });

  test('200 clears mediaType + mediaUrl when mediaType is null', async () => {
    // seed an existing Reel slot, then clear it
    const cal = makeCalendar();
    (cal.slots.slots[0] as Record<string, unknown>).mediaType = 'REELS';
    (cal.slots.slots[0] as Record<string, unknown>).mediaUrl =
      'https://cdn.example.com/old.mp4';
    mockPrisma.contentCalendar.findFirst.mockResolvedValue(cal);

    const res = await patch({ calendarId: CALENDAR_ID, mediaType: null });
    expect(res.status).toBe(200);

    const target = persistedSlots().find(s => s.id === SLOT_ID)!;
    expect(target).not.toHaveProperty('mediaType');
    expect(target).not.toHaveProperty('mediaUrl');
  });

  test('200 still applies selectedCaption without touching media', async () => {
    const res = await patch({ calendarId: CALENDAR_ID, selectedCaption: 2 });
    expect(res.status).toBe(200);

    const target = persistedSlots().find(s => s.id === SLOT_ID)!;
    expect(target.selectedCaption).toBe(2);
    expect(target.mediaType).toBeUndefined();
  });
});
