import { normalizeSlotDay } from '@/hooks/use-optimal-times';
import type { OptimalTimeSlot } from '@/hooks/use-optimal-times';

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export interface BestBusinessSlot {
  at: Date;
  day: string;
  hour: number;
  platform: string;
  score: number;
}

function dayIndex(day: string): number {
  const name = normalizeSlotDay(day);
  const idx = DAY_NAMES.findIndex(d => d === name);
  return idx >= 0 ? idx : 0;
}

function slotInstant(weekStart: Date, day: string, hour: number): Date {
  const at = new Date(weekStart);
  at.setHours(0, 0, 0, 0);
  const startDay = at.getDay();
  const target = dayIndex(day);
  at.setDate(at.getDate() + ((target - startDay + 7) % 7));
  at.setHours(hour, 0, 0, 0);
  return at;
}

function tooClose(at: Date, taken: Date[], minutes: number): boolean {
  return taken.some(
    other => Math.abs(other.getTime() - at.getTime()) < minutes * 60 * 1000
  );
}

/**
 * Spread the strongest posting hours across one week without stacking
 * two posts in the same hour or crowding one weekday.
 */
export function pickBestBusinessSlots(options: {
  slots: OptimalTimeSlot[];
  weekStart: Date;
  existing: Date[];
  count?: number;
}): BestBusinessSlot[] {
  const count = options.count ?? 5;
  const byKey = new Map<string, OptimalTimeSlot>();

  for (const slot of options.slots) {
    const day = normalizeSlotDay(slot.day);
    const key = `${day}-${slot.hour}`;
    const prev = byKey.get(key);
    if (!prev || slot.score > prev.score) {
      byKey.set(key, { ...slot, day });
    }
  }

  const ranked = [...byKey.values()].sort((a, b) => b.score - a.score);
  const picked: BestBusinessSlot[] = [];
  const taken = [...options.existing];
  const perDay = new Map<string, number>();

  for (const slot of ranked) {
    if (picked.length >= count) break;
    const at = slotInstant(options.weekStart, slot.day, slot.hour);
    if (at.getTime() < Date.now() - 30 * 60 * 1000) continue;
    if (tooClose(at, taken, 90)) continue;
    const dayLoad = perDay.get(slot.day) ?? 0;
    if (dayLoad >= 1) continue;

    picked.push({
      at,
      day: slot.day,
      hour: slot.hour,
      platform: slot.platform,
      score: slot.score,
    });
    taken.push(at);
    perDay.set(slot.day, dayLoad + 1);
  }

  return picked.sort((a, b) => a.at.getTime() - b.at.getTime());
}
