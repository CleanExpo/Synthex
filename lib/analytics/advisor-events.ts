/**
 * Advisor analytics events — SYN-594
 *
 * Fires GA4 events for the AI Marketing Advisor feature.
 * NO PII in any event payload.
 *
 * @module lib/analytics/advisor-events
 */

type GTagWindow = Window & {
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
};

export type AdvisorEventName =
  | 'advisor_opened_dashboard'
  | 'advisor_email_clicked'
  | 'advisor_action_completed'
  | 'advisor_feedback_submitted';

type AdvisorEventProps = {
  advisor_opened_dashboard: {
    week_start: string;
  };
  advisor_email_clicked: {
    week_start: string;
  };
  advisor_action_completed: {
    week_start: string;
    action_rank: number;
    action_title: string;
  };
  advisor_feedback_submitted: {
    week_start: string;
    response: 'useful' | 'not_useful' | 'skipped';
  };
};

export function fireAdvisorEvent<T extends AdvisorEventName>(
  name: T,
  params: AdvisorEventProps[T]
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
