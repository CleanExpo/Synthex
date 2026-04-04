/**
 * slotScheduler — lib/calendar/slotScheduler.ts
 *
 * Maps peak engagement hours + active platforms to exactly 7 optimal
 * posting slots for the coming week (Mon–Sun).
 *
 * Strategy:
 *  - One slot per day of the week (Mon=0 … Sun=6)
 *  - Hours distributed across the peak hours list (round-robin)
 *  - Platforms cycled across active platforms
 *  - Content types distributed to create a varied weekly mix
 *
 * @task SYN-521
 */

import type {
  CalendarPlatform,
  CalendarSlot,
  ContentType,
  DigestSignals,
} from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Slots per week — one per day Mon–Sun */
const SLOTS_PER_WEEK = 7;

/** Default posting hour (AEDT ≈ UTC 09:00) if no signal data */
const DEFAULT_HOUR_UTC = 9;

/**
 * A well-rounded weekly content mix applied in this order.
 * If the org's topContentTypes list is shorter, we cycle it.
 */
const WEEKLY_CONTENT_ROTATION: ContentType[] = [
  'educational',
  'engagement',
  'promotional',
  'behind-the-scenes',
  'educational',
  'testimonial',
  'engagement',
];

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate 7 CalendarSlot stubs (no captions yet — captions are added by
 * captionGenerator) for the given week start date.
 *
 * @param weekStartDate  Monday of the target week (local date)
 * @param signals        DigestSignals from digestReader
 */
export function scheduleSlotsForWeek(
  weekStartDate: Date,
  signals: DigestSignals
): Omit<CalendarSlot, 'captions'>[] {
  const { peakEngagementHours, activePlatforms, topContentTypes } = signals;

  const hours =
    peakEngagementHours.length > 0 ? peakEngagementHours : [DEFAULT_HOUR_UTC];

  const platforms: CalendarPlatform[] =
    activePlatforms.length > 0 ? activePlatforms : ['instagram'];

  const slots: Omit<CalendarSlot, 'captions'>[] = [];

  for (let dayOffset = 0; dayOffset < SLOTS_PER_WEEK; dayOffset++) {
    // Build the scheduled datetime: Monday + dayOffset days at the peak hour
    const slotDate = new Date(weekStartDate);
    slotDate.setUTCDate(slotDate.getUTCDate() + dayOffset);
    slotDate.setUTCHours(hours[dayOffset % hours.length], 0, 0, 0);

    // Cycle through platforms so each platform gets at least one slot
    const platform = platforms[dayOffset % platforms.length];

    // Weighted content type: prefer the org's top types, fall back to rotation
    const preferredTypes = topContentTypes.length >= 3 ? topContentTypes : [];
    const contentType: ContentType =
      preferredTypes.length > 0
        ? preferredTypes[dayOffset % preferredTypes.length]
        : WEEKLY_CONTENT_ROTATION[dayOffset];

    slots.push({
      id: crypto.randomUUID(),
      dayOfWeek: dayOffset, // 0=Mon … 6=Sun
      scheduledAt: slotDate.toISOString(),
      platform,
      hashtags: signals.winningHashtags.slice(0, 10), // top 10 for this slot
      contentType,
    });
  }

  return slots;
}

/** Return the Monday date for the week that starts on or after `fromDate` */
export function nextMondayFrom(fromDate: Date): Date {
  const date = new Date(fromDate);
  const day = date.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  date.setUTCDate(date.getUTCDate() + daysUntilMonday);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/** Return Sunday (end of week) from a Monday date */
export function weekEndFromStart(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() + 6);
  return end;
}
