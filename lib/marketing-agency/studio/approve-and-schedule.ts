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
 * (independent review of 3def7c867, P1-CARSI-EXTERNAL-PUBLISH-BLOCKS-BYPASSED).
 * A draft carrying `externalPublishingAllowed: false` publishes to a platform
 * only when every blocker the pack lists for it in `externalPublishBlocks` is
 * discharged:
 *
 *   human_or_client_approval_required  → this call (recorded with who/when)
 *   platform_credentials_required      → an ACTIVE platform connection for the
 *                                        business under the approver — the same
 *                                        row the cron publishes with
 *   anything else                      → a recorded clearance in
 *                                        `externalPublishClearances`, written
 *                                        when the approver names it explicitly
 *
 * `externalPublishingAllowed` becomes true only once nothing remains blocked.
 *
 * Approval is never consumed by a schedule that produced nothing (review
 * P1-APPROVAL-CONSUMED-WITH-ZERO-SCHEDULED-POSTS): when a cron-eligible
 * platform existed and no Post was created — blocked or failed — the draft is
 * returned to `awaiting_approval`, the attempt and the approval record are
 * written to its metadata, and the outcome says why, so it can be retried
 * without a duplicate Post.
 *
 * Every dependency is injectable so this is unit-testable without a database.
 */

import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { isPlatformSupported } from '@/lib/social';
import {
  scheduleViaPost,
  type ScheduleViaPostInput,
  type ScheduleViaPostResult,
} from '@/lib/social/schedule-via-post';
import { buildUtmUrl } from '@/lib/utm/build-utm-url';
import { approveStudioDraft, type StudioDraftDelegate } from './draft-store';
import type { ResolvedStudioClient } from './clients';

/** The pack blocker the Studio approval itself discharges. */
export const APPROVAL_BLOCKER = 'human_or_client_approval_required';
/** The pack blocker an active platform connection for the business discharges. */
export const CREDENTIALS_BLOCKER = 'platform_credentials_required';

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
   * and when; never implied.
   */
  clearances?: string[];
}

export interface ApproveAndScheduleDeps {
  delegate?: StudioDraftDelegate;
  schedule?: (input: ScheduleViaPostInput) => Promise<ScheduleViaPostResult>;
  isSchedulable?: (platform: string) => boolean;
  /** Does the business have an ACTIVE connection for this platform under the approver? */
  credentialsReady?: (platform: string) => Promise<boolean>;
  now?: () => Date;
}

export interface ScheduledStudioPost {
  platform: string;
  postId: string;
  scheduledAt: string;
  /** The UTM-tagged funnel link attached to this post, or null (no funnel). */
  linkUrl: string | null;
}

export interface SkippedStudioPlatform {
  platform: string;
  reason: string;
}

export type ApproveOutcome =
  /** the draft is in `approved`; at least one Post exists, or no platform was cron-eligible */
  | 'approved'
  /** no row matched: missing, wrong org, or not awaiting approval — nothing happened */
  | 'not_awaiting_approval'
  /** every eligible platform was blocked; the draft is back in `awaiting_approval` */
  | 'blocked'
  /** every eligible platform failed to schedule; the draft is back in `awaiting_approval` */
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

export async function approveAndScheduleStudioDraft(
  input: ApproveAndScheduleInput,
  deps: ApproveAndScheduleDeps = {}
): Promise<ApproveAndScheduleResult> {
  const delegate = deps.delegate ?? prisma.studioContentDraft;
  const schedule = deps.schedule ?? scheduleViaPost;
  const isSchedulable = deps.isSchedulable ?? isPlatformSupported;
  const now = deps.now ?? (() => new Date());
  const { organizationId, id, approvedBy } = input;
  const credentialsReady =
    deps.credentialsReady ??
    (async (platform: string) => {
      // The row the cron resolves for a due post: approver + platform + org.
      const connection = await prisma.platformConnection.findFirst({
        where: { userId: approvedBy, platform, isActive: true, organizationId },
        select: { id: true },
      });
      return connection !== null;
    });

  // The human-approval gate, org-scoped, only from awaiting_approval.
  const count = await approveStudioDraft(
    { organizationId, id, approvedBy },
    delegate
  );
  if (count === 0) {
    return {
      approved: false,
      outcome: 'not_awaiting_approval',
      scheduled: [],
      skipped: [],
    };
  }

  const draft = await delegate.findFirst({
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
  if (!draft) {
    logger.error('studio draft vanished between approval and scheduling', {
      organizationId,
      draftId: id,
    });
    return {
      approved: true,
      outcome: 'approved',
      scheduled: [],
      skipped: [{ platform: '*', reason: 'draft_unreadable_after_approval' }],
    };
  }

  const metadata = asJsonObject(draft.metadata);
  const platforms = (
    Array.isArray(draft.platforms) ? draft.platforms : []
  ).filter((platform): platform is string => typeof platform === 'string');
  const scheduledAt = input.scheduledAt ?? now();
  const approvedAt = now().toISOString();
  const scheduled: ScheduledStudioPost[] = [];
  const skipped: SkippedStudioPlatform[] = [];

  const rightsBlocked = asJsonObject(metadata.ownedMediaGate).allowed === false;
  const externalDenied = metadata.externalPublishingAllowed === false;
  const externalBlocks = asJsonObject(metadata.externalPublishBlocks);
  const authorityCampaignId =
    typeof metadata.authorityCampaignId === 'string'
      ? metadata.authorityCampaignId
      : undefined;

  // What the pack wants "recorded": the approval itself, plus any blocker the
  // approver names explicitly. Earlier attempts' clearances are kept.
  const clearance: ClearanceRecord = {
    clearedBy: approvedBy,
    clearedAt: approvedAt,
    via: 'studio_approval',
  };
  const clearances: Record<string, Prisma.JsonValue> = {
    ...asJsonObject(metadata.externalPublishClearances),
    [APPROVAL_BLOCKER]: clearance,
  };
  for (const blocker of input.clearances ?? []) {
    clearances[blocker] = clearance;
  }

  let eligible = 0;
  let failed = 0;

  for (const platform of platforms) {
    const schedulable = isSchedulable(platform);
    if (rightsBlocked) {
      if (schedulable) eligible += 1;
      skipped.push({ platform, reason: 'owned_media_gate_blocked' });
      continue;
    }
    if (!schedulable) {
      skipped.push({ platform, reason: 'platform_not_schedulable' });
      continue;
    }
    eligible += 1;

    if (externalDenied) {
      const blocks = asStringArray(externalBlocks[platform]);
      if (blocks === null) {
        // Denied with no blocker list to discharge: deny by default.
        skipped.push({ platform, reason: 'external_publishing_denied' });
        continue;
      }
      const remaining: string[] = [];
      for (const blocker of blocks) {
        if (blocker in clearances) continue;
        if (
          blocker === CREDENTIALS_BLOCKER &&
          (await credentialsReady(platform))
        ) {
          continue;
        }
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

    const linkUrl = buildStudioFunnelLink(input.client.funnelUrl, {
      platform,
      clientSlug: draft.clientSlug,
      draftId: draft.id,
      campaign: authorityCampaignId,
    });
    const mediaUrls = draft.videoUrl ? [draft.videoUrl] : [];
    // LinkedIn attaches a link as an ARTICLE card only when the post has no
    // media and drops it otherwise, so a media post carries the link in its
    // text rather than losing it.
    const content =
      linkUrl && mediaUrls.length > 0 && !draft.script.includes(linkUrl)
        ? `${draft.script}\n\n${linkUrl}`
        : draft.script;

    try {
      const post = await schedule({
        userId: approvedBy,
        platform,
        content,
        scheduledTime: scheduledAt,
        mediaUrls,
        organizationId,
        metadata: {
          source: 'studio',
          studioDraftId: draft.id,
          clientSlug: draft.clientSlug,
          topic: draft.topic,
          ...(authorityCampaignId ? { authorityCampaignId } : {}),
          ...(linkUrl ? { linkUrl } : {}),
        },
      });
      scheduled.push({
        platform: post.platform,
        postId: post.id,
        scheduledAt: post.scheduledAt,
        linkUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('studio approval scheduled nothing for a platform', {
        organizationId,
        draftId: draft.id,
        platform,
        error: message,
      });
      failed += 1;
      skipped.push({ platform, reason: `schedule_failed: ${message}` });
    }
  }

  const studioSchedule = {
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
  };

  // A cron-eligible platform existed and none got a Post: hand the draft back
  // so the approval can be retried once the block clears or the scheduler
  // recovers. The approval stays on record in the clearances.
  if (eligible > 0 && scheduled.length === 0) {
    const outcome: ApproveOutcome = failed > 0 ? 'schedule_failed' : 'blocked';
    await delegate.updateMany({
      where: { id, organizationId, status: 'approved' },
      data: {
        status: 'awaiting_approval',
        approvedBy: null,
        approvedAt: null,
        metadata: {
          ...metadata,
          externalPublishClearances: clearances,
          studioSchedule,
        },
      },
    });
    return { approved: false, outcome, scheduled: [], skipped };
  }

  const externalBlockRemains = skipped.some(entry =>
    entry.reason.startsWith('external_publish')
  );

  // Record what happened on the draft — the pack's publish rule wants the
  // approval and the outcome written down, and the board shows both.
  await delegate.updateMany({
    where: { id, organizationId },
    data: {
      metadata: {
        ...metadata,
        ...(rightsBlocked || externalBlockRemains
          ? {}
          : { externalPublishingAllowed: true }),
        externalPublishApprovedBy: approvedBy,
        externalPublishApprovedAt: approvedAt,
        externalPublishClearances: clearances,
        studioSchedule,
      },
    },
  });

  return { approved: true, outcome: 'approved', scheduled, skipped };
}
