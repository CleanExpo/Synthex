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

// ---------------------------------------------------------------------------
// Mission Control witness events (SPM G3, DECISIONS A-25 / AM-6)
// ---------------------------------------------------------------------------

/** The steps of a marketing job Mission Control shows. */
export type WitnessStep = 'planned' | 'drafted' | 'held' | 'approved';

export interface WitnessEventInput {
  step: WitnessStep;
  /** Stable id of the job or draft the step happened to. */
  id: string;
  /** What `id` names, so Mission Control can tell a campaign from a draft. */
  kind: 'campaign' | 'studio_draft' | 'post';
  /** Null for a personal (no-organisation) campaign. */
  organizationId: string | null;
  /** Only when the work came from Mission Control. Never invented. */
  missionId?: string;
}

/**
 * Emit `synthex.<step>` for a step that has already succeeded. Fire-and-forget:
 * never throws and never rejects, so it cannot fail or block the user's action.
 * A failed delivery is recorded as the last delivery outcome (see
 * GET /api/unite-group/status), not swallowed.
 */
export function emitWitnessEvent(input: WitnessEventInput): void {
  void deliverWitness({
    type: `synthex.${input.step}`,
    id: input.id,
    kind: input.kind,
    organizationId: input.organizationId,
    ...(input.missionId ? { missionId: input.missionId } : {}),
  });
}

/** Push that never rejects; a failure is recorded as the last delivery. */
function deliverWitness(event: UniteGroupEventInput): Promise<void> {
  return pushUniteGroupEvent(event).catch(err => {
    lastDelivery = {
      ok: false,
      eventType: event.type,
      error: err instanceof Error ? err.message : String(err),
      at: new Date().toISOString(),
    };
  });
}

// ---------------------------------------------------------------------------
// Post lifecycle events for the Mission Control calendar (DECISIONS FD-11)
// ---------------------------------------------------------------------------

/** The states of one post Mission Control's /founder/calendar shows. */
export type PostLifecycleStep =
  | 'drafted'
  | 'awaiting_approval'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'failed';

/** The most post text an event carries. */
export const POST_EVENT_TEXT_MAX = 5000;
const POST_EVENT_ERROR_MAX = 300;

export interface PostLifecycleEventInput {
  step: PostLifecycleStep;
  /** The Post id, or the Studio draft id before approval creates Posts. */
  postId: string;
  /** Only when Mission Control started the work. Never invented. */
  missionId?: string;
  platform: string | null;
  /** Organisation or client name/slug the post is for. */
  business: string | null;
  scheduledAt: Date | string | null;
  publishedAt: Date | string | null;
  text: string;
  mediaThumbnailUrls: string[];
  /** The live platform URL once published. */
  postUrl: string | null;
  /** Absolute link to the Synthex screen where this post is approved. */
  approveUrl: string;
  /** post.failed only: why, short and scrubbed. */
  error?: string;
  /** A Post scheduled from a Studio draft names that draft. */
  studioDraftId?: string;
}

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social').replace(
    /\/+$/,
    ''
  );
}

/** Calendar review screen for a Post (no per-post page; `post` names it). */
export function postApproveUrl(postId: string): string {
  return `${appBaseUrl()}/dashboard/calendar?post=${encodeURIComponent(postId)}`;
}

/** Studio approval board for a client (no per-draft page; `draft` names it). */
export function studioDraftApproveUrl(
  clientSlug: string,
  draftId: string
): string {
  return `${appBaseUrl()}/dashboard/marketing-agency/${encodeURIComponent(
    clientSlug
  )}/studio?draft=${encodeURIComponent(draftId)}`;
}

function toIsoOrNull(value: Date | string | null): string | null {
  if (value === null) return null;
  return typeof value === 'string' ? value : value.toISOString();
}

function truncateText(text: string): string {
  if (text.length <= POST_EVENT_TEXT_MAX) return text;
  const cut = text.slice(0, POST_EVENT_TEXT_MAX);
  // Never end on half of a surrogate pair.
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
}

/** Short failure reason with anything token-shaped removed. */
function scrubError(error: string): string {
  return error
    .replace(/bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(
      /\b(access_token|refresh_token|token|api_key|apikey|key|secret|password)=[^&\s]+/gi,
      '$1=[redacted]'
    )
    .slice(0, POST_EVENT_ERROR_MAX);
}

/**
 * Emit `post.<step>` for a post state that has already been reached. Resolves
 * once the delivery settles and never rejects, so it cannot fail or block the
 * post action; a cron can await it before its instance freezes. A failed
 * delivery is recorded as the last delivery outcome.
 */
export function emitPostLifecycleEvent(
  input: PostLifecycleEventInput
): Promise<void> {
  return deliverWitness({
    type: `post.${input.step}`,
    postId: input.postId,
    ...(input.missionId ? { missionId: input.missionId } : {}),
    platform: input.platform,
    business: input.business,
    scheduledAt: toIsoOrNull(input.scheduledAt),
    publishedAt: toIsoOrNull(input.publishedAt),
    text: truncateText(input.text),
    mediaThumbnailUrls: input.mediaThumbnailUrls,
    postUrl: input.postUrl,
    approveUrl: input.approveUrl,
    ...(input.step === 'failed'
      ? { error: scrubError(input.error ?? 'unknown') }
      : {}),
    ...(input.studioDraftId ? { studioDraftId: input.studioDraftId } : {}),
  });
}
