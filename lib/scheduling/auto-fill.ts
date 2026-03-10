/**
 * Auto-Fill Scheduling Algorithm
 *
 * Pure function that distributes N content items across optimal time slots.
 * Takes pre-fetched data as arguments (no hooks, no fetch calls) so it's
 * fully testable and usable in both client and server contexts.
 *
 * Algorithm:
 * 1. For each content item, get optimal slots for its platform (sorted by score desc)
 * 2. Map abstract day+hour slots to concrete dates within the start-end range
 * 3. Greedily assign items to the highest-scoring available slot
 * 4. Fall back to next-best non-conflicting slot when optimal ones are taken
 * 5. Return assignments sorted by scheduledAt
 *
 * @module lib/scheduling/auto-fill
 * Linear: SYN-44
 */

// =============================================================================
// Types
// =============================================================================

export interface ContentItem {
  content: string;
  platform: string;
  hashtags?: string[];
  mediaUrls?: string[];
  preferredDate?: Date; // optional user preference
}

export interface OptimalSlot {
  day: string; // 'Monday', 'Tuesday', etc.
  hour: number; // 0-23
  score: number; // 0-100
  platform: string;
}

export interface ExistingPost {
  platform: string;
  scheduledAt: Date;
}

export interface ScheduleSlot {
  contentItem: ContentItem;
  scheduledAt: Date;
  score: number; // ML confidence score for this slot
  conflict: boolean; // whether this slot had a near-conflict that was resolved
}

export interface AutoFillOptions {
  startDate: Date;
  endDate: Date;
  minIntervalHours: number; // minimum gap between posts on same platform
  timezone: string;
  maxPostsPerDay: number; // prevent overloading (default 5)
}

// =============================================================================
// Constants
// =============================================================================

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** Default working hours for fallback slot generation (9 AM - 8 PM) */
const FALLBACK_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const DEFAULT_FALLBACK_SCORE = 40;

// =============================================================================
// Helpers
// =============================================================================

/** Map string day name to 0-6 index (Sunday = 0) */
function dayNameToIndex(dayName: string): number {
  const idx = DAY_NAMES.findIndex(
    (d) => d.toLowerCase() === dayName.toLowerCase()
  );
  return idx >= 0 ? idx : 0;
}

/**
 * Generate all concrete dates within [startDate, endDate] for a given
 * day-of-week + hour combination.
 */
function concreteDatesForSlot(
  dayName: string,
  hour: number,
  startDate: Date,
  endDate: Date
): Date[] {
  const targetDay = dayNameToIndex(dayName);
  const dates: Date[] = [];

  // Start from startDate, find first occurrence of targetDay
  const cursor = new Date(startDate);
  cursor.setHours(hour, 0, 0, 0);

  // Move cursor to the first targetDay on or after startDate
  const currentDay = cursor.getDay();
  const daysUntil = (targetDay - currentDay + 7) % 7;
  cursor.setDate(cursor.getDate() + daysUntil);

  // If the resulting date is before startDate (same day but hour < startDate hour), it's fine
  // because we set hours explicitly. But if the date itself is before startDate date, skip to next week.
  if (cursor < startDate) {
    cursor.setDate(cursor.getDate() + 7);
  }

  // Collect all occurrences within the range
  while (cursor <= endDate) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }

  return dates;
}

/**
 * Check if a proposed date/time conflicts with already-assigned slots
 * or existing posts on the same platform.
 */
function hasConflict(
  proposedTime: Date,
  platform: string,
  assignedSlots: ScheduleSlot[],
  existingPosts: ExistingPost[],
  minIntervalMs: number
): boolean {
  const proposedMs = proposedTime.getTime();
  const platformLower = platform.toLowerCase();

  // Check against existing posts
  for (const post of existingPosts) {
    if (post.platform.toLowerCase() !== platformLower) continue;
    const diff = Math.abs(post.scheduledAt.getTime() - proposedMs);
    if (diff < minIntervalMs) return true;
  }

  // Check against already-assigned slots
  for (const slot of assignedSlots) {
    if (slot.contentItem.platform.toLowerCase() !== platformLower) continue;
    const diff = Math.abs(slot.scheduledAt.getTime() - proposedMs);
    if (diff < minIntervalMs) return true;
  }

  return false;
}

/**
 * Count how many posts are already assigned on a given calendar day
 * (including existing posts and newly assigned slots).
 */
function postsOnDate(
  date: Date,
  assignedSlots: ScheduleSlot[],
  existingPosts: ExistingPost[]
): number {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  let count = 0;

  for (const post of existingPosts) {
    if (post.scheduledAt >= dayStart && post.scheduledAt <= dayEnd) {
      count++;
    }
  }

  for (const slot of assignedSlots) {
    if (slot.scheduledAt >= dayStart && slot.scheduledAt <= dayEnd) {
      count++;
    }
  }

  return count;
}

/**
 * Generate fallback candidate dates across the date range.
 * Used when no optimal slots are available for a platform.
 */
function generateFallbackDates(
  startDate: Date,
  endDate: Date
): Array<{ date: Date; score: number }> {
  const candidates: Array<{ date: Date; score: number }> = [];
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= endDate) {
    for (const hour of FALLBACK_HOURS) {
      const candidate = new Date(cursor);
      candidate.setHours(hour, 0, 0, 0);
      if (candidate >= startDate && candidate <= endDate) {
        candidates.push({ date: candidate, score: DEFAULT_FALLBACK_SCORE });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return candidates;
}

// =============================================================================
// Main Algorithm
// =============================================================================

/**
 * Distribute N content items across optimal time slots within a date range.
 *
 * @param items - Content items to schedule
 * @param optimalSlots - ML-predicted optimal slots per platform
 * @param existingPosts - Already-scheduled posts to avoid conflicts with
 * @param options - Scheduling constraints
 * @returns Array of assigned schedule slots, sorted by scheduledAt
 */
export function autoFillSchedule(
  items: ContentItem[],
  optimalSlots: OptimalSlot[],
  existingPosts: ExistingPost[],
  options: AutoFillOptions
): ScheduleSlot[] {
  const {
    startDate,
    endDate,
    minIntervalHours,
    maxPostsPerDay,
  } = options;

  const minIntervalMs = minIntervalHours * 60 * 60 * 1000;
  const assignedSlots: ScheduleSlot[] = [];

  // Sort items: those with preferredDate first, then by platform for grouping
  const sortedItems = [...items].sort((a, b) => {
    if (a.preferredDate && !b.preferredDate) return -1;
    if (!a.preferredDate && b.preferredDate) return 1;
    return a.platform.localeCompare(b.platform);
  });

  for (const item of sortedItems) {
    const platformLower = item.platform.toLowerCase();

    // ---- Step 1: If item has a preferred date, try it first ----
    if (item.preferredDate) {
      const preferred = new Date(item.preferredDate);
      if (
        preferred >= startDate &&
        preferred <= endDate &&
        postsOnDate(preferred, assignedSlots, existingPosts) < maxPostsPerDay
      ) {
        const isConflicting = hasConflict(
          preferred,
          platformLower,
          assignedSlots,
          existingPosts,
          minIntervalMs
        );

        if (!isConflicting) {
          assignedSlots.push({
            contentItem: item,
            scheduledAt: preferred,
            score: 50, // neutral score for user-preferred time
            conflict: false,
          });
          continue;
        }
      }
    }

    // ---- Step 2: Get optimal slots for this platform ----
    const platformOptimalSlots = optimalSlots
      .filter((s) => s.platform.toLowerCase() === platformLower)
      .sort((a, b) => b.score - a.score);

    // Build candidate dates from optimal slots
    type Candidate = { date: Date; score: number };
    const candidates: Candidate[] = [];

    for (const slot of platformOptimalSlots) {
      const dates = concreteDatesForSlot(
        slot.day,
        slot.hour,
        startDate,
        endDate
      );
      for (const date of dates) {
        candidates.push({ date, score: slot.score });
      }
    }

    // Sort candidates by score descending, then by date ascending for tie-breaking
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.date.getTime() - b.date.getTime();
    });

    // ---- Step 3: Greedy assignment ----
    let assigned = false;

    for (const candidate of candidates) {
      // Check max posts per day
      if (postsOnDate(candidate.date, assignedSlots, existingPosts) >= maxPostsPerDay) {
        continue;
      }

      // Check min interval conflict
      const isConflicting = hasConflict(
        candidate.date,
        platformLower,
        assignedSlots,
        existingPosts,
        minIntervalMs
      );

      if (!isConflicting) {
        assignedSlots.push({
          contentItem: item,
          scheduledAt: candidate.date,
          score: candidate.score,
          conflict: false,
        });
        assigned = true;
        break;
      }
    }

    // ---- Step 4: Fallback to any non-conflicting slot ----
    if (!assigned) {
      const fallbackCandidates = generateFallbackDates(startDate, endDate);

      for (const fallback of fallbackCandidates) {
        if (postsOnDate(fallback.date, assignedSlots, existingPosts) >= maxPostsPerDay) {
          continue;
        }

        const isConflicting = hasConflict(
          fallback.date,
          platformLower,
          assignedSlots,
          existingPosts,
          minIntervalMs
        );

        if (!isConflicting) {
          assignedSlots.push({
            contentItem: item,
            scheduledAt: fallback.date,
            score: fallback.score,
            conflict: true, // mark as conflict-resolved (used fallback)
          });
          assigned = true;
          break;
        }
      }
    }

    // If still not assigned (extremely constrained range), skip this item
    // The caller can detect this by comparing output length to input length
  }

  // ---- Step 5: Sort by scheduledAt ----
  assignedSlots.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  return assignedSlots;
}
