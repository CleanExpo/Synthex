/**
 * Sample season windows (SYN-1218)
 *
 * When no industry-specific seasonal signals exist yet, the onboarding Season
 * Brief shows these instead of asking the user to come back later. They are
 * built only from fixed Australian calendar dates, carry no confidence score,
 * and the page labels them as a sample — never as the user's own signals.
 */

export interface SampleSeasonWindow {
  id: string;
  opportunityLabel: string;
  windowStart: string;
  windowEnd: string;
  signalType: 'holiday';
}

/** Calendar-day offset (DST-safe, unlike millisecond arithmetic). */
function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** nth (1-based) occurrence of a weekday (0 = Sunday) in a month. */
function nthWeekday(
  year: number,
  month: number,
  weekday: number,
  n: number
): Date {
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + (n - 1) * 7);
}

function windowsForYear(year: number): SampleSeasonWindow[] {
  const mothersDay = nthWeekday(year, 4, 0, 2); // 2nd Sunday in May
  const fathersDay = nthWeekday(year, 8, 0, 1); // 1st Sunday in September (AU)
  const blackFriday = addDays(nthWeekday(year, 10, 4, 4), 1); // day after 4th Thursday in November

  const raw: Array<[string, string, Date, Date]> = [
    [
      'australia-day',
      'Australia Day',
      new Date(year, 0, 19),
      new Date(year, 0, 26),
    ],
    ['mothers-day', "Mother's Day", addDays(mothersDay, -14), mothersDay],
    [
      'eofy',
      'End of financial year',
      new Date(year, 5, 1),
      new Date(year, 5, 30),
    ],
    ['fathers-day', "Father's Day", addDays(fathersDay, -14), fathersDay],
    [
      'black-friday',
      'Black Friday & Cyber Monday',
      blackFriday,
      addDays(blackFriday, 3),
    ],
    ['christmas', 'Christmas', new Date(year, 11, 1), new Date(year, 11, 24)],
  ];

  return raw.map(([key, label, start, end]) => ({
    id: `sample-${key}-${year}`,
    opportunityLabel: label,
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
    signalType: 'holiday' as const,
  }));
}

/** The next `limit` sample windows that have not yet ended, soonest first. */
export function getSampleSeasonWindows(
  now: Date = new Date(),
  limit = 4
): SampleSeasonWindow[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return [
    ...windowsForYear(now.getFullYear()),
    ...windowsForYear(now.getFullYear() + 1),
  ]
    .filter(w => new Date(w.windowEnd).getTime() >= today.getTime())
    .sort(
      (a, b) =>
        new Date(a.windowStart).getTime() - new Date(b.windowStart).getTime()
    )
    .slice(0, limit);
}
