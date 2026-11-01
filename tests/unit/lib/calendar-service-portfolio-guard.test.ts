/**
 * The general calendar never stores a portfolio brand's draft that names a
 * word the brand never uses (lib/marketing-calendar/prompt-guard.ts), and
 * the refusal is not swallowed by the cache fallback.
 */

const mockOrgFind = jest.fn();
const mockUpsert = jest.fn();
const mockPostUpdate = jest.fn();
const mockCacheSet = jest.fn();

// The transaction client: the guard's locked read answers from mockOrgFind
// (by id, then the root by slug), and every step is logged in order.
const mockOrder: string[] = [];
const mockTx = {
  $queryRaw: async (_sql: TemplateStringsArray, id: string, slug: string) => {
    mockOrder.splice(mockOrder.length, 0, 'lock');
    const rows = [
      await mockOrgFind({ where: { id } }),
      await mockOrgFind({ where: { slug } }),
    ].filter(Boolean);
    return rows.filter((r, i) => rows.findIndex(o => o.id === r.id) === i);
  },
  post: {
    findFirst: async () => null,
    update: (...a: unknown[]) => mockPostUpdate(...a),
  },
  calendarPost: {
    upsert: (...a: unknown[]) => {
      mockOrder.splice(mockOrder.length, 0, 'upsert');
      return mockUpsert(...a);
    },
  },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      mockOrder.splice(mockOrder.length, 0, 'begin');
      const result = await fn(mockTx);
      mockOrder.splice(mockOrder.length, 0, 'commit');
      return result;
    },
    calendarPost: { findMany: async () => [] },
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

const schedule = (content: string, orgId = 'org-ug') =>
  new CalendarService(orgId).schedulePost({
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

  it('stores a clean draft, checked on locked rows in the same transaction', async () => {
    mockOrder.length = 0;
    await schedule('A week of tips for local cafes');
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockOrder).toEqual(['begin', 'lock', 'upsert', 'commit']);
  });

  it('never falls back to the cache when the check itself cannot run', async () => {
    mockOrgFind.mockRejectedValue(new Error('database unavailable'));
    await expect(schedule('A week of tips for local cafes')).rejects.toThrow(
      'database unavailable'
    );
    expect(mockCacheSet).not.toHaveBeenCalled();
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
    await schedule('IICRC courses for technicians', 'org-x');
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
