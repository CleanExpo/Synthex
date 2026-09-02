/**
 * Approve → schedule bridge (SYN-1005 Studio; vault contract g2).
 *
 * Before this, approving a Studio draft flipped its status and stopped: nothing
 * wrote a Post, nothing set publishedAt, and "approved" meant "will never
 * publish". Approval now creates one scheduled Post per schedulable platform
 * through the ONE working scheduler (lib/social/schedule-via-post.ts → Post
 * table → /api/cron/publish-scheduled), scoped to the DRAFT's organisation so a
 * multi-business owner's active org can never capture another business's post.
 *
 * The campaign pack's own publish rule — "do not publish externally until
 * credentials, approval, and rights checks are recorded" — is deny-by-default
 * (review round 1). A draft carrying `externalPublishingAllowed: false` publishes
 * to a platform only when every blocker the pack lists for it in
 * `externalPublishBlocks` is discharged:
 *
 *   human_or_client_approval_required  → this call (recorded with who/when)
 *   platform_credentials_required      → an ACTIVE platform connection for the
 *                                        business under the approver — the same
 *                                        row the cron publishes with; never a
 *                                        recorded clearance (round 2)
 *   anything else                      → a recorded clearance in
 *                                        `externalPublishClearances`, written
 *                                        when the approver names it explicitly
 *
 * Decisions the engineering bench forced into the open (engineering.md beside
 * the spec):
 *
 *   - ALL OR NOTHING. An approval commits only when EVERY cron-eligible platform
 *     got a Post (created or reused). One blocked platform rolls the whole
 *     attempt back and the draft stays `awaiting_approval`, so a retry is always
 *     the full set and no platform is ever stranded behind a committed claim.
 *     A draft with no eligible platform at all (owned media only) commits as
 *     `approved` with nothing scheduled — and nothing cleared.
 *   - `externalPublishingAllowed` flips to true ONLY on a commit where an
 *     eligible platform was scheduled. It is a positive fact, never the absence
 *     of a reason string, so a channel the Studio cannot schedule (blog,
 *     newsletter) can never discharge the pack's blockers by being skipped.
 *   - The organisation's publish-safety state applies to Studio posts exactly as
 *     it does to autopilot posts: `calendarMode` must be `live` and auto-publish
 *     must not be paused (lib/publish/safetyChecks.ts). A shadow-mode or paused
 *     org gets `blocked` here, and the cron enforces the same gate at publish
 *     time for a flag flipped after the approval.
 *   - The funnel link travels in the post TEXT unless the platform renders
 *     `linkUrl` as a card (LinkedIn, Facebook, Reddit, Pinterest) and the post
 *     has no media. A recorded link the adapter would drop is never claimed.
 *   - A rolled-back attempt persists NOTHING but its own record
 *     (`metadata.studioScheduleAttempt`), merged at the database into the keys
 *     it owns. Clearances the approver named are recorded only when the
 *     approval commits; a retry names them again.
 *
 * The claim and the schedule are ONE database transaction (review round 5).
 * Rounds 1 to 5 each found a new path by which a claim that had already
 * committed (`awaiting_approval → approved`) could be left with no Post: the
 * draft read, the blocker checks, the idempotency lookup, the schedule call,
 * and finally the compensating hand-back write itself. A compensating write
 * is a second best-effort write and cannot carry the invariant "every
 * post-claim failure hands the draft back". So the claim, the draft read, the
 * lookups, the Post creation and the final record all run inside
 * `prisma.$transaction(async tx => …)`, with a server-side statement timeout
 * set first so the budget is enforced by Postgres, not by a client timer:
 *
 *   - blocked, or not every eligible platform scheduled → the transaction is
 *     rolled back on purpose (a private signal is thrown) and the attempt is
 *     recorded afterwards, best effort, outside the transaction. Losing that
 *     record changes nothing: the draft is `awaiting_approval` because the
 *     claim never persisted, not because something wrote it back;
 *   - any thrown failure → rolled back; the error propagates and the route
 *     answers 500 with the draft untouched;
 *   - all-or-nothing on errors: Postgres aborts a transaction at its first
 *     failed statement, so a failure on one platform cannot be swallowed and
 *     the loop continued. Every Post created before it rolls back with the
 *     claim and is reported as `rolled_back`.
 *
 * Concurrency: two approvals of one draft. Under READ COMMITTED the second
 * claim's `UPDATE … WHERE status = 'awaiting_approval'` waits on the row lock
 * held by the first, then re-evaluates its predicate against the committed
 * row: after a commit it matches nothing (`not_awaiting_approval`); after a
 * rollback it matches and is simply the retry.
 *
 * Idempotency (rounds 2 and 4): before scheduling a platform the bridge looks
 * for a Post already carrying this draft + platform, scoped to the approving
 * organisation, and classifies it by status — `scheduled` / `publishing` /
 * `published` are reused, `failed` is terminal (the cron never retries it) so a
 * fresh Post is scheduled, and anything else holds the draft back rather than
 * risk a duplicate. Every created Post carries `metadata.idempotencyKey`.
 *
 * Every dependency is injectable so this is unit-testable without a database.
 * Nothing inside the transaction talks to anything but the database; the cron
 * publishes later.
 */

import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { trackError } from '@/lib/observability/error-tracker';
import { isPlatformSupported } from '@/lib/social';
import {
  scheduleViaPost,
  type ScheduleViaPostInput,
  type ScheduleViaPostResult,
} from '@/lib/social/schedule-via-post';
import {
  resolveOrgAutoPublishGate,
  type OrgAutoPublishGate,
} from '@/lib/publish/safetyChecks';
import { buildUtmUrl } from '@/lib/utm/build-utm-url';
import { approveStudioDraft } from './draft-store';
import type { ResolvedStudioClient } from './clients';

/** The pack blocker the Studio approval itself discharges. */
export const APPROVAL_BLOCKER = 'human_or_client_approval_required';
/** The pack blocker an active platform connection for the business discharges. */
export const CREDENTIALS_BLOCKER = 'platform_credentials_required';
/**
 * Blocker ids a caller may NOT discharge by naming them (review round 2): the
 * approval is the click itself, and credentials come only from a live
 * platform connection.
 */
export const RESERVED_CLEARANCES: ReadonlySet<string> = new Set([
  APPROVAL_BLOCKER,
  CREDENTIALS_BLOCKER,
]);

/**
 * An existing Post in one of these statuses satisfies the schedule attempt: it
 * is on its way (the cron drains `scheduled`, claims `publishing`) or done.
 */
export const REUSABLE_POST_STATUSES: ReadonlySet<string> = new Set([
  'scheduled',
  'publishing',
  'published',
]);
/**
 * A Post in one of these statuses is terminal — the cron only fetches
 * `scheduled`, so it will never publish. A fresh Post is scheduled instead.
 */
export const TERMINAL_POST_STATUSES: ReadonlySet<string> = new Set(['failed']);

/**
 * Platforms whose adapter renders `content.linkUrl` as a link card
 * (lib/social/{linkedin,facebook,reddit,pinterest}-service.ts read it; the
 * other adapters ignore the field). Everywhere else the link goes in the text.
 */
export const LINK_CARD_PLATFORMS: ReadonlySet<string> = new Set([
  'linkedin',
  'facebook',
  'reddit',
  'pinterest',
]);

/**
 * The interactive transaction's bounds: wait up to 2 s for a pooled connection
 * (the pool holds three), then the handful of queries inside has 15 s in total
 * and each statement 5 s on the server (`APPROVAL_STATEMENT_TIMEOUT_MS`, set
 * with `SET LOCAL` as the transaction's first statement, so Postgres can
 * interrupt a runaway query — the client timer cannot). No external call runs
 * inside it.
 */
export const APPROVAL_TRANSACTION_OPTIONS = {
  maxWait: 2000,
  timeout: 15000,
} as const;
export const APPROVAL_STATEMENT_TIMEOUT_MS = 5000;

export class InvalidClearanceError extends Error {
  readonly blockers: string[];
  constructor(blockers: string[]) {
    super(
      `These blockers cannot be discharged by naming them: ${blockers.join(', ')}`
    );
    this.name = 'InvalidClearanceError';
    this.blockers = blockers;
  }
}

export interface ApproveAndScheduleInput {
  organizationId: string;
  id: string;
  approvedBy: string;
  client: Pick<ResolvedStudioClient, 'clientSlug' | 'funnelUrl'>;
  /** When to publish. Defaults to now — the cron's next tick picks it up. */
  scheduledAt?: Date;
  /**
   * Pack blocker ids the approver explicitly discharges with this approval
   * (e.g. `final_asset_rights_check_required`). Recorded on the draft with who
   * and when — only when the approval commits; never implied. The reserved
   * ids are refused.
   */
  clearances?: string[];
}

export interface ExistingStudioPost {
  id: string;
  platform: string;
  scheduledAt: Date | string | null;
  /** The Post's current status; absent means "treat as scheduled". */
  status?: string | null;
}

/** Runs `fn` in one database transaction: a throw rolls back every write `fn` made. */
export type StudioTransactionRunner = <T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
) => Promise<T>;

/** The rolled-back attempt, as recorded on the draft under `studioScheduleAttempt`. */
export interface StudioScheduleAttempt {
  attemptedAt: string;
  attemptedBy: string;
  outcome: 'blocked' | 'schedule_failed';
  /** Blocker ids the approver named on this attempt (not recorded as cleared). */
  clearancesRequested: string[];
  skipped: SkippedStudioPlatform[];
}

export interface ApproveAndScheduleDeps {
  /** Default: `prisma.$transaction(fn, APPROVAL_TRANSACTION_OPTIONS)`. */
  runInTransaction?: StudioTransactionRunner;
  /**
   * Records a rolled-back attempt on the still-awaiting draft, OUTSIDE the
   * transaction, merging ONLY `metadata.studioScheduleAttempt` at the database
   * (`metadata || …`) so a concurrent writer's keys survive. Best effort.
   */
  recordAttempt?: (
    target: { organizationId: string; id: string },
    attempt: StudioScheduleAttempt
  ) => Promise<void>;
  /** Creates the Post through the transaction client it is handed. */
  schedule?: (
    input: ScheduleViaPostInput,
    tx: Prisma.TransactionClient
  ) => Promise<ScheduleViaPostResult>;
  isSchedulable?: (platform: string) => boolean;
  /** Does the business have an ACTIVE connection for this platform under the approver? */
  credentialsReady?: (
    platform: string,
    tx: Prisma.TransactionClient
  ) => Promise<boolean>;
  /**
   * The organisation's publish-safety state (calendar mode + pause flag), read
   * through the transaction. Default: `resolveOrgAutoPublishGate`.
   */
  publishGate?: (
    organizationId: string,
    tx: Prisma.TransactionClient
  ) => Promise<OrgAutoPublishGate>;
  /**
   * The Post already carrying this draft + platform for the approving
   * organisation, if any — the idempotency read before every schedule.
   * Default: the Post table, matched on metadata.studioDraftId + platform,
   * scoped through the campaign's organisation, not soft-deleted, newest first.
   */
  findScheduledStudioPost?: (
    draftId: string,
    platform: string,
    tx: Prisma.TransactionClient
  ) => Promise<ExistingStudioPost | null>;
  now?: () => Date;
}

export interface ScheduledStudioPost {
  platform: string;
  postId: string;
  scheduledAt: string;
  /**
   * The UTM-tagged funnel link this post carries — as a card on a
   * `LINK_CARD_PLATFORMS` platform without media, otherwise in the text — or
   * null when the business has no usable funnel.
   */
  linkUrl: string | null;
  /** Present when an existing Post for this draft + platform was reused. */
  reused?: true;
  /** The reused Post's status (scheduled | publishing | published). */
  status?: string;
}

export interface SkippedStudioPlatform {
  platform: string;
  reason: string;
}

export type ApproveOutcome =
  /** the draft is in `approved`; every eligible platform has a Post, or no platform was cron-eligible */
  | 'approved'
  /** no row matched: missing, wrong org, or not awaiting approval — nothing happened */
  | 'not_awaiting_approval'
  /** at least one eligible platform was blocked; the claim rolled back, the draft is still `awaiting_approval` */
  | 'blocked'
  /** a read, lookup or schedule failed; the claim rolled back, the draft is still `awaiting_approval` */
  | 'schedule_failed';

export interface ApproveAndScheduleResult {
  /** true when the draft now sits in `approved`. */
  approved: boolean;
  outcome: ApproveOutcome;
  scheduled: ScheduledStudioPost[];
  skipped: SkippedStudioPlatform[];
}

type ClearanceRecord = { clearedBy: string; clearedAt: string; via: string };

/**
 * Thrown inside the transaction to roll it back on purpose: the outcome is a
 * hand-back and the claim must not persist. Carries what to return and, when
 * the draft was readable, the attempt to record afterwards.
 */
class RollbackSignal extends Error {
  constructor(
    readonly result: ApproveAndScheduleResult,
    readonly attempt: StudioScheduleAttempt | null
  ) {
    super(`studio approval rolled back: ${result.outcome}`);
    this.name = 'RollbackSignal';
  }
}

/**
 * The funnel link a post carries: the business funnel tagged so the click is
 * attributable back to this draft on this platform. Null when the business has
 * no funnel — a missing link is reported, never invented.
 */
export function buildStudioFunnelLink(
  funnelUrl: string | null,
  tag: {
    platform: string;
    clientSlug: string;
    draftId: string;
    campaign?: string;
  }
): string | null {
  if (!funnelUrl) return null;
  return buildUtmUrl(funnelUrl, {
    source: tag.platform,
    medium: 'social',
    campaign: tag.campaign ?? `studio-${tag.clientSlug}`,
    content: tag.draftId,
  });
}

/** The reason an organisation's publish-safety state blocks a Studio post, or null. */
export function publishGateBlockReason(
  gate: OrgAutoPublishGate
): string | null {
  if (gate.allowed) return null;
  return gate.calendarMode !== 'live'
    ? `org_publish_gate: calendar_mode_${gate.calendarMode}`
    : 'org_publish_gate: auto_publish_paused';
}

function asJsonObject(
  value: Prisma.JsonValue | null | undefined
): Prisma.JsonObject {
  return value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? value
    : {};
}

function asStringArray(
  value: Prisma.JsonValue | null | undefined
): string[] | null {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toIso(value: Date | string | null, fallback: Date): string {
  if (value === null) return fallback.toISOString();
  return typeof value === 'string' ? value : value.toISOString();
}

function defaultRunInTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(fn, APPROVAL_TRANSACTION_OPTIONS);
}

/**
 * Merge the attempt record into the draft's metadata AT THE DATABASE, touching
 * only its own key, on the row that is still awaiting approval. A whole-column
 * write from an application-side snapshot would overwrite anything a
 * concurrent writer (the content loop, a re-seed) added since the read.
 */
async function defaultRecordAttempt(
  target: { organizationId: string; id: string },
  attempt: StudioScheduleAttempt
): Promise<void> {
  const patch = JSON.stringify({ studioScheduleAttempt: attempt });
  await prisma.$executeRaw`UPDATE studio_content_drafts
    SET metadata = COALESCE(metadata, '{}'::jsonb) || ${patch}::jsonb,
        updated_at = now()
    WHERE id = ${target.id}
      AND organization_id = ${target.organizationId}
      AND status = 'awaiting_approval'`;
}

function handBack(
  outcome: 'blocked' | 'schedule_failed',
  skipped: SkippedStudioPlatform[]
): ApproveAndScheduleResult {
  return { approved: false, outcome, scheduled: [], skipped };
}

export async function approveAndScheduleStudioDraft(
  input: ApproveAndScheduleInput,
  deps: ApproveAndScheduleDeps = {}
): Promise<ApproveAndScheduleResult> {
  const runInTransaction = deps.runInTransaction ?? defaultRunInTransaction;
  const recordAttempt = deps.recordAttempt ?? defaultRecordAttempt;
  const schedule = deps.schedule ?? scheduleViaPost;
  const isSchedulable = deps.isSchedulable ?? isPlatformSupported;
  const publishGate =
    deps.publishGate ??
    ((orgId: string, tx: Prisma.TransactionClient) =>
      resolveOrgAutoPublishGate(orgId, tx));
  const now = deps.now ?? (() => new Date());
  const { organizationId, id, approvedBy } = input;
  const credentialsReady =
    deps.credentialsReady ??
    (async (platform: string, tx: Prisma.TransactionClient) => {
      // The row the cron resolves for a due post: approver + platform + org.
      // A legacy connection with no organisation does not publish an
      // org-scoped post either (the cron's unscoped fallback applies only to
      // posts that carry no organisation), so it does not discharge the blocker.
      const connection = await tx.platformConnection.findFirst({
        where: { userId: approvedBy, platform, isActive: true, organizationId },
        select: { id: true },
      });
      return connection !== null;
    });
  const findScheduledStudioPost =
    deps.findScheduledStudioPost ??
    (async (draftId: string, platform: string, tx: Prisma.TransactionClient) =>
      tx.post.findFirst({
        where: {
          platform,
          deletedAt: null,
          // Org-scoped through the campaign: a Post from another organisation
          // carrying the same draft id is never reused or exposed (round 4).
          campaign: { organizationId },
          metadata: { path: ['studioDraftId'], equals: draftId },
        },
        select: { id: true, platform: true, scheduledAt: true, status: true },
        orderBy: { createdAt: 'desc' },
      }));

  // A caller may not discharge the reserved blockers by naming them. Refuse
  // before anything is claimed.
  const clearancesRequested = input.clearances ?? [];
  const reserved = clearancesRequested.filter(blocker =>
    RESERVED_CLEARANCES.has(blocker)
  );
  if (reserved.length > 0) throw new InvalidClearanceError(reserved);

  let signal: RollbackSignal;
  try {
    return await runInTransaction(async tx => {
      // The per-statement budget, enforced by the server for this transaction
      // only. First, so every statement below is covered. `SET` takes no bound
      // parameter, so the statement is built from a compile-time constant and
      // nothing else.
      await tx.$executeRawUnsafe(
        `SET LOCAL statement_timeout = ${APPROVAL_STATEMENT_TIMEOUT_MS}`
      );

      // The human-approval gate, org-scoped, only from awaiting_approval.
      const count = await approveStudioDraft(
        { organizationId, id, approvedBy },
        tx.studioContentDraft
      );
      if (count === 0) {
        return {
          approved: false,
          outcome: 'not_awaiting_approval',
          scheduled: [],
          skipped: [],
        };
      }

      // From here the draft is `approved` in this transaction only. Whatever
      // throws below takes the claim with it. After a failed statement the
      // transaction is aborted, so every failure boundary leaves at once.
      type DraftRow = {
        id: string;
        clientSlug: string;
        topic: string;
        script: string;
        platforms: Prisma.JsonValue;
        videoUrl: string | null;
        metadata: Prisma.JsonValue;
      } | null;
      let draft: DraftRow;
      try {
        draft = await tx.studioContentDraft.findFirst({
          where: { id, organizationId },
          select: {
            id: true,
            clientSlug: true,
            topic: true,
            script: true,
            platforms: true,
            videoUrl: true,
            metadata: true,
          },
        });
      } catch (error) {
        logger.error('studio draft read failed after approval', {
          organizationId,
          draftId: id,
          error: errorMessage(error),
        });
        trackError(error, {
          operation: 'studio/approve-and-schedule',
          metadata: { organizationId, draftId: id, stage: 'draft_read' },
        });
        throw new RollbackSignal(
          handBack('schedule_failed', [
            {
              platform: '*',
              reason: `draft_read_failed: ${errorMessage(error)}`,
            },
          ]),
          null
        );
      }
      if (!draft) {
        logger.error('studio draft vanished between approval and scheduling', {
          organizationId,
          draftId: id,
        });
        throw new RollbackSignal(
          handBack('schedule_failed', [
            { platform: '*', reason: 'draft_unreadable_after_approval' },
          ]),
          null
        );
      }

      const metadata = asJsonObject(draft.metadata);
      // Deduplicated: a repeated entry in settings.studio.platforms is one
      // platform, not a second Post and a second round trip.
      const platforms = Array.from(
        new Set(
          (Array.isArray(draft.platforms) ? draft.platforms : []).filter(
            (platform): platform is string => typeof platform === 'string'
          )
        )
      );
      const scheduledAt = input.scheduledAt ?? now();
      const approvedAt = now().toISOString();
      const scheduled: ScheduledStudioPost[] = [];
      const skipped: SkippedStudioPlatform[] = [];

      const rightsBlocked =
        asJsonObject(metadata.ownedMediaGate).allowed === false;
      const externalDenied = metadata.externalPublishingAllowed === false;
      const externalBlocks = asJsonObject(metadata.externalPublishBlocks);
      const authorityCampaignId =
        typeof metadata.authorityCampaignId === 'string'
          ? metadata.authorityCampaignId
          : undefined;

      // What the pack wants "recorded": the approval itself, plus any blocker
      // the approver names explicitly. Earlier committed clearances are kept.
      // Written only when this approval commits.
      const clearance: ClearanceRecord = {
        clearedBy: approvedBy,
        clearedAt: approvedAt,
        via: 'studio_approval',
      };
      const clearances: Record<string, Prisma.JsonValue> = {
        ...asJsonObject(metadata.externalPublishClearances),
        [APPROVAL_BLOCKER]: clearance,
      };
      for (const blocker of clearancesRequested) {
        clearances[blocker] = clearance;
      }

      const attemptRecord = (
        outcome: 'blocked' | 'schedule_failed',
        reasons: SkippedStudioPlatform[]
      ): StudioScheduleAttempt => ({
        attemptedAt: approvedAt,
        attemptedBy: approvedBy,
        outcome,
        clearancesRequested,
        skipped: reasons.map(entry => ({
          platform: entry.platform,
          reason: entry.reason,
        })),
      });

      // Posts that exist at the moment of a rollback, as the caller should
      // read them: created ones are gone, reused ones are untouched.
      const rolledBack = (): SkippedStudioPlatform[] =>
        scheduled.map(post => ({
          platform: post.platform,
          reason: post.reused ? 'existing_post_kept' : 'rolled_back',
        }));

      let eligible = 0;

      const scheduleOnePlatform = async (platform: string): Promise<void> => {
        const linkUrl = buildStudioFunnelLink(input.client.funnelUrl, {
          platform,
          clientSlug: draft.clientSlug,
          draftId: draft.id,
          campaign: authorityCampaignId,
        });
        const mediaUrls = draft.videoUrl ? [draft.videoUrl] : [];
        // The link rides as a card only where the adapter renders one AND the
        // post has no media (LinkedIn drops the card behind media). Everywhere
        // else it goes in the text, so a recorded link is a delivered link.
        const asCard =
          LINK_CARD_PLATFORMS.has(platform) && mediaUrls.length === 0;
        const content =
          linkUrl && !asCard && !draft.script.includes(linkUrl)
            ? `${draft.script}\n\n${linkUrl}`
            : draft.script;

        // Idempotency read, through the transaction: a Post that survived an
        // earlier attempt is reused, never duplicated.
        const existing = await findScheduledStudioPost(draft.id, platform, tx);
        if (existing) {
          const status = existing.status ?? 'scheduled';
          if (REUSABLE_POST_STATUSES.has(status)) {
            scheduled.push({
              platform: existing.platform,
              postId: existing.id,
              scheduledAt: toIso(existing.scheduledAt, scheduledAt),
              linkUrl,
              reused: true,
              ...(existing.status ? { status } : {}),
            });
            return;
          }
          if (!TERMINAL_POST_STATUSES.has(status)) {
            // pending_approval, draft, or a status this code does not know:
            // neither a success nor safe to duplicate — hold the draft back.
            skipped.push({ platform, reason: `existing_post_${status}` });
            return;
          }
          // Terminal (failed): the cron will never retry it; schedule afresh.
        }

        const post = await schedule(
          {
            userId: approvedBy,
            platform,
            content,
            scheduledTime: scheduledAt,
            mediaUrls,
            organizationId,
            metadata: {
              source: 'studio',
              studioDraftId: draft.id,
              idempotencyKey: `studio:${draft.id}:${platform}`,
              clientSlug: draft.clientSlug,
              topic: draft.topic,
              ...(authorityCampaignId ? { authorityCampaignId } : {}),
              ...(linkUrl && asCard ? { linkUrl } : {}),
            },
          },
          tx
        );
        scheduled.push({
          platform: post.platform,
          postId: post.id,
          scheduledAt: post.scheduledAt,
          linkUrl,
        });
      };

      let current: string | null = null;
      try {
        // The organisation's publish-safety state gates every platform alike:
        // a shadow-mode or paused org does not get a Post from the Studio.
        const orgGate = publishGateBlockReason(
          await publishGate(organizationId, tx)
        );

        for (const platform of platforms) {
          current = platform;
          const schedulable = isSchedulable(platform);
          if (!schedulable) {
            skipped.push({ platform, reason: 'platform_not_schedulable' });
            continue;
          }
          eligible += 1;
          if (rightsBlocked) {
            skipped.push({ platform, reason: 'owned_media_gate_blocked' });
            continue;
          }
          if (orgGate) {
            skipped.push({ platform, reason: orgGate });
            continue;
          }

          if (externalDenied) {
            const blocks = asStringArray(externalBlocks[platform]);
            if (blocks === null) {
              // Denied with no blocker list to discharge: deny by default.
              skipped.push({ platform, reason: 'external_publishing_denied' });
              continue;
            }
            const remaining: string[] = [];
            for (const blocker of blocks) {
              // Credentials come only from a live connection — a recorded
              // clearance, whoever wrote it, never stands in for one.
              if (blocker === CREDENTIALS_BLOCKER) {
                if (!(await credentialsReady(platform, tx)))
                  remaining.push(blocker);
                continue;
              }
              if (blocker in clearances) continue;
              remaining.push(blocker);
            }
            if (remaining.length > 0) {
              skipped.push({
                platform,
                reason: `external_publish_blocked: ${remaining.join(', ')}`,
              });
              continue;
            }
          }

          await scheduleOnePlatform(platform);
        }
      } catch (error) {
        // A failed statement has aborted the transaction: every Post created
        // so far rolls back with the claim. Report it and leave.
        const message = errorMessage(error);
        logger.error('studio approval rolled back: a platform failed', {
          organizationId,
          draftId: draft.id,
          platform: current,
          error: message,
        });
        trackError(error, {
          operation: 'studio/approve-and-schedule',
          metadata: {
            organizationId,
            draftId: draft.id,
            platform: current,
            stage: 'schedule',
          },
        });
        const reasons: SkippedStudioPlatform[] = [
          ...skipped,
          ...rolledBack(),
          { platform: current ?? '*', reason: `schedule_failed: ${message}` },
        ];
        throw new RollbackSignal(
          handBack('schedule_failed', reasons),
          attemptRecord('schedule_failed', reasons)
        );
      }

      // ALL OR NOTHING: an eligible platform without a Post rolls the claim
      // back, so the retry is the whole set once the block clears. The board
      // shows why from the attempt record.
      if (scheduled.length < eligible) {
        const reasons = [...skipped, ...rolledBack()];
        logger.warn('studio approval blocked', {
          organizationId,
          draftId: draft.id,
          reasons: Array.from(new Set(skipped.map(entry => entry.reason))),
        });
        throw new RollbackSignal(
          handBack('blocked', reasons),
          attemptRecord('blocked', reasons)
        );
      }

      // Record what happened on the draft — the pack's publish rule wants the
      // approval and the outcome written down, and the board shows both. This
      // commits with the claim and the Posts, or not at all. The publish flag
      // flips on the positive fact that every eligible platform was scheduled.
      await tx.studioContentDraft.updateMany({
        where: { id, organizationId },
        data: {
          metadata: {
            ...metadata,
            ...(eligible > 0 ? { externalPublishingAllowed: true } : {}),
            externalPublishApprovedBy: approvedBy,
            externalPublishApprovedAt: approvedAt,
            externalPublishClearances: clearances,
            studioSchedule: {
              attemptedAt: approvedAt,
              scheduled: scheduled.map(post => ({
                platform: post.platform,
                postId: post.postId,
                scheduledAt: post.scheduledAt,
              })),
              skipped: skipped.map(entry => ({
                platform: entry.platform,
                reason: entry.reason,
              })),
            },
          },
        },
      });

      return { approved: true, outcome: 'approved', scheduled, skipped };
    });
  } catch (error) {
    // Anything but the signal is a real failure: the claim rolled back with
    // it, the draft is untouched, and the route answers 500.
    if (!(error instanceof RollbackSignal)) throw error;
    signal = error;
  }

  // The transaction rolled back: the draft is `awaiting_approval` and no Post
  // from this attempt exists — nothing had to be written to make that true.
  // Record the attempt so the board can show why, on the still-awaiting row
  // only (a concurrent approval that has since claimed it keeps its own
  // record), merging only this key. Best effort: losing this changes nothing.
  if (signal.attempt) {
    try {
      await recordAttempt({ organizationId, id }, signal.attempt);
    } catch (error) {
      logger.warn('studio approval attempt could not be recorded', {
        organizationId,
        draftId: id,
        outcome: signal.result.outcome,
        error: errorMessage(error),
      });
    }
  }
  return signal.result;
}
