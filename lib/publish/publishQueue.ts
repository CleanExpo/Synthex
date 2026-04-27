/**
 * publishQueue — lib/publish/publishQueue.ts
 *
 * Orchestrator for the auto-publish queue.
 *
 * Called by the Supabase Edge Function every 15 minutes.
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
import { decryptApiKey } from '@/lib/encryption/api-key-encryption';
import { runSafetyChecks } from './safetyChecks';
import { publishToInstagram } from './platformAdapters/instagram';
import { publishToFacebook } from './platformAdapters/facebook';
import { publishToLinkedIn } from './platformAdapters/linkedin';
import { buildAttribution } from '@/components/marketing/PostAttributionFooter';
import type { ContentCalendarData, CalendarSlot } from '@/lib/calendar/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 12;
const RETRY_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

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
  caption: string
): Promise<{ success: boolean; platformPostId?: string; error?: string }> {
  const attribution = buildAttribution({
    platform,
    existingBody: caption,
  });
  const finalBody = attribution.body ?? caption;

  switch (platform) {
    case 'instagram':
      return publishToInstagram({
        accessToken,
        igUserId: profileId,
        caption: finalBody,
        firstComment: attribution.firstComment,
      });

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

  // Fetch items that are due: pending or failed-with-retry-ready
  const now = new Date();
  const dueItems = await prisma.publishQueueItem.findMany({
    where: {
      OR: [
        { status: 'pending', scheduledAt: { lte: now } },
        { status: 'failed', nextRetryAt: { lte: now } },
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
        safety.failedGate === 'slot_not_approved' ||
        safety.failedGate === 'subscription_inactive'
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

    // ── Mark as publishing ─────────────────────────────────────────────────
    await prisma.publishQueueItem.update({
      where: { id: item.id },
      data: { status: 'publishing' },
    });

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

    let clearToken: string;
    try {
      clearToken = decryptApiKey(connection.accessToken);
    } catch (decryptErr) {
      const errMsg =
        decryptErr instanceof Error ? decryptErr.message : String(decryptErr);
      logger.error('publishQueue: token decryption failed', {
        itemId: item.id,
        error: decryptErr,
      });
      await prisma.publishQueueItem.update({
        where: { id: item.id },
        data: {
          status: 'failed',
          lastError: `Token decryption failed: ${errMsg}`,
          attempts: { increment: 1 },
          nextRetryAt: new Date(Date.now() + RETRY_INTERVAL_MS),
        },
      });
      result.failed++;
      continue;
    }

    // ── Get caption for this slot ──────────────────────────────────────────
    const calendar = await prisma.contentCalendar.findUnique({
      where: { id: item.calendarId },
      select: { slots: true },
    });

    const calData = calendar?.slots as unknown as ContentCalendarData | null;
    const slot = calData?.slots?.find(
      (s: CalendarSlot & { selectedCaption?: number }) => s.id === item.slotId
    ) as (CalendarSlot & { selectedCaption?: number }) | undefined;

    const captionIdx = slot?.selectedCaption ?? 0;
    const caption = slot?.captions?.[captionIdx] ?? slot?.captions?.[0] ?? '';

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
    const publishResult = await dispatchToPlatform(
      item.platform,
      clearToken,
      connection.profileId ?? '',
      caption
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
      // ── Failure — retry or hold ───────────────────────────────────────────
      const newAttempts = item.attempts + 1;

      if (newAttempts >= MAX_ATTEMPTS) {
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
