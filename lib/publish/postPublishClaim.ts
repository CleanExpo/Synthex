/**
 * postPublishClaim — lib/publish/postPublishClaim.ts
 *
 * Atomic publish-claim for scheduled Posts (the `Post` + cron publisher path
 * in `app/api/cron/publish-scheduled/route.ts`).
 *
 * THE BUG THIS CLOSES (the "double-post window"):
 * The publisher previously protected against double-publishing with a
 * read-then-act guard: it `findMany`'d due posts, then for each post
 * `findUnique`'d it again and skipped if already published, THEN called the
 * platform API. That is a classic time-of-check / time-of-use (TOCTOU) race.
 * Two overlapping cron runs (Vercel can fire a retry while the previous run is
 * still draining its 50-post batch, or two instances run concurrently) both
 * read `status='scheduled'`, both pass the guard, and both call
 * `service.createPost(...)` — the real post goes out to the platform TWICE.
 *
 * THE FIX:
 * Before touching the platform, ATOMICALLY claim the post with a single
 * conditional `updateMany`:
 *
 *   updateMany({
 *     where: { id, status: 'scheduled', publishedAt: null, deletedAt: null },
 *     data:  { status: 'publishing', ...claim marker... }
 *   })
 *
 * The database guarantees exactly one writer flips a given row from
 * `'scheduled'` to `'publishing'`. The winner sees `count === 1` and proceeds
 * to publish; every other concurrent worker sees `count === 0` and skips. This
 * is a real DB-atomic claim — not an in-memory lock — so it holds across
 * separate serverless instances.
 *
 * NO SCHEMA CHANGE: `Post.status` is a free-string column, so `'publishing'`
 * is added as a transient status value with no migration. The claim timestamp
 * is recorded in the existing `metadata` JSON (`publishClaimedAt`) rather than
 * a new `claimedAt` column, so this ships without a Prisma migration.
 *
 * RELEASE-ON-FAILURE / CRASH RECOVERY:
 * A claimed post sits in `'publishing'`. Every outcome moves it OUT of that
 * state: success → `'published'`, permanent failure → `'failed'`, transient
 * failure → back to `'scheduled'` (released for the normal retry/backoff), gate
 * block → `'pending_approval'`. If a worker crashes AFTER claiming but BEFORE
 * resolving, the row would be stuck in `'publishing'` forever — so
 * `reclaimStalePublishingPosts` releases any post left in `'publishing'` past
 * `STALE_CLAIM_MS` back to `'scheduled'` at the start of each run.
 *
 * @task SYN-P1 (atomic publish-claim — eliminate the double-post window)
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/** Transient status a post holds while a worker is publishing it. */
export const PUBLISHING_STATUS = 'publishing';

/**
 * How long a post may sit in `'publishing'` before it is treated as abandoned
 * (the claiming worker crashed/timed out) and released back to `'scheduled'`.
 *
 * Must comfortably exceed the publisher's `maxDuration` (300s) so we never
 * yank a claim out from under a worker that is simply still running.
 */
export const STALE_CLAIM_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Merge a value into a Post's metadata JSON without clobbering existing keys.
 * `metadata` from Prisma is `JsonValue | null`; only treat plain objects as a
 * base, everything else starts from `{}`.
 */
// Return type is `any` so the merged object satisfies Prisma's InputJsonValue
// without further casting — same convention as `jsonSafe` in the cron route.
function mergeMetadata(existing: unknown, patch: Record<string, unknown>): any {
  const base =
    existing !== null &&
    typeof existing === 'object' &&
    !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return JSON.parse(JSON.stringify({ ...base, ...patch }));
}

/**
 * Atomically claim a single due post for publishing.
 *
 * Returns `true` iff THIS worker won the claim (exactly one row transitioned
 * from `'scheduled'` to `'publishing'`). A concurrent worker that lost the race
 * gets `false` and must skip the post — it must NOT publish.
 *
 * The `where` clause re-asserts every precondition (`status: 'scheduled'`,
 * `publishedAt: null`, `deletedAt: null`) so the claim is correct even if the
 * post changed between the batch `findMany` and this call.
 */
export async function claimPostForPublish(postId: string): Promise<boolean> {
  const claimedAt = new Date();
  const claimedAtIso = claimedAt.toISOString();

  // Read current metadata so we can merge the claim marker rather than
  // overwrite it. The actual claim is the atomic updateMany below — this read
  // does not widen the race window because the updateMany re-checks `status`.
  const current = await prisma.post.findUnique({
    where: { id: postId },
    select: { metadata: true },
  });

  const result = await prisma.post.updateMany({
    where: {
      id: postId,
      status: 'scheduled',
      publishedAt: null,
      deletedAt: null,
    },
    data: {
      status: PUBLISHING_STATUS,
      metadata: mergeMetadata(current?.metadata, {
        publishClaimedAt: claimedAtIso,
      }),
    },
  });

  const won = result.count === 1;
  if (!won) {
    logger.warn('[publish-claim] Lost claim race (already claimed/published)', {
      postId,
    });
  }
  return won;
}

/**
 * Release a claimed post back to `'scheduled'` so it is retried on a later run.
 *
 * Conditional on `status: 'publishing'` so we only ever release a row WE hold —
 * if the post already moved on (e.g. another path marked it published/failed)
 * this is a no-op. Optionally merges metadata (e.g. retry bookkeeping) at the
 * same time, and may override `scheduledAt` for backoff.
 */
export async function releasePostClaim(
  postId: string,
  opts: {
    metadata?: Record<string, unknown>;
    existingMetadata?: unknown;
    scheduledAt?: Date;
  } = {}
): Promise<void> {
  await prisma.post.updateMany({
    where: { id: postId, status: PUBLISHING_STATUS },
    data: {
      status: 'scheduled',
      ...(opts.scheduledAt ? { scheduledAt: opts.scheduledAt } : {}),
      ...(opts.metadata
        ? { metadata: mergeMetadata(opts.existingMetadata, opts.metadata) }
        : {}),
    },
  });
}

/**
 * Release any post abandoned in `'publishing'` (claiming worker crashed/timed
 * out before resolving) back to `'scheduled'` so it becomes due again.
 *
 * Returns the number of posts reclaimed. Run at the start of each cron pass.
 */
export async function reclaimStalePublishingPosts(
  now: Date = new Date()
): Promise<number> {
  const cutoff = new Date(now.getTime() - STALE_CLAIM_MS);

  // `updatedAt` is bumped by Prisma's @updatedAt on the claim write, so a post
  // whose `updatedAt` is older than the cutoff has been stuck in 'publishing'
  // for longer than STALE_CLAIM_MS — its worker is gone.
  const result = await prisma.post.updateMany({
    where: {
      status: PUBLISHING_STATUS,
      updatedAt: { lt: cutoff },
      deletedAt: null,
    },
    data: {
      status: 'scheduled',
    },
  });

  if (result.count > 0) {
    logger.warn('[publish-claim] Reclaimed stale publishing posts', {
      count: result.count,
      cutoff: cutoff.toISOString(),
    });
  }
  return result.count;
}

/**
 * Recorded on a queue item whose worker died mid-publish. Says what is known
 * (nothing about the platform call) and what a person must do before retrying.
 */
export const UNKNOWN_OUTCOME_ERROR =
  'Publish outcome unknown: the worker stopped while publishing (crash/timeout), ' +
  'so the post may already be live. Check the platform before retrying; it will not be retried automatically.';

/**
 * Move any PublishQueueItem abandoned in `'publishing'` to a terminal,
 * honest state: `'failed'` with `nextRetryAt = null` and `UNKNOWN_OUTCOME_ERROR`.
 *
 * WHY NOT RETRY IT (J8 at-most-once, JEV gap
 * J8-GAP-reclaim-redispatch-after-worker-death):
 * `processPublishQueue` marks an item `'publishing'` BEFORE dispatching to the
 * platform adapter and writes `'published'` only AFTER the adapter returns. A
 * worker that dies in between (function timeout, killed instance, failed
 * final write) leaves the row in `'publishing'` with no record of whether the
 * platform call already succeeded. Re-dispatching it could post the same
 * content twice, so a stale row is never made due again. It is surfaced
 * instead: the queue's due-fetch selects only `failed` rows with
 * `nextRetryAt <= now`, and `claimQueueItemForPublish` refuses a `failed` row
 * without a due `nextRetryAt`, so nothing re-sends it until a person has
 * checked the platform. Rows that failed BEFORE dispatch (the adapter returned
 * an error) are written by `processPublishQueue` with a future `nextRetryAt`
 * and keep their normal retry.
 *
 * Conditional on `status: 'publishing'` AND `updatedAt < cutoff` so a row a
 * worker is still actively publishing (its `updatedAt` was just bumped by the
 * claim write) is never touched — the cutoff (STALE_CLAIM_MS, 15 min)
 * comfortably exceeds the publisher's 300s maxDuration. `attempts` is not
 * incremented: the attempt's outcome is unknown.
 *
 * Returns the number of items moved. Run at the start of each queue pass.
 */
export async function reclaimStalePublishingQueueItems(
  now: Date = new Date()
): Promise<number> {
  const cutoff = new Date(now.getTime() - STALE_CLAIM_MS);

  const result = await prisma.publishQueueItem.updateMany({
    where: {
      status: PUBLISHING_STATUS,
      updatedAt: { lt: cutoff },
    },
    data: {
      status: 'failed',
      nextRetryAt: null,
      lastError: UNKNOWN_OUTCOME_ERROR,
    },
  });

  if (result.count > 0) {
    logger.warn(
      '[publish-claim] Stale publishing queue items need a manual platform check',
      {
        count: result.count,
        cutoff: cutoff.toISOString(),
      }
    );
  }
  return result.count;
}

/**
 * Atomically claim a single due PublishQueueItem for publishing.
 *
 * THE BUG THIS CLOSES (the queue-side "double-post window"):
 * `processPublishQueue` selects due items with a batch `findMany`, then marked
 * each one `'publishing'` with an UNCONDITIONAL `update({ status: 'publishing' })`
 * before dispatching to the platform adapter. An unconditional `update` always
 * succeeds regardless of the row's current status, so it provides NO mutual
 * exclusion. Two overlapping queue passes (the Supabase Edge Function fires
 * every 15 min; a run that overruns its 300s maxDuration, a retry, or a second
 * instance) both `findMany` the same `pending`/`failed-due` rows, both pass the
 * safety gates, both `update` to `'publishing'`, and both call
 * `dispatchToPlatform` — the real post goes out to the client's social account
 * TWICE. This is the same TOCTOU race the `Post` cron path already eliminated
 * with `claimPostForPublish`; this is its `PublishQueueItem` analogue.
 *
 * THE FIX:
 * Claim with a single conditional `updateMany` whose `where` re-asserts the
 * due-state (`status` is still `'pending'` or `'failed'`). The database
 * guarantees exactly one writer transitions a given row into `'publishing'`:
 * the winner sees `count === 1` and publishes; every concurrent loser sees
 * `count === 0` and must skip WITHOUT publishing.
 *
 * Returns `true` iff THIS worker won the claim. A loser MUST NOT publish.
 */
export async function claimQueueItemForPublish(
  itemId: string
): Promise<boolean> {
  const result = await prisma.publishQueueItem.updateMany({
    where: {
      id: itemId,
      // Only a row still in a due state can be claimed. A row another worker
      // already flipped to 'publishing' (or that reached a terminal state) is
      // excluded, so the loser's updateMany matches nothing. A 'failed' row is
      // due only once its retry time has come; one with no retry time (outcome
      // unknown, see reclaimStalePublishingQueueItems) is never claimable.
      OR: [
        { status: 'pending' },
        { status: 'failed', nextRetryAt: { lte: new Date() } },
      ],
    },
    data: {
      status: PUBLISHING_STATUS,
    },
  });

  const won = result.count === 1;
  if (!won) {
    logger.warn(
      '[publish-claim] Lost queue-item claim race (already claimed)',
      {
        itemId,
      }
    );
  }
  return won;
}
