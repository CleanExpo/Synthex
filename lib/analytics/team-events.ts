/**
 * Team invite analytics events — SYN-597
 *
 * GA4 events for the contextual team invite flow.
 * invitee_email is SHA-256 hashed — no PII in raw form.
 *
 * @module lib/analytics/team-events
 */

type GTagWindow = Window & {
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
};

export type TeamEventName =
  | 'team_invite_prompt_shown'
  | 'team_invite_prompt_clicked'
  | 'team_invite_sent'
  | 'team_invite_accepted'
  | 'team_viewer_first_login'
  | 'team_viewer_weekly_active';

type TeamEventProps = {
  team_invite_prompt_shown: Record<string, never>;
  team_invite_prompt_clicked: Record<string, never>;
  team_invite_sent: {
    /** SHA-256 hash of invitee email — no raw PII */
    invitee_email_hash: string;
  };
  team_invite_accepted: Record<string, never>;
  team_viewer_first_login: Record<string, never>;
  /** Fired once per 7-day window per collaborator — deduplication managed server-side */
  team_viewer_weekly_active: Record<string, never>;
};

/**
 * Hashes an email address using SHA-256 via SubtleCrypto.
 * Returns hex string. No-ops if SubtleCrypto is unavailable.
 */
export async function hashEmail(email: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return '';
  const encoded = new TextEncoder().encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function fireTeamEvent<T extends TeamEventName>(
  name: T,
  ...args: TeamEventProps[T] extends Record<string, never>
    ? []
    : [params: TeamEventProps[T]]
): void {
  if (typeof window === 'undefined') return;

  const params = args[0] ?? {};
  const win = window as GTagWindow;
  if (typeof win.gtag === 'function') {
    win.gtag('event', name, params);
  } else {
    win.dataLayer = win.dataLayer ?? [];
    win.dataLayer.push({ event: name, ...params });
  }
}
