import { pickBestBusinessSlots } from '@/lib/dashboard/best-business-schedule';
import type { OptimalTimeSlot } from '@/hooks/use-optimal-times';

/** Sunday of a week that stays in the future for this suite. */
const weekStart = new Date('2027-06-06T00:00:00');

function slot(
  day: string,
  hour: number,
  score: number,
  platform = 'instagram'
): OptimalTimeSlot {
  return { day, hour, score, confidence: 0.8, platform };
}

describe('pickBestBusinessSlots', () => {
  it('spreads the strongest hours across the week', () => {
    const slots = [
      slot('Monday', 9, 92),
      slot('Monday', 10, 91),
      slot('Monday', 11, 90),
      slot('Wednesday', 12, 88),
      slot('Friday', 17, 86),
      slot('Thursday', 8, 70),
    ];

    const picked = pickBestBusinessSlots({
      slots,
      weekStart,
      existing: [],
      count: 3,
    });

    expect(picked).toHaveLength(3);
    expect(picked.map(p => p.day)).toEqual(
      expect.arrayContaining(['Monday', 'Wednesday', 'Friday'])
    );
    expect(picked.filter(p => p.day === 'Monday')).toHaveLength(1);
  });

  it('skips hours that already have a booking', () => {
    const mondayNine = new Date(weekStart);
    mondayNine.setDate(weekStart.getDate() + 1);
    mondayNine.setHours(9, 0, 0, 0);

    const picked = pickBestBusinessSlots({
      slots: [slot('Monday', 9, 99), slot('Tuesday', 11, 80)],
      weekStart,
      existing: [mondayNine],
      count: 2,
    });

    expect(picked.every(p => p.day !== 'Monday' || p.hour !== 9)).toBe(true);
    expect(picked.some(p => p.day === 'Tuesday')).toBe(true);
  });
});
