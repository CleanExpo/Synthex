/**
 * Unite-Group Connector
 *
 * Fire-and-forget event pusher for the Unite-Group Nexus dashboard.
 *
 * Usage:
 *   void pushUniteGroupEvent({ type: 'user.signup', userId: '...', plan: 'pro', email: '...' });
 *
 * Design decisions:
 * - Never throws — all errors are swallowed and logged only.
 * - No-op when UNITE_GROUP_EVENTS_URL or UNITE_GROUP_EVENTS_API_KEY env vars are absent (safe for local dev).
 * - Always call with `void` — never await in hot paths.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - UNITE_GROUP_EVENTS_URL: Base URL of the Unite-Group API (e.g. https://unite-group.unite-group.com.au)
 * - UNITE_GROUP_EVENTS_API_KEY: API key for Unite-Group authentication
 */

const UNITE_GROUP_URL = process.env.UNITE_GROUP_EVENTS_URL;
const UNITE_GROUP_KEY = process.env.UNITE_GROUP_EVENTS_API_KEY;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UniteGroupEvent =
  | { type: 'user.signup'; userId: string; plan: string; email: string }
  | { type: 'user.upgrade'; userId: string; fromPlan: string; toPlan: string }
  | { type: 'user.churn'; userId: string; plan: string }
  | {
      type: 'payment.received';
      userId: string;
      amount: number;
      currency: string;
    }
  | {
      type: 'content.published';
      userId: string;
      platform: string;
      postId: string;
    }
  | { type: 'campaign.started'; userId: string; campaignId: string }
  | { type: 'campaign.completed'; userId: string; campaignId: string }
  | {
      type: 'revenue.daily';
      mrr: number;
      customers: number;
      newCustomers: number;
      churned: number;
      byTier: Record<string, number>;
    }
  | { type: string; [key: string]: unknown };

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Push an event to Unite-Group. Fire-and-forget — never throws.
 *
 * @param event - The event payload to send.
 */
export async function pushUniteGroupEvent(
  event: UniteGroupEvent
): Promise<void> {
  if (!UNITE_GROUP_URL || !UNITE_GROUP_KEY) {
    // No-op in local dev when env vars are absent
    return;
  }

  try {
    await fetch(`${UNITE_GROUP_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': UNITE_GROUP_KEY,
      },
      body: JSON.stringify({
        ...event,
        source: 'synthex',
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // fire-and-forget: never throw, only log
    console.error('[unite-group] Failed to push event:', event.type);
  }
}
