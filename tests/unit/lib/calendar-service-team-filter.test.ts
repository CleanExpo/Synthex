/**
 * CalendarService — team-filter (userId) scoping
 *
 * Regression guard for the silently-ignored "Team Filter" dropdown on the
 * content calendar. The calendar UI (app/dashboard/calendar/page.tsx) sends a
 * `userId` query param when a specific member is selected, and useCalendar
 * forwards it to /api/content/calendar — but the route + CalendarService used
 * to drop it, so picking a member changed nothing on screen.
 *
 * These tests lock in that:
 *  - passing a userId restricts the Prisma query to that member's posts
 *  - omitting it returns every member's posts (no userId clause)
 *  - the cache key differentiates per-member from "all" views
 */

const mockFindMany = jest.fn();
const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    calendarPost: { findMany: mockFindMany, findUnique: jest.fn() },
  },
}));

jest.mock('@/lib/cache/cache-manager', () => ({
  __esModule: true,
  getCache: () => ({
    get: mockCacheGet,
    set: mockCacheSet,
    invalidateByTag: jest.fn(),
  }),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { CalendarService } from '@/lib/content/calendar-service';

const ORG = 'org_123';
const start = new Date('2026-06-01T00:00:00.000Z');
const end = new Date('2026-06-07T23:59:59.999Z');

beforeEach(() => {
  jest.clearAllMocks();
  // No cached view → forces a DB read each time.
  mockCacheGet.mockResolvedValue(null);
  mockFindMany.mockResolvedValue([]);
});

// getCalendarView issues several calendarPost.findMany queries (range fetch +
// conflict-window checks). The range fetch — the one driving what the user sees
// — is the call whose `where` carries the scheduledFor range + multi-status set.
function getRangeFetchWhere(): Record<string, unknown> {
  const call = mockFindMany.mock.calls.find(
    ([arg]) =>
      arg?.where?.scheduledFor?.gte instanceof Date &&
      Array.isArray(arg?.where?.status?.in)
  );
  if (!call) {
    throw new Error('range-fetch findMany call not found');
  }
  return call[0].where;
}

describe('CalendarService team filter (userId)', () => {
  it('restricts the query to a single member when userId is provided', async () => {
    const service = new CalendarService(ORG);
    await service.getCalendarView(start, end, 'user_abc');

    const where = getRangeFetchWhere();
    expect(where.organizationId).toBe(ORG);
    expect(where.userId).toBe('user_abc');
  });

  it('does NOT add a userId clause when no member is selected', async () => {
    const service = new CalendarService(ORG);
    await service.getCalendarView(start, end);

    const where = getRangeFetchWhere();
    expect(where.organizationId).toBe(ORG);
    expect(where).not.toHaveProperty('userId');
  });

  it('keys the cache separately for a per-member view vs the all-members view', async () => {
    const service = new CalendarService(ORG);

    await service.getCalendarView(start, end);
    const allKey = mockCacheGet.mock.calls[0][0];

    await service.getCalendarView(start, end, 'user_abc');
    const memberKey = mockCacheGet.mock.calls[1][0];

    expect(allKey).not.toBe(memberKey);
    expect(allKey).toContain('all');
    expect(memberKey).toContain('user_abc');
  });
});
