/**
 * publishQueue — lib/publish/publishQueue.ts
 *
 * Orchestrator for the auto-publish queue.
 *
 * Called by the Supabase Edge Function every 15 minutes.
 *
 * Each pass first reclaims any item stranded in 'publishing' by a crashed/timed-
 * out prior worker (releases it to 'failed' so the due-fetch retries it), then:
 *
 * Flow per queue item:
 *  1. Run five safety gates (safetyChecks.ts)
 *  2. Mark item as 'publishing'
 *  3. Decrypt platform token
 *  4. Dispatch to platform adapter (instagram / facebook / linkedin)
 *  5a. Success → mark 'published', update slot in calendar JSON
 *  5b. Failure → increment attempts; if < MAX_ATTEMPTS → schedule retry;
 *                if >= MAX_ATTEMPTS → mark 'held' + create in-app notification
 *
 * Every attempt (success or failure) is logged for audit purposes.
 *
 * Retry policy: up to 12 attempts, 4-hour interval → 48-hour window total.
 *
 * @task SYN-523
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { runSafetyChecks } from './safetyChecks';
import { publishToInstagram } from './platformAdapters/instagram';
import { publishToFacebook } from './platformAdapters/facebook';
import { publishToLinkedIn } from './platformAdapters/linkedin';
import { publishToTwitter } from './platformAdapters/twitter';
import { publishToThreads } from './platformAdapters/threads';
import { publishToYouTube } from './platformAdapters/youtube';
import { publishToTikTok } from './platformAdapters/tiktok';
import { decryptField } from '@/lib/security/field-encryption';
import { buildAttribution } from '@/components/marketing/PostAttributionFooter';
import type { ContentCalendarData, CalendarSlot } from '@/lib/calendar/types';
import { extractCampaignAuthorityManifest } from '@/lib/marketing-agency/campaign-authority-manifest';
import { assertCampaignPublishable } from '@/lib/marketing-agency/publish-gate';
import { resolvePlatformAccessToken } from '@/lib/platform-connections/token-readiness';
import {
  claimQueueItemForPublish,
  reclaimStalePublishingQueueItems,
} from './postPublishClaim';
import { isSocialCutSlot, resolveSocialCutSource } from './socialCutSource';
import { trackPipelineCost } from '@/lib/pipelines/track-cost';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 12;
const RETRY_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
// Platforms whose real publish client can post from a caption alone (no extra
// per-slot metadata such as a subreddit, board, or video). These are the only
// platforms safe to seed into the caption-driven auto-publish queue. Reddit,
// Pinterest, YouTube and TikTok all have real publish clients too, but each
// REQUIRES slot metadata the calendar model does not yet carry (subreddit/title,
// board_id, a video URL) — seeding them here would only queue posts that fail
// their own validation, so they stay out until that metadata exists.
const AUTO_PUBLISH_PLATFORMS = new Set([
  'instagram',
  'facebook',
  'linkedin',
  'twitter',
  'threads',
]);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProcessQueueResult {
  processed: number;
  published: number;
  failed: number;
  held: number;
  skipped: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Mark a slot as published in the ContentCalendar JSONB column */
async function markSlotPublished(
  calendarId: string,
  slotId: string
): Promise<void> {
  const calendar = await prisma.contentCalendar.findUnique({
    where: { id: calendarId },
    select: { slots: true },
  });

  if (!calendar) return;

  const data = calendar.slots as unknown as ContentCalendarData;
  const updatedSlots = data.slots.map(slot =>
    slot.id === slotId
      ? ({
          ...slot,
          status: 'published',
          publishedAt: new Date().toISOString(),
        } as CalendarSlot & { status: string; publishedAt: string })
      : slot
  );

  await prisma.contentCalendar.update({
    where: { id: calendarId },
    data: {
      slots: { ...data, slots: updatedSlots } as unknown as Parameters<
        typeof prisma.contentCalendar.update
      >[0]['data']['slots'],
      updatedAt: new Date(),
    },
  });
}

/** Create an in-app notification for all users in the org */
async function notifyOrgUsers(
  organizationId: string,
  title: string,
  message: string,
  data?: Record<string, unknown>
): Promise<void> {
  const users = await prisma.user.findMany({
    where: { organizationId },
    select: { id: true },
  });

  if (users.length === 0) return;

  await prisma.notification.createMany({
    data: users.map(u => ({
      userId: u.id,
      type: 'warning',
      title,
      message,
      data: (data ?? undefined) as never,
    })),
  });
}

/** Dispatch to the correct platform adapter.
 *
 * Applies the attribution footer (SYN-779) to new outgoing posts only. The
 * caller of this function is `processPublishQueue` processing a
 * `PublishQueueItem` in `pending`/`failed-retry` state — never a
 * backfill of previously-published posts. */
async function dispatchToPlatform(
  platform: string,
  accessToken: string,
  profileId: string,
  caption: string,
  /**
   * OAuth 1.0a access-token secret — only required by Twitter/X. Decrypted by
   * the caller from PlatformConnection.refreshToken.
   */
  accessTokenSecret?: string,
  /**
   * Optional per-slot media / publish context.
   *
   * - `type`/`url` (backlog #13): Instagram Reels — when `type === 'REELS'` AND
   *   `url` is present the slot is published as a Reel via the IG adapter's
   *   REELS branch; any other combination falls back to caption-only (never
   *   post placeholder content, no-mock-data rule).
   * - `video` (SYN-1075 WS4a): the rendered short's public URL, required by the
   *   YouTube / TikTok cases — a missing video URL fails the dispatch closed
   *   rather than posting an empty video.
   * - `youtube` (SYN-1075 WS4a): the grilled search package for the YouTube
   *   video snippet (title / description / tags).
   * - `refreshToken` (SYN-1075 WS4a): decrypted OAuth refresh token for the
   *   platforms whose adapter can refresh mid-publish (youtube / tiktok).
   */
  media?: {
    type?: 'REELS';
    url?: string;
    video?: { url?: string; thumbnail?: string };
    youtube?: { title?: string; description?: string; tags?: string[] };
    refreshToken?: string;
  }
): Promise<{
  success: boolean;
  platformPostId?: string;
  error?: string;
  /** HTTP status of a failed platform response, when the adapter saw one. */
  statusCode?: number;
}> {
  const attribution = buildAttribution({
    platform,
    existingBody: caption,
  });
  const finalBody = attribution.body ?? caption;

  switch (platform) {
    case 'instagram': {
      // Reels path (backlog #13): only when the slot is explicitly REELS AND a
      // public video URL is present. If REELS is requested without a mediaUrl
      // we log and fall through to the caption-only call — posting the wrong
      // surface or placeholder media is never acceptable.
      const wantsReels = media?.type === 'REELS';
      const hasMediaUrl =
        typeof media?.url === 'string' && media.url.length > 0;

      if (wantsReels && !hasMediaUrl) {
        logger.warn(
          'publishQueue: instagram slot marked REELS but has no mediaUrl — falling back to caption-only publish',
          { platform, profileId }
        );
      }

      return publishToInstagram({
        accessToken,
        igUserId: profileId,
        caption: finalBody,
        firstComment: attribution.firstComment,
        ...(wantsReels && hasMediaUrl
          ? { mediaType: 'REELS' as const, mediaUrl: media.url }
          : {}),
      });
    }

    case 'facebook':
      return publishToFacebook({
        accessToken,
        pageId: profileId,
        message: finalBody,
      });

    case 'linkedin': {
      // profileId for LinkedIn is the person/org ID; construct the URN
      const authorUrn = profileId.startsWith('urn:li:')
        ? profileId
        : `urn:li:person:${profileId}`;
      return publishToLinkedIn({
        accessToken,
        authorUrn,
        text: finalBody,
      });
    }

    case 'twitter':
      return publishToTwitter({
        accessToken,
        accessTokenSecret,
        text: finalBody,
      });

    case 'threads':
      return publishToThreads({
        accessToken,
        text: finalBody,
      });

    // ── nexus-viral video cuts (SYN-1075 WS4a) ─────────────────────────────
    // Reached ONLY when draining a publish_queue row a human released to
    // `pending` via POST /api/publish-queue/release. youtube/tiktok are NOT in
    // AUTO_PUBLISH_PLATFORMS, so no automated path can queue them (§15.9
    // invariant). Both require a rendered video URL.
    case 'youtube': {
      const videoUrl = media?.video?.url;
      if (!videoUrl) {
        return {
          success: false,
          error:
            'YouTube publish requires a rendered video URL on the slot — none present.',
        };
      }
      const yt = media?.youtube;
      return publishToYouTube({
        accessToken,
        refreshToken: media?.refreshToken,
        videoUrl,
        // Prefer the grilled search-package title; fall back to the caption.
        title: yt?.title ?? caption,
        description: yt?.description,
        tags: yt?.tags,
      });
    }

    case 'tiktok': {
      const videoUrl = media?.video?.url;
      if (!videoUrl) {
        return {
          success: false,
          error:
            'TikTok publish requires a rendered video URL on the slot — none present.',
        };
      }
      return publishToTikTok({
        accessToken,
        refreshToken: media?.refreshToken,
        videoUrl,
        caption: finalBody,
      });
    }

    default:
      return {
        success: false,
        error: `Platform '${platform}' is not yet supported by the auto-publish adapter`,
      };
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Process all pending PublishQueueItems that are due for publish.
 * Designed to be called every 15 minutes by the Supabase Edge Function.
 */
export async function processPublishQueue(): Promise<ProcessQueueResult> {
  const result: ProcessQueueResult = {
    processed: 0,
    published: 0,
    failed: 0,
    held: 0,
    skipped: 0,
  };

  const now = new Date();

  // Crash recovery: release any item stranded in 'publishing' by a worker that
  // died/timed out before resolving it. The due-fetch below only selects
  // 'pending'/'failed' rows, so a stuck 'publishing' row would otherwise never
  // be retried and the scheduled post would be silently lost. Reclaim flips it
  // back to 'failed' with nextRetryAt=now so this same pass re-queues it.
  await reclaimStalePublishingQueueItems(now);

  // Fetch items that are due: pending or failed-with-retry-ready. The
  // publishedAt: null predicate is State-6 defence-in-depth (SYN-540): a row
  // that ever recorded a confirmed platform success must never be re-selected,
  // whatever its status ended up as.
  const dueItems = await prisma.publishQueueItem.findMany({
    where: {
      OR: [
        { status: 'pending', scheduledAt: { lte: now }, publishedAt: null },
        { status: 'failed', nextRetryAt: { lte: now }, publishedAt: null },
      ],
    },
    orderBy: { scheduledAt: 'asc' },
    take: 50, // Process at most 50 items per run to stay within Edge Function limits
  });

  logger.info('publishQueue: processing', { count: dueItems.length });

  for (const item of dueItems) {
    result.processed++;

    // ── Safety gates ────────────────────────────────────────────────────────
    const safety = await runSafetyChecks({
      organizationId: item.organizationId,
      calendarId: item.calendarId,
      slotId: item.slotId,
      platform: item.platform,
    });

    if (!safety.pass) {
      logger.warn('publishQueue: safety check failed', {
        itemId: item.id,
        gate: safety.failedGate,
        reason: safety.reason,
      });

      // Shadow mode + slot_not_approved → hold indefinitely (not a retry)
      if (
        safety.failedGate === 'shadow_mode' ||
        safety.failedGate === 'auto_publish_paused' ||
        safety.failedGate === 'slot_not_approved' ||
        safety.failedGate === 'subscription_inactive' ||
        safety.failedGate === 'campaign_authority_blocked'
      ) {
        await prisma.publishQueueItem.update({
          where: { id: item.id },
          data: {
            status: 'held',
            lastError: safety.reason ?? 'Safety check failed',
          },
        });
        result.held++;
      } else {
        // Token invalid or insufficient digests → treat as transient failure
        await prisma.publishQueueItem.update({
          where: { id: item.id },
          data: {
            status: 'failed',
            lastError: safety.reason ?? 'Safety check failed',
            attempts: { increment: 1 },
            nextRetryAt: new Date(Date.now() + RETRY_INTERVAL_MS),
          },
        });
        result.failed++;
      }
      continue;
    }

    // ── Atomically claim → 'publishing' ────────────────────────────────────
    // Conditional updateMany (status still 'pending'/'failed') — exactly one
    // concurrent worker wins and proceeds; any overlapping pass / retry / second
    // instance loses the race here and skips WITHOUT publishing. Replaces the
    // old unconditional update, which gave no mutual exclusion and let two
    // workers both dispatch the same post to the platform. See
    // lib/publish/postPublishClaim.ts → claimQueueItemForPublish.
    const claimed = await claimQueueItemForPublish(item.id);
    if (!claimed) {
      logger.warn('publishQueue: skipping item — claimed by another worker', {
        itemId: item.id,
      });
      result.skipped++;
      continue;
    }

    // ── Get platform connection + decrypt token ────────────────────────────
    const connection = await prisma.platformConnection.findFirst({
      where: {
        organizationId: item.organizationId,
        platform: item.platform,
        isActive: true,
        deletedAt: null,
      },
      select: {
        accessToken: true,
        refreshToken: true,
        encryptionKeyVersion: true,
        profileId: true,
      },
    });

    if (!connection) {
      await prisma.publishQueueItem.update({
        where: { id: item.id },
        data: {
          status: 'failed',
          lastError: 'Platform connection disappeared after safety check',
          attempts: { increment: 1 },
          nextRetryAt: new Date(Date.now() + RETRY_INTERVAL_MS),
        },
      });
      result.failed++;
      continue;
    }

    const tokenReadiness = resolvePlatformAccessToken(connection.accessToken);
    if (!tokenReadiness.ok || !tokenReadiness.accessToken) {
      logger.error('publishQueue: token decryption failed', {
        itemId: item.id,
        error: tokenReadiness.reason,
      });
      await prisma.publishQueueItem.update({
        where: { id: item.id },
        data: {
          status: 'failed',
          lastError: tokenReadiness.reason ?? 'Token could not be resolved',
          attempts: { increment: 1 },
          nextRetryAt: new Date(Date.now() + RETRY_INTERVAL_MS),
        },
      });
      result.failed++;
      continue;
    }

    // ── Get caption + media for this item ──────────────────────────────────
    // Two sources, one dispatch shape:
    //  • A nexus-viral social cut (slotId `social-cut:<assetId>`) has no
    //    CalendarSlot — `deriveSocialCut` stored the caption + rendered video (+
    //    optional YouTube snippet) on the `videoAsset`. Source them from there
    //    (SYN-1094 item 3). Reached ONLY after a human release moved the row to
    //    `pending`; this branch never transitions the row (§15.9 untouched).
    //  • Every other row reads the slot from the ContentCalendar JSON as before.
    let caption = '';
    let publishMedia: {
      type?: 'REELS';
      url?: string;
      video?: { url?: string; thumbnail?: string };
      youtube?: { title?: string; description?: string; tags?: string[] };
    } = {};

    if (isSocialCutSlot(item.slotId)) {
      const source = await resolveSocialCutSource(
        item.slotId,
        item.organizationId
      );
      if (!source || !source.video?.url) {
        await prisma.publishQueueItem.update({
          where: { id: item.id },
          data: {
            status: 'held',
            lastError:
              'Social cut media could not be resolved — no rendered video for this cut',
          },
        });
        result.held++;
        continue;
      }
      caption = source.caption;
      publishMedia = { video: source.video, youtube: source.youtube };
    } else {
      const calendar = await prisma.contentCalendar.findUnique({
        where: { id: item.calendarId },
        select: { slots: true },
      });

      const calData = calendar?.slots as unknown as ContentCalendarData | null;
      const slot = calData?.slots?.find(
        (s: CalendarSlot & { selectedCaption?: number }) => s.id === item.slotId
      ) as (CalendarSlot & { selectedCaption?: number }) | undefined;

      const captionIdx = slot?.selectedCaption ?? 0;
      caption = slot?.captions?.[captionIdx] ?? slot?.captions?.[0] ?? '';
      publishMedia = {
        type: slot?.mediaType,
        url: slot?.mediaUrl,
        video: slot?.video,
        youtube: slot?.youtube,
      };
    }

    if (!caption) {
      await prisma.publishQueueItem.update({
        where: { id: item.id },
        data: {
          status: 'held',
          lastError: 'No caption available for this slot',
        },
      });
      result.held++;
      continue;
    }

    // ── Dispatch to platform ───────────────────────────────────────────────
    // Twitter/X uses OAuth 1.0a user context: the access-token SECRET is stored
    // (encrypted) in refreshToken. Decrypt it only for Twitter; other platforms
    // ignore it. A decrypt failure leaves it undefined and the adapter reports
    // "not configured" rather than posting unsigned.
    const accessTokenSecret =
      item.platform === 'twitter' && connection.refreshToken
        ? (decryptField(connection.refreshToken) ?? undefined)
        : undefined;

    // YouTube/TikTok OAuth refresh token (SYN-1075 WS4a). Unlike Twitter's
    // OAuth 1.0a secret, this is a genuine refresh token the platform service
    // uses to renew an expiring access token mid-publish. Decrypt failures
    // leave it undefined; the adapter still publishes with the access token.
    const oauthRefreshToken =
      (item.platform === 'youtube' || item.platform === 'tiktok') &&
      connection.refreshToken
        ? (decryptField(connection.refreshToken) ?? undefined)
        : undefined;

    // Per-item media. For a calendar slot this is backlog #13 (Instagram Reels:
    // `mediaType: 'REELS'` + `mediaUrl` reaches the IG adapter's REELS branch)
    // plus the SYN-1075 WS4a video/youtube fields. For a social cut it is the
    // rendered video + optional YouTube snippet resolved from the videoAsset
    // (SYN-1094 item 3). dispatchToPlatform ignores fields a platform doesn't
    // use and falls back to caption-only when a URL is missing.
    const publishResult = await dispatchToPlatform(
      item.platform,
      tokenReadiness.accessToken,
      connection.profileId ?? '',
      caption,
      accessTokenSecret,
      {
        ...publishMedia,
        // OAuth refresh token, consumed only by the youtube/tiktok dispatch
        // cases; decrypted above.
        refreshToken: oauthRefreshToken,
      }
    );

    if (publishResult.success) {
      // ── Success ──────────────────────────────────────────────────────────
      await Promise.all([
        prisma.publishQueueItem.update({
          where: { id: item.id },
          data: {
            status: 'published',
            publishedAt: new Date(),
            attempts: { increment: 1 },
            lastError: null,
          },
        }),
        markSlotPublished(item.calendarId, item.slotId),
      ]);

      logger.info('publishQueue: published', {
        itemId: item.id,
        platform: item.platform,
        platformPostId: publishResult.platformPostId,
      });
      result.published++;
    } else {
      // ── Failure — hold (auth), retry, or hold (exhausted) ─────────────────
      const newAttempts = item.attempts + 1;
      // Failure State 1 (docs/AUTO-PUBLISH-FAILURE-MODES.md, SYN-538/SYN-540):
      // keyed strictly on the platform's HTTP 401 — a structured field set by
      // the adapter from its own response object, never parsed from error
      // text (which can echo user-controlled captions/URLs).
      const authExpired = publishResult.statusCode === 401;

      if (authExpired) {
        // Expired social credentials never self-heal: hold this item with no
        // retry and set the org's persistent auto-publish pause (the SYN-551
        // kill-switch, enforced by safety Gate 2) so every current AND future
        // queue row for this organisation is held until a human reconnects.
        await prisma.publishQueueItem.update({
          where: { id: item.id },
          data: {
            status: 'held',
            lastError:
              publishResult.error ?? 'Platform returned 401 (unauthorized)',
            attempts: newAttempts,
            nextRetryAt: null,
          },
        });

        await prisma.organization.update({
          where: { id: item.organizationId },
          data: { autoPublishPaused: true },
        });

        // Notification + cost-ledger are audit/UX side effects: their failure
        // must never abort the queue run or skip the accounting below.
        try {
          await notifyOrgUsers(
            item.organizationId,
            'Your social connection has expired',
            `Your ${item.platform} connection has expired — reconnect to resume auto-scheduling.`,
            {
              publishQueueItemId: item.id,
              platform: item.platform,
              error: publishResult.error,
            }
          );
          await trackPipelineCost({
            pipeline_name: 'auto-publish',
            client_id: item.organizationId,
            run_id: item.id,
            model: 'none',
            input_tokens: 0,
            output_tokens: 0,
            cost_usd: 0,
            error_code: 'UNAUTHORIZED',
          });
        } catch (sideEffectErr) {
          logger.error(
            'publishQueue: state-1 notification/ledger side effect failed',
            {
              itemId: item.id,
              error:
                sideEffectErr instanceof Error
                  ? sideEffectErr.message
                  : String(sideEffectErr),
            }
          );
        }

        logger.warn('publishQueue: held after unauthorized platform response', {
          itemId: item.id,
          platform: item.platform,
          error_code: 'UNAUTHORIZED',
          orgPaused: true,
          error: publishResult.error,
        });
        result.held++;
      } else if (newAttempts >= MAX_ATTEMPTS) {
        // Exhausted retries → hold + notify
        await prisma.publishQueueItem.update({
          where: { id: item.id },
          data: {
            status: 'held',
            lastError:
              publishResult.error ?? 'Publish failed after max retries',
            attempts: newAttempts,
            nextRetryAt: null,
          },
        });

        await notifyOrgUsers(
          item.organizationId,
          'Post could not be published',
          `A ${item.platform} post scheduled for ${item.scheduledAt.toLocaleDateString('en-AU')} could not be published after ${MAX_ATTEMPTS} attempts and has been held for review.`,
          {
            publishQueueItemId: item.id,
            platform: item.platform,
            error: publishResult.error,
          }
        );

        logger.warn('publishQueue: held after max retries', {
          itemId: item.id,
          attempts: newAttempts,
          error: publishResult.error,
        });
        result.held++;
      } else {
        // Schedule retry in 4 hours
        await prisma.publishQueueItem.update({
          where: { id: item.id },
          data: {
            status: 'failed',
            lastError: publishResult.error ?? 'Publish failed',
            attempts: newAttempts,
            nextRetryAt: new Date(Date.now() + RETRY_INTERVAL_MS),
          },
        });

        logger.warn('publishQueue: retry scheduled', {
          itemId: item.id,
          attempts: newAttempts,
          nextRetry: new Date(Date.now() + RETRY_INTERVAL_MS).toISOString(),
          error: publishResult.error,
        });
        result.failed++;
      }
    }
  }

  logger.info('publishQueue: run complete', { ...result });
  return result;
}

// ── Queue seeding ─────────────────────────────────────────────────────────────

/**
 * Seed the publish queue for all approved slots in a live-mode calendar.
 * Called when a calendar is approved or when an org switches to Live mode.
 *
 * Idempotent: skips slots that already have a queue entry.
 */
export async function seedPublishQueue(
  calendarId: string,
  organizationId: string
): Promise<number> {
  const calendar = await prisma.contentCalendar.findFirst({
    where: { id: calendarId, organizationId },
    select: { slots: true },
  });

  if (!calendar) return 0;

  const data = calendar.slots as unknown as ContentCalendarData;
  const approvedSlots = (
    data.slots as (CalendarSlot & { status?: string })[]
  ).filter(s => s.status === 'approved');

  let seeded = 0;

  for (const slot of approvedSlots) {
    if (!AUTO_PUBLISH_PLATFORMS.has(slot.platform)) {
      logger.warn(
        'publishQueue: approved slot skipped by platform adapter gate',
        {
          calendarId,
          slotId: slot.id,
          platform: slot.platform,
        }
      );
      continue;
    }

    const authorityManifest = extractCampaignAuthorityManifest(slot, data);
    const publishGate = assertCampaignPublishable({
      manifest: authorityManifest,
      platforms: [slot.platform],
      requestedAction: 'seed_publish_queue',
    });

    if (!publishGate.allowed) {
      logger.warn('publishQueue: approved slot skipped by authority gate', {
        calendarId,
        slotId: slot.id,
        platform: slot.platform,
        blockers: publishGate.blockers,
      });
      continue;
    }

    // Check if a queue item already exists for this slot
    const existing = await prisma.publishQueueItem.findFirst({
      where: {
        calendarId,
        slotId: slot.id,
        status: { notIn: ['held'] }, // Re-seed held items on explicit action
      },
    });

    if (existing) continue;

    await prisma.publishQueueItem.create({
      data: {
        organizationId,
        calendarId,
        slotId: slot.id,
        platform: slot.platform,
        scheduledAt: new Date(slot.scheduledAt),
        status: 'pending',
      },
    });
    seeded++;
  }

  logger.info('publishQueue: seeded', { calendarId, seeded });
  return seeded;
}
