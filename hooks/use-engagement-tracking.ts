/**
 * useEngagementTracking — SYN-612
 *
 * Client-side hook for dual-writing engagement events to Supabase + GA4
 * via POST /api/analytics/engagement-event.
 *
 * Usage:
 *   const { trackEvent, trackDashboardVisit } = useEngagementTracking();
 *
 *   // Auto-fire on mount:
 *   useEffect(() => { trackDashboardVisit(); }, [trackDashboardVisit]);
 *
 *   // Manual:
 *   trackEvent('calendar_post_approved', { postId: 'abc' });
 *
 * Deduplication: dashboard_visit events fire at most once per 30-minute
 * window per page, enforced via sessionStorage.
 */

'use client';

import { useCallback, useRef } from 'react';

type EventType =
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

const DEBOUNCE_MS = 30 * 60 * 1000; // 30 minutes

/** Returns or creates a stable random session UUID for this browser session */
function getSessionId(): string {
  const key = 'synthex_session_id';
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem(key, id);
  return id;
}

export function useEngagementTracking() {
  // Track last dashboard_visit per pagePath to enforce 30-min dedup
  const lastVisitRef = useRef<Record<string, number>>({});

  const trackEvent = useCallback(
    (eventType: EventType, eventData?: Record<string, unknown>, pagePath?: string) => {
      // Fire and forget — never block user interactions
      const path = pagePath ?? (typeof window !== 'undefined' ? window.location.pathname : undefined);

      Promise.resolve().then(async () => {
        const sessionId = getSessionId();
        try {
          await fetch('/api/analytics/engagement-event', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventType, eventData, pagePath: path, sessionId }),
          });
        } catch {
          // Silently fail — telemetry must never break the app
        }
      });
    },
    []
  );

  /**
   * Track a dashboard page visit, debounced to once per 30 minutes per page.
   * Call this in a useEffect on mount for each dashboard page.
   */
  const trackDashboardVisit = useCallback(
    (pagePath?: string) => {
      const path = pagePath ?? (typeof window !== 'undefined' ? window.location.pathname : '/dashboard');
      const now = Date.now();
      const last = lastVisitRef.current[path] ?? 0;

      if (now - last >= DEBOUNCE_MS) {
        lastVisitRef.current[path] = now;
        trackEvent('dashboard_visit', {}, path);
      }
    },
    [trackEvent]
  );

  return { trackEvent, trackDashboardVisit };
}
