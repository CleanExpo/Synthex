/**
 * Campaign scheduler payload loader — pure planning logic.
 *
 * Maps a campaign pack's `scheduler-payloads.json` entries onto the
 * `/api/scheduler/posts` contract:
 *   - `suggestedScheduleAt` → `scheduledAt` (UTC ISO — the route's Zod
 *     `z.string().datetime()` rejects `+10:00`-style offsets)
 *   - `mediaUrls` → `metadata.images` (the cron reads images from metadata)
 *   - entries with `status: 'hold'` are skipped
 *   - past dates are re-anchored by a UNIFORM whole-day shift so the
 *     campaign's relative cadence is preserved
 *
 * Spec: docs/specs/2026-07-09-carsi-linkedin-golive-spec.md (E4).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Minimum lead time the first post must have after re-anchoring. */
export const MIN_LEAD_MS = 2 * 60 * 60 * 1000;

export interface CampaignPayloadPost {
  id: string;
  draftRef?: string;
  platform: string;
  content: string;
  mediaUrls?: string[];
  suggestedScheduleAt: string;
  link?: string;
  status?: string;
}

export interface SchedulerLoadEntry {
  id: string;
  platform: string;
  content: string;
  mediaUrls: string[];
  originalScheduledAt: string;
  /** UTC ISO string ready for the scheduler's `scheduledAt` field. */
  scheduledAt: string;
}

export interface SchedulerLoadPlan {
  entries: SchedulerLoadEntry[];
  skipped: Array<{ id: string; reason: string }>;
  /** Whole days every entry was shifted forward (0 = schedule untouched). */
  shiftDays: number;
}

/**
 * Build the load plan for one platform.
 *
 * Throws (fail loud) on an unparseable date or when a shifted entry would
 * still land in the past — never silently drops or mis-schedules a post.
 */
export function buildSchedulerLoadPlan(params: {
  posts: CampaignPayloadPost[];
  platform: string;
  now: Date;
}): SchedulerLoadPlan {
  const { posts, platform, now } = params;

  const skipped: SchedulerLoadPlan['skipped'] = [];
  const selected: Array<{ post: CampaignPayloadPost; time: number }> = [];

  for (const post of posts) {
    if (post.platform !== platform) continue;
    if (post.status === 'hold') {
      skipped.push({ id: post.id, reason: 'status=hold' });
      continue;
    }
    const time = new Date(post.suggestedScheduleAt).getTime();
    if (Number.isNaN(time)) {
      throw new Error(
        `Unparseable suggestedScheduleAt for ${post.id}: "${post.suggestedScheduleAt}"`
      );
    }
    selected.push({ post, time });
  }

  if (selected.length === 0) {
    return { entries: [], skipped, shiftDays: 0 };
  }

  const earliest = Math.min(...selected.map(item => item.time));
  const minStart = now.getTime() + MIN_LEAD_MS;
  const shiftDays =
    earliest < minStart ? Math.ceil((minStart - earliest) / DAY_MS) : 0;
  const shiftMs = shiftDays * DAY_MS;

  const entries = selected
    .sort((a, b) => a.time - b.time)
    .map(({ post, time }) => {
      const shifted = time + shiftMs;
      if (shifted <= now.getTime()) {
        throw new Error(
          `Post ${post.id} would still be scheduled in the past after a ${shiftDays}-day shift — refusing to build the plan`
        );
      }
      return {
        id: post.id,
        platform: post.platform,
        content: post.content,
        mediaUrls: post.mediaUrls ?? [],
        originalScheduledAt: post.suggestedScheduleAt,
        scheduledAt: new Date(shifted).toISOString(),
      };
    });

  return { entries, skipped, shiftDays };
}

/** Request body for one `/api/scheduler/posts` POST. */
export function toSchedulerPostBody(
  entry: SchedulerLoadEntry,
  options?: { batchId?: string }
): Record<string, unknown> {
  return {
    content: entry.content,
    platform: entry.platform,
    scheduledAt: entry.scheduledAt,
    metadata: {
      ...(entry.mediaUrls.length > 0 ? { images: entry.mediaUrls } : {}),
      ...(options?.batchId ? { batchId: options.batchId } : {}),
    },
  };
}
