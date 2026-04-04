/**
 * Monthly Story analytics events — SYN-673
 *
 * Fires GA4 events for the Monthly Story feature:
 *   monthly_story_viewed    — on page mount (story is visible)
 *   monthly_story_read_time — when user scrolls past 80% of story content
 *
 * NO PII in any event payload.
 *
 * @module lib/analytics/story-events
 */

type GTagWindow = Window & {
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
};

export type StoryEventName =
  | 'monthly_story_viewed'
  | 'monthly_story_read_time';

type StoryEventProps = {
  monthly_story_viewed: {
    story_month: string;    // e.g. "2026-03"
    geo_score_shown: boolean;
    wins_count: number;
  };
  monthly_story_read_time: {
    story_month: string;
    /** Seconds from story mount to 80% scroll — rounded to nearest 5s */
    time_to_80pct_seconds: number;
  };
};

export function fireStoryEvent<T extends StoryEventName>(
  name: T,
  params: StoryEventProps[T]
): void {
  if (typeof window === 'undefined') return;

  const win = window as GTagWindow;
  if (typeof win.gtag === 'function') {
    win.gtag('event', name, params);
  } else {
    win.dataLayer = win.dataLayer ?? [];
    win.dataLayer.push({ event: name, ...params });
  }
}
