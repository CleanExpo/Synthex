// SYN-525: First Win Detection
// Detects when a post outperforms the client's rolling baseline by >= 1.3x
// Pure function — no side effects, fully testable.

export type WinMetric = 'reach' | 'engagement_rate' | 'click_through' | 'saves' | 'impressions';

export interface PostPerformance {
  postId: string;
  postedAt: Date;
  metric: WinMetric;
  value: number;
}

export interface ClientBaseline {
  userId: string;
  metric: WinMetric;
  rollingAverage: number; // 30-day rolling average
  firstWinDetected: boolean;
}

export interface WinEvent {
  userId: string;
  postId: string;
  postedAt: Date;
  metric: WinMetric;
  actualValue: number;
  baselineValue: number;
  improvementPct: number;
  detectedAt: Date;
}

export const WIN_THRESHOLD = 1.3; // 30% above baseline triggers first win

/**
 * Detect if a post qualifies as the user's first win.
 * Returns a WinEvent if the post clears the threshold and no prior win exists.
 * Returns null if:
 *   - post is below threshold
 *   - baseline is zero (no data yet)
 *   - user has already had their first win (idempotent)
 */
export function detectFirstWin(
  post: PostPerformance,
  baseline: ClientBaseline,
): WinEvent | null {
  // Already won — do not re-trigger
  if (baseline.firstWinDetected) return null;

  // Cannot compute threshold against zero baseline
  if (baseline.rollingAverage <= 0) return null;

  // Must be same metric type
  if (post.metric !== baseline.metric) return null;

  const ratio = post.value / baseline.rollingAverage;
  if (ratio < WIN_THRESHOLD) return null;

  const improvementPct = Math.round((ratio - 1) * 100);

  return {
    userId: baseline.userId,
    postId: post.postId,
    postedAt: post.postedAt,
    metric: post.metric,
    actualValue: post.value,
    baselineValue: baseline.rollingAverage,
    improvementPct,
    detectedAt: new Date(),
  };
}

/**
 * Format a human-readable win description for use in notifications.
 * e.g. "Your post got 312 impressions — 47% above your 212-impression average"
 */
export function formatWinCopy(win: WinEvent): { title: string; body: string } {
  const metricLabel: Record<WinMetric, string> = {
    reach: 'reach',
    engagement_rate: 'engagement rate',
    click_through: 'click-through rate',
    saves: 'saves',
    impressions: 'impressions',
  };

  const label = metricLabel[win.metric];
  const postedDay = win.postedAt.toLocaleDateString('en-AU', { weekday: 'long' });

  return {
    title: `Your first win! 🎉`,
    body: `Your ${postedDay} post got ${win.actualValue.toLocaleString()} ${label} — ${win.improvementPct}% above your ${Math.round(win.baselineValue).toLocaleString()}-${label} average.`,
  };
}
