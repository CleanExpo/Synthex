/**
 * Timezone helpers for content scheduling
 *
 * @description Small, dependency-free helpers for computing wall-clock posting
 * times in a team's IANA timezone (e.g. `Australia/Sydney`) and reading the
 * wall-clock hour / weekday of an instant *in* that timezone.
 *
 * WHY: Optimal posting-time suggestions (OPTIMAL_TIMES) are wall-clock hours
 * the team understands ("9am"). The previous implementation used Date.setHours
 * / Date.getHours, which resolve against the SERVER's local clock. On a UTC
 * production server a "9am" suggestion drifted to 9am UTC (= 7pm Sydney),
 * silently wrong for the team. These helpers anchor those hours to the org's
 * timezone instead.
 *
 * NO NEW DEPENDENCY: uses the platform `Intl` API, which is DST-correct (unlike
 * a hardcoded fixed-offset map). Only `date-fns` (no `-tz`) is installed and the
 * dependency-discipline gate makes adding `date-fns-tz` a CEO decision; `Intl`
 * already solves this.
 */

/**
 * Default team timezone when none is stored.
 *
 * Mirrors `Organization.timezone @default("Australia/Sydney")` in
 * `prisma/schema.prisma` and the Australian-English product convention. Used as
 * the fallback when a caller does not supply the org's timezone.
 */
export const DEFAULT_TIMEZONE = 'Australia/Sydney';

/**
 * The wall-clock parts of an instant, read in a specific IANA timezone.
 */
export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number;
  second: number;
  /** Day of week, 0 = Sunday .. 6 = Saturday (matches Date.getDay). */
  weekday: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Read the wall-clock parts of `date` as they appear in `timeZone`.
 *
 * Example: an instant of 2026-06-15T23:00:00Z read in `Australia/Sydney`
 * (UTC+10 in June, no DST) yields hour 9 the next calendar day.
 */
export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });

  const parts: Record<string, string> = {};
  for (const p of formatter.formatToParts(date)) {
    if (p.type !== 'literal') {
      parts[p.type] = p.value;
    }
  }

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
  };
}

/**
 * Compute the offset (minutes) of `timeZone` from UTC at the given instant.
 * Positive east of UTC (Sydney winter = +600). DST-correct because it is
 * derived from `Intl` for that specific instant.
 */
function getOffsetMinutes(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  // The wall-clock parts, interpreted as if they were UTC, minus the real UTC
  // instant, gives the zone's offset from UTC at that moment.
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/**
 * Build the UTC `Date` for a given wall-clock time on a given calendar day in
 * `timeZone`. The calendar day is taken from how `referenceDate` reads *in that
 * timezone* (so "the optimal hours for the day the user is looking at").
 *
 * DST-correct: resolves the zone offset twice so that a target hour that lands
 * either side of a DST transition still maps to the intended wall-clock time.
 *
 * @param referenceDate Any instant on the target calendar day.
 * @param timeZone IANA timezone, e.g. `Australia/Sydney`.
 * @param hour Wall-clock hour 0-23.
 * @param minute Wall-clock minute (default 0).
 */
export function zonedTimeToUtc(
  referenceDate: Date,
  timeZone: string,
  hour: number,
  minute = 0
): Date {
  const day = getZonedParts(referenceDate, timeZone);

  // First pass: treat the desired wall-clock as if UTC, then correct by the
  // offset at that provisional instant.
  const provisionalUtcMs = Date.UTC(day.year, day.month - 1, day.day, hour, minute, 0);
  const offset1 = getOffsetMinutes(new Date(provisionalUtcMs), timeZone);
  const candidateMs = provisionalUtcMs - offset1 * 60000;

  // Second pass guards a DST boundary where offset1 differs from the offset
  // actually in effect at the candidate instant.
  const offset2 = getOffsetMinutes(new Date(candidateMs), timeZone);
  if (offset2 !== offset1) {
    return new Date(provisionalUtcMs - offset2 * 60000);
  }

  return new Date(candidateMs);
}
