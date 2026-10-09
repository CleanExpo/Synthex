import { firstWeekNavHrefs } from '@/lib/dashboard/first-week-nav';
import {
  FIRST_WEEK_GUIDANCE,
  FIRST_WEEK_SURFACES,
} from '@/lib/dashboard/first-week-guidance';

describe('first-week guidance', () => {
  it('covers the six first-week pages a stranger must be able to follow', () => {
    expect(FIRST_WEEK_SURFACES).toEqual([
      'home',
      'content',
      'calendar',
      'platforms',
      'campaigns',
      'analytics',
    ]);
  });

  it('answers what, why, next, and what good looks like on every surface', () => {
    const allowedHrefs = new Set(firstWeekNavHrefs());

    for (const surface of FIRST_WEEK_SURFACES) {
      const row = FIRST_WEEK_GUIDANCE[surface];
      expect(row.what.trim().length).toBeGreaterThan(10);
      expect(row.why.trim().length).toBeGreaterThan(10);
      expect(row.next.trim().length).toBeGreaterThan(10);
      expect(row.goodLooksLike.trim().length).toBeGreaterThan(8);
      expect(row.empty.trim().length).toBeGreaterThan(20);
      expect(row.nextLabel.trim().length).toBeGreaterThan(3);
      expect(allowedHrefs.has(row.nextHref)).toBe(true);
    }
  });

  it('keeps the analytics empty line honest about published posts', () => {
    expect(FIRST_WEEK_GUIDANCE.analytics.empty).toMatch(
      /after a few published posts/i
    );
  });
});
