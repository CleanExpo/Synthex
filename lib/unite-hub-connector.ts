/**
 * Unite-Hub Connector
 *
 * Fire-and-forget event pusher for the Unite-Group Nexus dashboard.
 *
 * Usage:
 *   void pushUniteHubEvent({ type: 'user.signup', userId: '...', plan: 'pro', email: '...' });
 *
 * Design decisions:
 * - Never throws — all errors are swallowed and logged only.
 * - No-op when UNITE_HUB_API_URL or UNITE_HUB_API_KEY env vars are absent (safe for local dev).
 * - Always call with `void` — never await in hot paths.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - UNITE_HUB_API_URL: Base URL of the Unite-Hub API (e.g. https://unite-hub.unite-group.com.au)
 * - UNITE_HUB_API_KEY: API key for Unite-Hub authentication
 */

const UNITE_HUB_URL = process.env.UNITE_HUB_API_URL;
const UNITE_HUB_KEY = process.env.UNITE_HUB_API_KEY;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UniteHubEvent =
  | { type: 'user.signup'; userId: string; plan: string; email: string }
  | { type: 'user.upgrade'; userId: string; fromPlan: string; toPlan: string }
  | { type: 'user.churn'; userId: string; plan: string }
  | { type: 'payment.received'; userId: string; amount: number; currency: string }
  | { type: 'content.published'; userId: string; platform: string; postId: string }
  | { type: 'campaign.started'; userId: string; campaignId: string }
  | { type: 'campaign.completed'; userId: string; campaignId: string }
  | { type: 'revenue.daily'; mrr: number; customers: number; newCustomers: number; churned: number; byTier: Record<string, number> }
  | { type: string; [key: string]: unknown };

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Push an event to Unite-Hub. Fire-and-forget — never throws.
 *
 * @param event - The event payload to send.
 */
export async function pushUniteHubEvent(event: UniteHubEvent): Promise<void> {
  if (!UNITE_HUB_URL || !UNITE_HUB_KEY) {
    // No-op in local dev when env vars are absent
    return;
  }

  try {
    await fetch(`${UNITE_HUB_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': UNITE_HUB_KEY,
      },
      body: JSON.stringify({
        ...event,
        source: 'synthex',
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // fire-and-forget: never throw, only log
    console.error('[unite-hub] Failed to push event:', event.type);
  }
}
