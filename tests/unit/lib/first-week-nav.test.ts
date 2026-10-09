import {
  FIRST_WEEK_HIDDEN_PATHS,
  firstWeekNavHrefs,
  isFirstWeekHiddenPath,
} from '@/lib/dashboard/first-week-nav';
import {
  ADVANCED_NAV_SECTIONS,
  BASIC_NAV_ITEMS,
} from '@/lib/dashboard/sidebar-nav';

describe('first-week nav', () => {
  it('keeps only the seven daily items', () => {
    expect(BASIC_NAV_ITEMS.map(i => i.label)).toEqual([
      'Home',
      'Content',
      'Calendar',
      'Campaigns',
      'Analytics',
      'Platforms',
      'Settings',
    ]);
  });

  it('does not put competing rooms on the default sidebar', () => {
    const hrefs = firstWeekNavHrefs();
    for (const hidden of FIRST_WEEK_HIDDEN_PATHS) {
      expect(hrefs.some(h => h === hidden || h.startsWith(`${hidden}/`))).toBe(
        false
      );
    }
  });

  it('keeps Autopilot out of the seven daily items', () => {
    expect(firstWeekNavHrefs()).not.toContain('/dashboard/autopilot');
    const autopilot = ADVANCED_NAV_SECTIONS.flatMap(s => s.items).find(
      i => i.href === '/dashboard/autopilot'
    );
    expect(autopilot?.description).toMatch(/you still approve/i);
    expect(autopilot?.description).toMatch(/off means nothing sends/i);
  });

  it('recognises SEO and Schedule as hidden first-week destinations', () => {
    expect(isFirstWeekHiddenPath('/dashboard/seo/audit')).toBe(true);
    expect(isFirstWeekHiddenPath('/dashboard/schedule')).toBe(true);
    expect(isFirstWeekHiddenPath('/dashboard/calendar')).toBe(false);
  });
});
