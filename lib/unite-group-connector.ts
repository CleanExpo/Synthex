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
 * - Posts to {UNITE_GROUP_EVENTS_URL}/api/webhooks/synthex and never follows a
 *   redirect: a 3xx (e.g. a login redirect) is a failed delivery, not success.
 * - The last delivery outcome is kept in memory (per server instance, no
 *   table) and reported by GET /api/unite-group/status, so a dropped event is
 *   visible instead of silent.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - UNITE_GROUP_EVENTS_URL: Base URL of the Unite-Group API (e.g. https://unite-group.unite-group.com.au)
 * - UNITE_GROUP_EVENTS_API_KEY: API key for Unite-Group authentication
 */

/** Receiver path on Unite-Group for Synthex events. */
export const UNITE_GROUP_EVENTS_PATH = '/api/webhooks/synthex';

export interface UniteGroupDeliveryOutcome {
  ok: boolean;
  eventType: string;
  /** HTTP status, when a response arrived. */
  statusCode?: number;
  /** Network error message, when no response arrived. */
  error?: string;
  at: string;
}

let lastDelivery: UniteGroupDeliveryOutcome | null = null;

/** The most recent delivery attempt on this server instance, or null. */
export function getLastUniteGroupDelivery(): UniteGroupDeliveryOutcome | null {
  return lastDelivery;
}

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
      orgSlug?: string;
    }
  | {
      type: 'campaign.started';
      userId: string;
      campaignId: string;
      orgSlug?: string;
    }
  | {
      type: 'campaign.completed';
      userId: string;
      campaignId: string;
      orgSlug?: string;
    }
  | {
      type: 'content.outcomes';
      orgSlug: string;
      isoWeek: string;
      postsPublished: number;
      byPlatform: Record<
        string,
        {
          posts: number;
          likes: number;
          comments: number;
          shares: number;
          impressions: number;
        }
      >;
    }
  | {
      type: 'revenue.daily';
      mrr: number;
      customers: number;
      newCustomers: number;
      churned: number;
      byTier: Record<string, number>;
    }
  | { type: string; [key: string]: unknown };

/**
 * Set missionId only when the work came from Mission Control; it is sent as-is
 * and omitted otherwise.
 */
export type UniteGroupEventInput = UniteGroupEvent & { missionId?: string };

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Push an event to Unite-Group. Fire-and-forget — never throws.
 *
 * @param event - The event payload to send.
 */
export async function pushUniteGroupEvent(
  event: UniteGroupEventInput
): Promise<void> {
  const url = process.env.UNITE_GROUP_EVENTS_URL;
  const key = process.env.UNITE_GROUP_EVENTS_API_KEY;
  if (!url || !key) {
    // No-op in local dev when env vars are absent
    return;
  }

  const { missionId, ...rest } = event;
  try {
    const res = await fetch(`${url}${UNITE_GROUP_EVENTS_PATH}`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
      },
      body: JSON.stringify({
        ...rest,
        ...(missionId ? { missionId } : {}),
        source: 'synthex',
        timestamp: new Date().toISOString(),
      }),
    });
    const ok = res.status >= 200 && res.status < 300;
    lastDelivery = {
      ok,
      eventType: event.type,
      statusCode: res.status,
      at: new Date().toISOString(),
    };
    if (!ok) {
      console.error(
        '[unite-group] Event not accepted:',
        event.type,
        res.status
      );
    }
  } catch (err) {
    lastDelivery = {
      ok: false,
      eventType: event.type,
      error: err instanceof Error ? err.message : String(err),
      at: new Date().toISOString(),
    };
    // fire-and-forget: never throw, only log
    console.error('[unite-group] Failed to push event:', event.type);
  }
}
