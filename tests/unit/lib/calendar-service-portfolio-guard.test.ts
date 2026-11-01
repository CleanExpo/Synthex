/**
 * The general calendar never stores a portfolio brand's draft that names a
 * word the brand never uses (lib/marketing-calendar/prompt-guard.ts), and
 * the refusal is not swallowed by the cache fallback.
 */

const mockOrgFind = jest.fn();
const mockUpsert = jest.fn();
const mockPostUpdate = jest.fn();
const mockCacheSet = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    organization: { findUnique: (...a: unknown[]) => mockOrgFind(...a) },
    post: {
      findFirst: async () => null,
      update: (...a: unknown[]) => mockPostUpdate(...a),
    },
    calendarPost: {
      upsert: (...a: unknown[]) => mockUpsert(...a),
      findMany: async () => [],
    },
  },
}));

jest.mock('@/lib/cache/cache-manager', () => ({
  __esModule: true,
  getCache: () => ({
    get: async () => null,
    set: (...a: unknown[]) => mockCacheSet(...a),
    invalidateByTag: async () => undefined,
  }),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  },
}));

import { CalendarService } from '@/lib/content/calendar-service';
import { ForbiddenPromptError } from '@/lib/marketing-calendar/prompt-guard';

const schedule = (content: string) =>
  new CalendarService('org-ug').schedulePost({
    post: {
      content,
      platforms: ['linkedin'],
      scheduledFor: new Date('2026-11-10T00:00:00Z'),
    },
  });

beforeEach(() => {
  mockOrgFind.mockResolvedValue({
    id: 'org-ug',
    slug: 'unite-group',
    status: 'active',
    parentOrgId: null,
  });
  mockUpsert.mockResolvedValue({});
});

describe('CalendarService portfolio draft guard', () => {
  it('refuses a draft naming a forbidden word, writing nothing', async () => {
    await expect(schedule('Promote CARSI courses this week')).rejects.toThrow(
      ForbiddenPromptError
    );
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockPostUpdate).not.toHaveBeenCalled();
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it('stores a clean draft', async () => {
    await schedule('A week of tips for local cafes');
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('leaves an outside org that shares a brand slug unchecked', async () => {
    mockOrgFind.mockImplementation(
      async ({ where }: { where: { id?: string; slug?: string } }) =>
        where.slug === 'unite-group'
          ? {
              id: 'org-ug',
              slug: 'unite-group',
              status: 'active',
              parentOrgId: null,
            }
          : {
              id: 'org-x',
              slug: 'carsi',
              status: 'active',
              parentOrgId: 'other-root',
            }
    );
    await schedule('IICRC courses for technicians');
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('leaves orgs outside the portfolio unchecked', async () => {
    mockOrgFind.mockResolvedValue({
      id: 'org-cafe',
      slug: 'some-cafe',
      status: 'active',
      parentOrgId: null,
    });
    await schedule('Promote CARSI courses this week');
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });
});
