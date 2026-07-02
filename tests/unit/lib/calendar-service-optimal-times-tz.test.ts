/**
 * CalendarService — timezone-aware optimal posting times
 *
 * Regression guard for optimal-time drift. `getOptimalTimes` / `calculateTimeScore`
 * used to call Date.setHours / Date.getHours, which resolve against the SERVER's
 * local clock. On a UTC production server a "9am" suggestion silently became
 * 9am UTC (= 7pm in Sydney) — wrong for an Australian team.
 *
 * These tests assert the suggested instants read back as the intended
 * wall-clock hour IN THE TEAM'S TIMEZONE — an invariant that holds on any host
 * regardless of the server's own clock. To make the drift concrete they also
 * compare against what the old Date.setHours implementation would have produced
 * for the same wall-clock hour, and require the two to differ whenever the
 * server clock is not the target timezone.
 *
 * Sydney in June is AEST (UTC+10, no DST): 9am Sydney === 23:00 UTC the
 * previous calendar day. Sydney in January is AEDT (UTC+11): 9am Sydney ===
 * 22:00 UTC the previous day — which also proves the conversion is DST-correct.
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

const ORG = 'org_tz';

/** Read the wall-clock hour of a UTC instant as it appears in a timezone. */
function hourInZone(date: Date, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(date)
  );
}

/**
 * Reproduce the OLD (buggy) computation: take the reference day and set the
 * hour against the SERVER's local clock — exactly what Date.setHours did.
 */
function serverLocalDrifted(reference: Date, hour: number): Date {
  const d = new Date(reference);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** True when the host's own clock differs from the target zone for this instant. */
function serverDiffersFrom(timeZone: string, at: Date): boolean {
  return at.getHours() !== hourInZone(at, timeZone);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCacheGet.mockResolvedValue(null);
  // No nearby posts → every candidate slot is "available".
  mockFindMany.mockResolvedValue([]);
});

describe('CalendarService.getOptimalTimes — timezone awareness', () => {
  it('suggests Sydney wall-clock optimal hours (AEST/UTC+10) for a June day', async () => {
    const service = new CalendarService(ORG, 'Australia/Sydney');
    // June → Sydney is AEST (no DST).
    const date = new Date('2026-06-15T05:00:00Z');

    const suggestions = await service.getOptimalTimes('twitter', date, 10);

    expect(suggestions.length).toBeGreaterThan(0);

    // Every suggested instant reads as an OPTIMAL twitter hour IN SYDNEY.
    const twitterOptimal = [9, 12, 15, 18];
    for (const s of suggestions) {
      expect(twitterOptimal).toContain(hourInZone(s.suggestedTime, 'Australia/Sydney'));
    }

    // Concretely: 9am Sydney in June === 23:00 UTC the prior day.
    const nineAmSydney = suggestions.find(
      (s) => hourInZone(s.suggestedTime, 'Australia/Sydney') === 9
    );
    expect(nineAmSydney).toBeDefined();
    expect(nineAmSydney!.suggestedTime.getUTCHours()).toBe(23);

    // Proof the drift bug is gone: the timezone-correct instant differs from
    // the old server-local computation (skipped only if the host clock happens
    // to already be Sydney time, in which case there is no drift to detect).
    if (serverDiffersFrom('Australia/Sydney', date)) {
      const old = serverLocalDrifted(date, 9);
      expect(nineAmSydney!.suggestedTime.getTime()).not.toBe(old.getTime());
    }
  });

  it('is DST-correct: January uses AEDT (UTC+11), so 9am Sydney === 22:00 UTC', async () => {
    const service = new CalendarService(ORG, 'Australia/Sydney');
    // January → Sydney is AEDT (summer DST, UTC+11).
    const date = new Date('2026-01-15T05:00:00Z');

    const suggestions = await service.getOptimalTimes('twitter', date, 10);

    const nineAmSydney = suggestions.find(
      (s) => hourInZone(s.suggestedTime, 'Australia/Sydney') === 9
    );
    expect(nineAmSydney).toBeDefined();
    // UTC+11 → 9am local is 22:00 UTC the previous day (not 23:00 as in winter).
    expect(nineAmSydney!.suggestedTime.getUTCHours()).toBe(22);
  });

  it('falls back to the Australia/Sydney default when no timezone is supplied', async () => {
    const service = new CalendarService(ORG); // no timezone arg
    const date = new Date('2026-06-15T05:00:00Z');

    const suggestions = await service.getOptimalTimes('twitter', date, 10);
    const nineAm = suggestions.find(
      (s) => hourInZone(s.suggestedTime, 'Australia/Sydney') === 9
    );
    expect(nineAm).toBeDefined();
    expect(nineAm!.suggestedTime.getUTCHours()).toBe(23);
  });

  it('honours a different timezone (America/New_York) for the same optimal hours', async () => {
    const service = new CalendarService(ORG, 'America/New_York');
    // June → New York is EDT (UTC-4). 9am NY === 13:00 UTC same day.
    const date = new Date('2026-06-15T18:00:00Z');

    const suggestions = await service.getOptimalTimes('twitter', date, 10);

    for (const s of suggestions) {
      expect([9, 12, 15, 18]).toContain(
        hourInZone(s.suggestedTime, 'America/New_York')
      );
    }
    const nineAmNy = suggestions.find(
      (s) => hourInZone(s.suggestedTime, 'America/New_York') === 9
    );
    expect(nineAmNy).toBeDefined();
    expect(nineAmNy!.suggestedTime.getUTCHours()).toBe(13);
  });

  it('scores a Sydney-9am instant as optimal for twitter regardless of server clock', async () => {
    const service = new CalendarService(ORG, 'Australia/Sydney');
    const date = new Date('2026-06-15T05:00:00Z');

    const suggestions = await service.getOptimalTimes('twitter', date, 10);
    const nineAmSydney = suggestions.find(
      (s) => hourInZone(s.suggestedTime, 'Australia/Sydney') === 9
    );
    expect(nineAmSydney).toBeDefined();
    // calculateTimeScore adds +30 when the hour matches an optimal hour in the
    // team zone; base is 50. A tz-blind score would miss it on a non-Sydney host.
    expect(nineAmSydney!.score).toBeGreaterThanOrEqual(80);
  });
});
