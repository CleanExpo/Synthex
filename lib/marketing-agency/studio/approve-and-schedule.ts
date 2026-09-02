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
 * credentials, approval, and rights checks are recorded" — is honoured with the
 * facts available at approval time:
 *
 *   approval    → this call; recorded on the draft (externalPublishApprovedBy/At)
 *   rights      → metadata.ownedMediaGate.allowed === false refuses to schedule
 *   credentials → the cron fails the post loudly (no connection → failed +
 *                 notification); nothing is dropped silently
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

export interface ApproveAndScheduleInput {
  organizationId: string;
  id: string;
  approvedBy: string;
  client: Pick<ResolvedStudioClient, 'clientSlug' | 'funnelUrl'>;
  /** When to publish. Defaults to now — the cron's next tick picks it up. */
  scheduledAt?: Date;
}

export interface ApproveAndScheduleDeps {
  delegate?: StudioDraftDelegate;
  schedule?: (input: ScheduleViaPostInput) => Promise<ScheduleViaPostResult>;
  isSchedulable?: (platform: string) => boolean;
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

export interface ApproveAndScheduleResult {
  /** false = no row matched (missing / wrong org / not awaiting) — nothing happened. */
  approved: boolean;
  scheduled: ScheduledStudioPost[];
  skipped: SkippedStudioPlatform[];
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

export async function approveAndScheduleStudioDraft(
  input: ApproveAndScheduleInput,
  deps: ApproveAndScheduleDeps = {}
): Promise<ApproveAndScheduleResult> {
  const delegate = deps.delegate ?? prisma.studioContentDraft;
  const schedule = deps.schedule ?? scheduleViaPost;
  const isSchedulable = deps.isSchedulable ?? isPlatformSupported;
  const now = deps.now ?? (() => new Date());
  const { organizationId, id, approvedBy } = input;

  // The human-approval gate, org-scoped, only from awaiting_approval.
  const count = await approveStudioDraft(
    { organizationId, id, approvedBy },
    delegate
  );
  if (count === 0) return { approved: false, scheduled: [], skipped: [] };

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
  const authorityCampaignId =
    typeof metadata.authorityCampaignId === 'string'
      ? metadata.authorityCampaignId
      : undefined;

  for (const platform of platforms) {
    if (rightsBlocked) {
      skipped.push({ platform, reason: 'owned_media_gate_blocked' });
      continue;
    }
    if (!isSchedulable(platform)) {
      skipped.push({ platform, reason: 'platform_not_schedulable' });
      continue;
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
      skipped.push({ platform, reason: `schedule_failed: ${message}` });
    }
  }

  // Record what happened on the draft — the pack's publish rule wants the
  // approval and the outcome written down, and the board shows both.
  await delegate.updateMany({
    where: { id, organizationId },
    data: {
      metadata: {
        ...metadata,
        externalPublishingAllowed: !rightsBlocked,
        externalPublishApprovedBy: approvedBy,
        externalPublishApprovedAt: approvedAt,
        studioSchedule: {
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

  return { approved: true, scheduled, skipped };
}
