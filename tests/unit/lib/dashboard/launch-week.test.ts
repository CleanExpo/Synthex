import {
  clampLaunchWeekCount,
  emptyLaunchWeekDrafts,
  fillDraftsFromGeneration,
  launchWeekReady,
  LAUNCH_WEEK_DEFAULT,
} from '@/lib/dashboard/launch-week';

describe('launch week', () => {
  it('keeps the week between three and seven posts', () => {
    expect(clampLaunchWeekCount(2)).toBe(3);
    expect(clampLaunchWeekCount(9)).toBe(7);
    expect(clampLaunchWeekCount(Number.NaN)).toBe(LAUNCH_WEEK_DEFAULT);
    expect(emptyLaunchWeekDrafts(5)).toHaveLength(5);
  });

  it('will not save a launch week with fewer than three written cards', () => {
    expect(launchWeekReady('Launch week', ['one', 'two', ''])).toBe(false);
    expect(launchWeekReady('Launch week', ['one', 'two', 'three'])).toBe(true);
    expect(launchWeekReady('  ', ['one', 'two', 'three'])).toBe(false);
  });

  it('fills distinct generated lines and leaves blanks instead of clones', () => {
    expect(
      fillDraftsFromGeneration(5, 'Hello cafe', ['Hello cafe', 'Alt two'])
    ).toEqual(['Hello cafe', 'Alt two', '', '', '']);
  });
});
