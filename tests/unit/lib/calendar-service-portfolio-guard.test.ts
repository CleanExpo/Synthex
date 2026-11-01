/**
 * The general calendar never stores a portfolio brand's draft that names a
 * word the brand never uses (lib/marketing-calendar/prompt-guard.ts), and
 * the refusal is not swallowed by the cache fallback.
 */

const mockOrgFind = jest.fn();
const mockUpsert = jest.fn();
const mockPostUpdate = jest.fn();
const mockCacheSet = jest.fn();
const mockStored = jest.fn();
const mockFindUnique = jest.fn();

// The transaction client: the guard's locked read answers from mockOrgFind
// (by id, then the root by slug), the stored-row lock from mockStored, and
// every step is logged in order.
const mockOrder: string[] = [];
const mockTx = {
  $queryRaw: async (sql: TemplateStringsArray, id: string, slug: string) => {
    const text = sql.join('?');
    if (text.includes('calendar_posts')) {
      // Only a read locked for update counts as the row lock.
      if (!/FOR UPDATE/.test(text)) throw new Error('stored row not locked');
      mockOrder.splice(mockOrder.length, 0, 'lock-row');
      // The stored row answers only for its own id.
      const row = await mockStored(id);
      return row && row.id === id ? [row] : [];
    }
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
    calendarPost: {
      findMany: async () => [],
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
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
  mockStored.mockResolvedValue(undefined);
});

// A stored Unite Group draft, as the calendar_posts row reads back.
const storedDraft = (metadata: unknown) => ({
  id: 'post-1',
  title: 'Week 1',
  content: 'A week of tips for local cafes',
  platforms: ['linkedin'],
  scheduledFor: new Date('2026-11-10T00:00:00Z'),
  status: 'draft',
  mediaUrls: [],
  tags: [],
  hashtags: [],
  mentions: [],
  metadata,
  campaignId: null,
  recurrenceType: null,
  recurrenceInterval: null,
  recurrenceEndDate: null,
  recurrenceOccurrences: null,
  recurrenceDaysOfWeek: [],
  recurrenceDayOfMonth: null,
  organizationId: 'org-ug',
  userId: 'user-1',
  createdAt: new Date('2026-11-01T00:00:00Z'),
  updatedAt: new Date('2026-11-01T00:00:00Z'),
});

const reschedule = () =>
  new CalendarService('org-ug').reschedulePost({
    postId: 'post-1',
    newTime: new Date('2026-11-12T00:00:00Z'),
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
    expect(mockOrder).toEqual([
      'begin',
      'lock',
      'lock-row',
      'upsert',
      'commit',
    ]);
  });

  it('refuses to reschedule a stored draft whose delivered caption is forbidden', async () => {
    const metadata = { videoDelivery: { captionDraft: 'CARSI courses' } };
    mockFindUnique.mockResolvedValue(storedDraft(metadata));
    mockStored.mockResolvedValue({ id: 'post-1', metadata });
    await expect(reschedule()).rejects.toThrow(ForbiddenPromptError);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it('reschedules a stored draft whose delivered caption is clean', async () => {
    const metadata = { videoDelivery: { captionDraft: 'Tips for cafes' } };
    mockFindUnique.mockResolvedValue(storedDraft(metadata));
    mockStored.mockResolvedValue({ id: 'post-1', metadata });
    await reschedule();
    expect(mockUpsert).toHaveBeenCalledTimes(1);
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
