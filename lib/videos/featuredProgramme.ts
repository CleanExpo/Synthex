/**
 * featuredProgramme — lib/videos/featuredProgramme.ts
 *
 * Shared, side-effect-free primitives for the "Featured in Synthex" case-study
 * video programme (SYN-508). Kept pure so the opt-in route, the dashboard card,
 * and the Authority Hub badge all agree on the status vocabulary + copy, and so
 * the logic is unit-testable without a DB or network.
 *
 * The status column lives on the Supabase `clients` table
 * (`featured_programme_status`) — see the create-only migration
 * supabase/migrations/20260710000000_syn508_featured_programme_status.sql
 *
 * @task SYN-508
 */

/** The four programme states, in lifecycle order. */
export const FEATURED_PROGRAMME_STATUSES = [
  'not_applied',
  'applied',
  'in_production',
  'published',
] as const;

export type FeaturedProgrammeStatus =
  (typeof FEATURED_PROGRAMME_STATUSES)[number];

/** The status a fresh client row carries. */
export const DEFAULT_FEATURED_STATUS: FeaturedProgrammeStatus = 'not_applied';

/** Type guard — narrows an unknown value to a valid programme status. */
export function isFeaturedProgrammeStatus(
  value: unknown
): value is FeaturedProgrammeStatus {
  return (
    typeof value === 'string' &&
    (FEATURED_PROGRAMME_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Opt-in is only meaningful from `not_applied`. Once a client has applied (or is
 * further along) the PATCH is a no-op so a double-click can't re-fire the Slack
 * alert or bump an in-production video back to the queue.
 */
export function canOptIn(current: unknown): boolean {
  return current === undefined || current === null || current === 'not_applied';
}

/** The Authority Hub "Featured in Synthex" badge shows only once published. */
export function shouldShowFeaturedBadge(status: unknown): boolean {
  return status === 'published';
}

/** The three benefit bullets shown in the dashboard card and the opt-in email. */
export const PROGRAMME_BENEFITS: readonly string[] = [
  'Free professional video',
  'Indexed by Google',
  'Linked from your Authority Hub',
] as const;

/** A single AI weekly-digest highlight ({ metric, value, change, trend }). */
export interface DigestHighlight {
  metric?: string;
  value?: string | number;
  change?: string | number;
  trend?: string;
}

/**
 * Pick the "best metric" to headline the Slack alert from an ai_weekly_digests
 * `highlights` JSON array. Prefers the highlight with the largest positive
 * numeric `change`; falls back to the first well-formed highlight. Returns null
 * when there is nothing presentable (caller degrades gracefully).
 */
export function extractBestMetric(highlights: unknown): string | null {
  if (!Array.isArray(highlights) || highlights.length === 0) return null;

  const parsed = highlights.filter(
    (h): h is DigestHighlight =>
      typeof h === 'object' && h !== null && 'metric' in h
  );
  if (parsed.length === 0) return null;

  const numericChange = (h: DigestHighlight): number => {
    const raw =
      typeof h.change === 'number'
        ? h.change
        : parseFloat(String(h.change ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(raw) ? raw : -Infinity;
  };

  const best = [...parsed].sort(
    (a, b) => numericChange(b) - numericChange(a)
  )[0];
  if (!best?.metric) return null;

  const value = best.value !== undefined ? `${best.value} ` : '';
  return `${value}${best.metric}`.trim();
}

/**
 * Build the Slack payload for the #featured-clients channel. Matches the simple
 * `{ text }` shape the pipeline runner already posts (lib/pipelines/runner.ts).
 */
export function buildOptInSlackMessage(params: {
  clientName: string;
  bestMetric?: string | null;
}): { text: string } {
  const { clientName, bestMetric } = params;
  const lines = [
    `:star2: *New "Featured in Synthex" opt-in*`,
    `Client: *${clientName}*`,
    bestMetric ? `Best metric: ${bestMetric}` : null,
    `Status: applied → ready for production review`,
  ].filter(Boolean);
  return { text: lines.join('\n') };
}
