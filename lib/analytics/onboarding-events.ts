/**
 * Onboarding funnel analytics helpers — SYN-505
 *
 * Fires custom events to GA4 at each stage of the onboarding funnel.
 * All events are mirrored to Vercel Analytics when @vercel/analytics is available.
 *
 * NO PII in any event payload — business name and URL are deliberately excluded.
 *
 * GA4 Funnel Exploration setup:
 *   1. Open GA4 → Explore → Funnel Exploration
 *   2. Add steps in order: onboarding_form_submitted → brand_scan_initiated →
 *      brand_scan_complete → brand_mirror_shown → social_account_connected
 *   3. Add brand_mirror_fallback_shown and onboarding_skipped as separate reports
 *
 * @module lib/analytics/onboarding-events
 */

// ============================================================================
// TYPES
// ============================================================================

type GTagWindow = Window & {
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
};

/** Event names for the onboarding funnel. */
export type OnboardingEventName =
  | 'onboarding_form_submitted'
  | 'brand_scan_initiated'
  | 'brand_scan_complete'
  | 'brand_mirror_shown'
  | 'brand_mirror_fallback_shown'
  | 'social_account_connected'
  | 'onboarding_skipped'
  | 'onboarding_season_brief_shown';

/** Event-specific properties (no PII). */
type EventProps = {
  brand_scan_complete: {
    /** 0–100 pipeline confidence score */
    confidence_score: number;
    /** Total scan time in whole seconds */
    scan_duration_seconds: number;
  };
  brand_mirror_fallback_shown: {
    /** 0–100 pipeline confidence score that triggered the fallback */
    confidence_score: number;
  };
  social_account_connected: {
    /** Platform identifier (e.g. 'instagram', 'linkedin') */
    platform: string;
  };
  onboarding_form_submitted: Record<string, never>;
  brand_scan_initiated: Record<string, never>;
  brand_mirror_shown: Record<string, never>;
  onboarding_skipped: Record<string, never>;
  onboarding_season_brief_shown: {
    /** industry slug shown e.g. "plumbing-hvac" or "general" (fallback) */
    industry_slug: string;
    /** number of signals returned (0 = fallback public holidays shown) */
    signal_count: number;
  };
};

// ============================================================================
// CORE FIRE FUNCTION
// ============================================================================

/**
 * Fire a GA4 custom event.
 *
 * Safe to call during SSR (no-ops), before GA4 loads (queued via dataLayer),
 * and when the user has not accepted cookie consent (GA4 won't have loaded).
 *
 * @example
 * fireEvent('brand_scan_complete', { confidence_score: 72, scan_duration_seconds: 18 });
 */
export function fireEvent<T extends OnboardingEventName>(
  name: T,
  ...args: EventProps[T] extends Record<string, never>
    ? []
    : [params: EventProps[T]]
): void {
  if (typeof window === 'undefined') return;

  const params = args[0] ?? {};

  // GA4 via gtag()
  const win = window as GTagWindow;
  if (typeof win.gtag === 'function') {
    win.gtag('event', name, params);
  } else {
    // Queue via dataLayer so the event is captured when gtag loads
    win.dataLayer = win.dataLayer ?? [];
    win.dataLayer.push({ event: name, ...params });
  }

  // Vercel Analytics (dynamic import — only fires if @vercel/analytics is installed)
  // To enable: npm install @vercel/analytics, then uncomment the block below.
  //
  // import('@vercel/analytics').then(({ track }) => {
  //   track(name, params as Record<string, string | number | boolean>);
  // }).catch(() => { /* package not installed — safe to ignore */ });
}
