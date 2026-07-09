/**
 * Client engagement telemetry — SYN-612
 *
 * Fires the 10 client-engagement GA4 events AND dual-writes each to the
 * `client_engagement_events` table (via POST /api/analytics/engagement-event,
 * which does the server-side Supabase + GA4 Measurement Protocol write). The
 * client-side gtag call feeds GA4 real-time/attribution; the server write feeds
 * Health Score computation (lib/health-score/compute.ts).
 *
 * Privacy: NO PII in any payload. session_id is a random per-browser-session
 * UUID held in sessionStorage — not a tracking cookie, cleared when the tab
 * session ends. client_id is resolved server-side from the auth context
 * (Organization.id), never sent from the browser.
 *
 * Deduplication: `dashboard_visit` is debounced to one fire per 30-minute
 * window per page_path per session. Every other event is logged per-occurrence.
 *
 * @module lib/analytics/engagement-events
 */

type GTagWindow = Window & {
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
};

export type EngagementEventName =
  | 'dashboard_visit'
  | 'calendar_post_viewed'
  | 'calendar_post_approved'
  | 'calendar_post_dismissed'
  | 'digest_email_opened'
  | 'advisor_brief_viewed'
  | 'review_response_started'
  | 'review_response_published'
  | 'authority_hub_viewed'
  | 'settings_changed';

/**
 * Per-event structured metadata. All values are internal identifiers or enums —
 * never emails, names, or other PII. `page_path` is carried separately.
 */
export type EngagementEventProps = {
  dashboard_visit: Record<string, never>;
  calendar_post_viewed: { post_id?: string };
  calendar_post_approved: { post_id?: string };
  calendar_post_dismissed: { post_id?: string };
  digest_email_opened: { digest_id?: string };
  advisor_brief_viewed: { week_start?: string };
  review_response_started: { review_id?: string };
  review_response_published: { review_id?: string };
  authority_hub_viewed: Record<string, never>;
  settings_changed: { setting?: string };
};

const SESSION_ID_KEY = 'synthex_engagement_session_id';
const DASHBOARD_VISIT_PREFIX = 'synthex_dv_';
const DASHBOARD_VISIT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Returns the stable per-browser-session UUID, creating one on first use.
 * Stored in sessionStorage so it survives navigations but not a new tab session.
 * Falls back to an ephemeral UUID if storage is unavailable (private mode).
 */
export function getEngagementSessionId(): string {
  const uuid = (): string =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : '00000000-0000-4000-8000-000000000000';

  if (typeof window === 'undefined') return uuid();

  try {
    const existing = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;
    const fresh = uuid();
    window.sessionStorage.setItem(SESSION_ID_KEY, fresh);
    return fresh;
  } catch {
    return uuid();
  }
}

/**
 * Returns true if a `dashboard_visit` for `pagePath` may fire now (i.e. none has
 * fired within the last 30 minutes this session), and records the fire time.
 * Returns true (no debounce) if storage is unavailable.
 */
export function shouldFireDashboardVisit(pagePath: string): boolean {
  if (typeof window === 'undefined') return false;

  const key = `${DASHBOARD_VISIT_PREFIX}${pagePath}`;
  try {
    const raw = window.sessionStorage.getItem(key);
    const now = Date.now();
    if (raw) {
      const last = Number(raw);
      if (Number.isFinite(last) && now - last < DASHBOARD_VISIT_WINDOW_MS) {
        return false;
      }
    }
    window.sessionStorage.setItem(key, String(now));
    return true;
  } catch {
    return true;
  }
}

/**
 * Test-only: clears session id + all dashboard_visit debounce markers.
 * @internal
 */
export function _resetEngagementTelemetryForTests(): void {
  if (typeof window === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k && (k === SESSION_ID_KEY || k.startsWith(DASHBOARD_VISIT_PREFIX))) {
        keys.push(k);
      }
    }
    keys.forEach(k => window.sessionStorage.removeItem(k));
  } catch {
    /* no-op */
  }
}

/**
 * Fires an engagement event to GA4 (client-side gtag) and dual-writes it to the
 * `client_engagement_events` table via the authenticated API route. Safe to call
 * fire-and-forget; never throws.
 *
 * @param name     one of the 10 SYN-612 event types
 * @param options  optional page_path override + typed, PII-free event data
 */
export function fireEngagementEvent<T extends EngagementEventName>(
  name: T,
  options?: {
    pagePath?: string;
    data?: EngagementEventProps[T];
  }
): void {
  if (typeof window === 'undefined') return;

  const pagePath = options?.pagePath ?? window.location.pathname;

  // dashboard_visit is debounced to 1 / 30-min window / page / session.
  if (name === 'dashboard_visit' && !shouldFireDashboardVisit(pagePath)) {
    return;
  }

  const sessionId = getEngagementSessionId();
  const eventData = (options?.data ?? {}) as Record<string, unknown>;

  // 1. Client-side GA4 (real-time + attribution).
  const win = window as GTagWindow;
  const gaParams = { session_id: sessionId, page_path: pagePath, ...eventData };
  if (typeof win.gtag === 'function') {
    win.gtag('event', name, gaParams);
  } else {
    win.dataLayer = win.dataLayer ?? [];
    win.dataLayer.push({ event: name, ...gaParams });
  }

  // 2. Server-side dual-write (Supabase table -> Health Score + GA4 MP).
  void fetch('/api/analytics/engagement-event', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventType: name,
      eventData,
      pagePath,
      sessionId,
    }),
    keepalive: true,
  }).catch(() => {
    /* telemetry is best-effort; never disrupt the user flow */
  });
}
