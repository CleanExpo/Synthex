/**
 * Portfolio marketing calendar plan (Unite Group, from 02/11/2026).
 *
 * Pure planning layer: turns the per-brand weekly shares into dated calendar
 * slots. No database access here; `scripts/seed-portfolio-marketing-calendar.ts`
 * writes the result as draft CalendarPost rows.
 *
 * Founder target (31/10/2026): 10 short-form videos per week across the live
 * projects, Margot (HeyGen) as presenter, Business Card weighted highest.
 * Every slot is a draft awaiting approval; nothing here can schedule a post.
 */

import { zonedTimeToUtc } from '../content/timezone';

export const PORTFOLIO_TIMEZONE = 'Australia/Sydney';
export const PORTFOLIO_WEEKLY_VIDEO_TARGET = 10;
export const PORTFOLIO_PLAN_VERSION = 'portfolio-calendar-2026-11-v1';
export const PORTFOLIO_CALENDAR_TAG = 'portfolio-calendar-2026-11';

export type PortfolioSlotKind = 'shortform_video' | 'channel_post';

export interface PortfolioChannelPost {
  platform: string;
  perWeek: number;
}

export interface PortfolioBrandSchedule {
  orgSlug: string;
  label: string;
  videosPerWeek: number;
  videoPlatforms: string[];
  channelPosts: PortfolioChannelPost[];
  /** Short-form themes, rotated through the weeks. Briefs, not finished copy. */
  themes: string[];
  /** Set when the brand must not get public content yet (e.g. not released). */
  publicContentHeldReason?: string;
}

export interface PortfolioSlot {
  slotKey: string;
  orgSlug: string;
  kind: PortfolioSlotKind;
  weekStart: string;
  scheduledFor: Date;
  localTime: string;
  platforms: string[];
  theme: string;
  sequence: number;
  weeklyCount: number;
}

// Two short-form drops a weekday: 10 a week.
const VIDEO_TIMES: Array<[number, number]> = [
  [7, 30],
  [12, 30],
];
const WEEKDAYS = 5;
// Channel posts go out mid-week, mid-morning.
const CHANNEL_POST_DAY = 2;
const CHANNEL_POST_TIME: [number, number] = [9, 0];

function parseWeekStart(weekStart: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekStart);
  if (!match)
    throw new Error(`weekStart must be YYYY-MM-DD, got "${weekStart}"`);
  // Noon UTC is the same calendar day in Sydney, so zonedTimeToUtc lands on it.
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 2, 0, 0)
  );
  const weekday = new Intl.DateTimeFormat('en-AU', {
    timeZone: PORTFOLIO_TIMEZONE,
    weekday: 'short',
  }).format(date);
  if (weekday !== 'Mon') {
    throw new Error(
      `weekStart ${weekStart} is a ${weekday}, expected a Monday`
    );
  }
  return date;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function localLabel(
  weekStart: string,
  dayOffset: number,
  [h, m]: [number, number]
) {
  const day = addDays(parseWeekStart(weekStart), dayOffset);
  const date = new Intl.DateTimeFormat('en-AU', {
    timeZone: PORTFOLIO_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(day);
  return `${date} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} Sydney`;
}

export function assertPortfolioSchedule(
  brands: PortfolioBrandSchedule[]
): void {
  const total = brands.reduce((sum, b) => sum + b.videosPerWeek, 0);
  if (total !== PORTFOLIO_WEEKLY_VIDEO_TARGET) {
    throw new Error(
      `Weekly short-form total is ${total}, expected ${PORTFOLIO_WEEKLY_VIDEO_TARGET}`
    );
  }
  if (total > VIDEO_TIMES.length * WEEKDAYS) {
    throw new Error(
      `Only ${VIDEO_TIMES.length * WEEKDAYS} video times exist per week`
    );
  }
  const slugs = new Set<string>();
  for (const brand of brands) {
    if (slugs.has(brand.orgSlug))
      throw new Error(`Duplicate brand ${brand.orgSlug}`);
    slugs.add(brand.orgSlug);
    const publicCount =
      brand.videosPerWeek +
      brand.channelPosts.reduce((s, c) => s + c.perWeek, 0);
    if (brand.publicContentHeldReason && publicCount > 0) {
      throw new Error(
        `${brand.orgSlug} is held (${brand.publicContentHeldReason}) but has ${publicCount} weekly slots`
      );
    }
    if (brand.videosPerWeek > 0 && brand.themes.length === 0) {
      throw new Error(`${brand.orgSlug} has video slots but no themes`);
    }
    if (brand.videosPerWeek > 0 && brand.videoPlatforms.length === 0) {
      throw new Error(`${brand.orgSlug} has video slots but no platforms`);
    }
  }
  const heaviest = Math.max(...brands.map(b => b.videosPerWeek));
  const card = brands.find(b => b.orgSlug === 'business-card');
  if (!card || card.videosPerWeek !== heaviest) {
    throw new Error('Business Card must carry the highest weekly video share');
  }
}

/**
 * Interleave brands by weight so no brand bunches on one day:
 * round 1 takes one from every brand with videos left, round 2 the same, ...
 */
function videoOrder(brands: PortfolioBrandSchedule[]): string[] {
  const remaining = new Map(brands.map(b => [b.orgSlug, b.videosPerWeek]));
  const ordered = [...brands]
    .filter(b => b.videosPerWeek > 0)
    .sort((a, b) => b.videosPerWeek - a.videosPerWeek);
  const out: string[] = [];
  while (out.length < PORTFOLIO_WEEKLY_VIDEO_TARGET) {
    for (const brand of ordered) {
      const left = remaining.get(brand.orgSlug) ?? 0;
      if (left > 0) {
        out.push(brand.orgSlug);
        remaining.set(brand.orgSlug, left - 1);
      }
    }
  }
  return out;
}

export function buildPortfolioCalendar(
  brands: PortfolioBrandSchedule[],
  weekStarts: string[]
): PortfolioSlot[] {
  assertPortfolioSchedule(brands);
  const bySlug = new Map(brands.map(b => [b.orgSlug, b]));
  const slots: PortfolioSlot[] = [];

  weekStarts.forEach((weekStart, weekIndex) => {
    const monday = parseWeekStart(weekStart);
    const seen = new Map<string, number>();

    videoOrder(brands).forEach((orgSlug, i) => {
      const brand = bySlug.get(orgSlug)!;
      const n = (seen.get(orgSlug) ?? 0) + 1;
      seen.set(orgSlug, n);
      const dayOffset = i % WEEKDAYS;
      const time = VIDEO_TIMES[Math.floor(i / WEEKDAYS)];
      const theme =
        brand.themes[
          (weekIndex * brand.videosPerWeek + n - 1) % brand.themes.length
        ];
      slots.push({
        slotKey: `${weekStart}-${orgSlug}-video-${n}`,
        orgSlug,
        kind: 'shortform_video',
        weekStart,
        scheduledFor: zonedTimeToUtc(
          addDays(monday, dayOffset),
          PORTFOLIO_TIMEZONE,
          ...time
        ),
        localTime: localLabel(weekStart, dayOffset, time),
        platforms: brand.videoPlatforms,
        theme,
        sequence: n,
        weeklyCount: brand.videosPerWeek,
      });
    });

    for (const brand of brands) {
      for (const channel of brand.channelPosts) {
        for (let n = 1; n <= channel.perWeek; n++) {
          const dayOffset = (CHANNEL_POST_DAY + n - 1) % WEEKDAYS;
          slots.push({
            slotKey: `${weekStart}-${brand.orgSlug}-${channel.platform}-${n}`,
            orgSlug: brand.orgSlug,
            kind: 'channel_post',
            weekStart,
            scheduledFor: zonedTimeToUtc(
              addDays(monday, dayOffset),
              PORTFOLIO_TIMEZONE,
              ...CHANNEL_POST_TIME
            ),
            localTime: localLabel(weekStart, dayOffset, CHANNEL_POST_TIME),
            platforms: [channel.platform],
            theme:
              brand.themes[
                (weekIndex + n - 1) % Math.max(brand.themes.length, 1)
              ] ?? brand.label,
            sequence: n,
            weeklyCount: channel.perWeek,
          });
        }
      }
    }
  });

  return slots;
}

/** Draft brief stored as the CalendarPost body. Not caption copy. */
export function slotBrief(
  slot: PortfolioSlot,
  brand: PortfolioBrandSchedule
): string {
  if (slot.kind === 'shortform_video') {
    return [
      `DRAFT BRIEF: short-form video ${slot.sequence} of ${slot.weeklyCount} this week for ${brand.label}.`,
      `Theme: ${slot.theme}.`,
      'Format: 9:16, 20 to 45 seconds, Margot (HeyGen) presenting, footage-first.',
      'Video comes from the short-form engine after its SDA visual gate; caption is written after the edit.',
      'Status: draft, pending approval. Nothing posts until Phill approves it and turns publishing on.',
    ].join('\n');
  }
  return [
    `DRAFT BRIEF: ${slot.platforms[0]} post for ${brand.label}.`,
    `Theme: ${slot.theme}.`,
    'Copy to be written from this week’s approved short-form video and the brand rules.',
    'Status: draft, pending approval. Nothing posts until Phill approves it and turns publishing on.',
  ].join('\n');
}
