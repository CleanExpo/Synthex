/**
 * CalendarService must show posts the cron actually publishes.
 *
 * Content / Quick Post write to `Post` (scheduledAt). Calendar used to read
 * only `calendar_posts`, so Home could say “1 scheduled” while Calendar was empty.
 */

const mockCalendarFindMany = jest.fn();
const mockLiveFindMany = jest.fn();
const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    calendarPost: { findMany: mockCalendarFindMany, findUnique: jest.fn() },
    post: { findMany: mockLiveFindMany },
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

const ORG = 'org_live';
const start = new Date('2026-09-13T00:00:00.000Z');
const end = new Date('2026-09-20T23:59:59.999Z');

beforeEach(() => {
  jest.clearAllMocks();
  mockCacheGet.mockResolvedValue(null);
  mockCalendarFindMany.mockResolvedValue([]);
  mockLiveFindMany.mockResolvedValue([]);
});

describe('CalendarService live Post rows', () => {
  it('includes a scheduled Post from the working publisher table', async () => {
    mockLiveFindMany.mockResolvedValue([
      {
        id: 'post_1',
        content: 'Tuesday specials are up',
        platform: 'instagram',
        status: 'scheduled',
        scheduledAt: new Date('2026-09-15T09:00:00.000Z'),
        publishedAt: null,
        campaignId: 'camp_1',
        createdAt: new Date('2026-09-14T01:00:00.000Z'),
        updatedAt: new Date('2026-09-14T01:00:00.000Z'),
        campaign: { userId: 'user_1', organizationId: ORG },
      },
    ]);

    const view = await new CalendarService(ORG).getCalendarView(start, end);

    expect(view.posts).toHaveLength(1);
    expect(view.posts[0].id).toBe('post_1');
    expect(view.posts[0].platforms).toEqual(['instagram']);
    expect(view.posts[0].status).toBe('scheduled');
    expect(view.posts[0].content).toBe('Tuesday specials are up');
  });

  it('scopes live posts to the organisation campaign and optional member', async () => {
    await new CalendarService(ORG).getCalendarView(start, end, 'user_abc');

    expect(mockLiveFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          campaign: { organizationId: ORG, userId: 'user_abc' },
        }),
      })
    );
  });
});
