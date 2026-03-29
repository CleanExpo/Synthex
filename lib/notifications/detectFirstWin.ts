/**
 * detectFirstWin — pure function
 *
 * Determines whether a single post performance reading constitutes a "first win"
 * relative to the client's rolling baseline engagement.
 *
 * A win is: actual_value >= baseline_value * threshold (default 1.3×)
 *
 * This function has no side effects — it never reads from or writes to the
 * database. Callers are responsible for idempotency (checking firstWinDetected
 * before calling and persisting after).
 *
 * @task SYN-525
 */

/** Metrics that can trigger a first win */
export type WinMetric =
  | 'reach'
  | 'impressions'
  | 'engagementRate'
  | 'clicks'
  | 'saves';

/** Returned when a win is detected; null when no win */
export interface WinEvent {
  /** ID of the PlatformPost that triggered the win */
  postId: string;
  /** Which metric won */
  metric: WinMetric;
  /** Actual value recorded for this post */
  actualValue: number;
  /** Client's 30-day rolling average for this metric */
  baselineValue: number;
  /** e.g. 47 means "47% above baseline" (rounded integer) */
  improvementPct: number;
  /** When the detection ran */
  detectedAt: Date;
}

export interface DetectFirstWinParams {
  postId: string;
  metric: WinMetric;
  /** The value recorded for this specific post */
  actualValue: number;
  /** Client's 30-day rolling average for this metric — must be > 0 */
  baselineValue: number;
  /**
   * Multiplier threshold.
   * Default: 1.3 (30% above baseline triggers a win).
   * Configurable per-client in the future via AutopilotConfig.
   */
  threshold?: number;
}

/**
 * Returns a WinEvent if the post beats the baseline by the threshold, else null.
 *
 * @example
 * // Post got 312 impressions vs 212 avg baseline → 47% above → win
 * detectFirstWin({ postId: 'xyz', metric: 'impressions', actualValue: 312, baselineValue: 212 })
 * // → { postId: 'xyz', metric: 'impressions', actualValue: 312, baselineValue: 212, improvementPct: 47, detectedAt: ... }
 *
 * @example
 * // Post got 220 impressions vs 212 avg baseline → only 3.7% above → no win
 * detectFirstWin({ postId: 'xyz', metric: 'impressions', actualValue: 220, baselineValue: 212 })
 * // → null
 */
export function detectFirstWin(params: DetectFirstWinParams): WinEvent | null {
  const {
    postId,
    metric,
    actualValue,
    baselineValue,
    threshold = 1.3,
  } = params;

  // Guard: baseline must be a positive number to avoid division-by-zero
  // and nonsensical wins against a zero baseline
  if (baselineValue <= 0) return null;

  // Guard: actual value must be positive
  if (actualValue <= 0) return null;

  const ratio = actualValue / baselineValue;

  if (ratio < threshold) return null;

  const improvementPct = Math.round((ratio - 1) * 100);

  return {
    postId,
    metric,
    actualValue,
    baselineValue,
    improvementPct,
    detectedAt: new Date(),
  };
}

/**
 * Build the human-readable win message from a WinEvent.
 * e.g. "Your post got 312 impressions — 47% above your 212-impression average."
 */
export function formatWinMessage(win: WinEvent): string {
  const metricLabels: Record<WinMetric, string> = {
    reach: 'reach',
    impressions: 'impressions',
    engagementRate: '% engagement rate',
    clicks: 'clicks',
    saves: 'saves',
  };

  const label = metricLabels[win.metric];
  const actual =
    win.metric === 'engagementRate'
      ? `${win.actualValue.toFixed(1)}%`
      : win.actualValue.toLocaleString();
  const baseline =
    win.metric === 'engagementRate'
      ? `${win.baselineValue.toFixed(1)}%`
      : win.baselineValue.toLocaleString();

  return `Your post got ${actual} ${label} — ${win.improvementPct}% above your ${baseline} average.`;
}
