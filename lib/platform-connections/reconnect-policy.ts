/**
 * Proactive reconnect policy (SYN-1003) — pure.
 *
 * A connection with no refresh token cannot self-heal: its access token simply
 * dies at `expiresAt` (LinkedIn ~60 days) with no warning. Rather than let it
 * fail silently, flag "reconnect required" a few days BEFORE expiry so the
 * operator can re-auth during the window.
 *
 * This deliberately does NOT claim auto-refresh for such platforms — a missing
 * refresh token means refresh is impossible, so the honest action is a proactive
 * reconnect prompt, not a false "will refresh automatically".
 */

/** Flag a no-refresh-token connection this far ahead of its expiry. */
export const PROACTIVE_RECONNECT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface ProactiveReconnectInput {
  /** Token expiry, or null when unknown. */
  expiresAt: Date | null;
  /** Whether a refresh token is stored (non-null). */
  hasRefreshToken: boolean;
}

export interface ProactiveReconnect {
  needsReconnect: boolean;
  reason?: string;
}

/** Pretty platform labels for user-facing reason text; falls back to the raw id. */
const PLATFORM_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  twitter: 'Twitter / X',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  reddit: 'Reddit',
  threads: 'Threads',
};

function labelFor(platform: string): string {
  return (
    PLATFORM_LABELS[platform.toLowerCase()] ??
    platform.charAt(0).toUpperCase() + platform.slice(1)
  );
}

function formatDate(d: Date): string {
  // DD/MM/YYYY (Australian English convention).
  return d.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Australia/Sydney',
  });
}

/**
 * Decide whether a connection needs a proactive reconnect.
 *
 * A connection that can refresh (has a refresh token) is left alone — it
 * self-heals. One that cannot refresh is flagged once its expiry is within
 * {@link PROACTIVE_RECONNECT_WINDOW_MS} (or already past).
 */
export function evaluateProactiveReconnect(
  { expiresAt, hasRefreshToken }: ProactiveReconnectInput,
  platform: string,
  now: Date = new Date(),
): ProactiveReconnect {
  if (hasRefreshToken) return { needsReconnect: false };
  if (!expiresAt) return { needsReconnect: false };

  const msUntilExpiry = expiresAt.getTime() - now.getTime();
  if (msUntilExpiry > PROACTIVE_RECONNECT_WINDOW_MS) {
    return { needsReconnect: false };
  }

  const label = labelFor(platform);
  const expired = msUntilExpiry <= 0;
  const reason = expired
    ? `Your ${label} connection expired on ${formatDate(expiresAt)} and cannot refresh automatically. Reconnect to resume publishing.`
    : `Your ${label} connection expires on ${formatDate(expiresAt)} and cannot refresh automatically. Reconnect now to avoid interruption.`;

  return { needsReconnect: true, reason };
}
