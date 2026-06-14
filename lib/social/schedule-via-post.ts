/**
 * schedule-via-post — the single, canonical way to schedule a social post.
 *
 * BACKGROUND (P1 / syn-p1-retire-dead-scheduler):
 * The repo grew TWO scheduling systems:
 *
 *   1. THE WORKING ONE — `Post` table (status='scheduled', scheduledAt) drained
 *      by the Vercel cron `/api/cron/publish-scheduled` (every 5 min), which
 *      resolves the user's active `platformConnection` and actually publishes.
 *
 *   2. A DEAD ONE — a raw insert into the Supabase `scheduled_posts` table that
 *      was meant to be drained by a BullMQ worker (`lib/queue/workers/
 *      scheduled-posts-worker.ts`). That worker is NEVER booted — `startAllWorkers`
 *      is defined but called nowhere in any runtime (no instrumentation hook, no
 *      separate worker process, no package.json script). So every post scheduled
 *      from the per-platform `/api/social/<platform>/post` routes was written to
 *      `scheduled_posts` with status='pending' and then silently lost: it never
 *      published and the user got no error.
 *
 * This helper redirects those entry points onto system #1. It mirrors the
 * proven logic of `app/api/scheduler/posts` POST: resolve the owner's active
 * brand (organization), get-or-create the default "Scheduled Posts" campaign,
 * and create a `Post` the cron will pick up.
 *
 * NOTE: Facebook is intentionally NOT routed through here — it schedules
 * natively on Facebook's own Graph API (`published:false` + scheduled_publish_time),
 * which genuinely publishes, so its path is left untouched.
 */

import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { logger } from '@/lib/logger';

export interface ScheduleViaPostInput {
  /** Authenticated user id (owner of the post / campaign). */
  userId: string;
  /** Lowercase platform key, e.g. 'twitter', 'instagram', 'linkedin'. */
  platform: string;
  /** Post body text. */
  content: string;
  /** When the post should publish. Must be a future instant for the cron to act. */
  scheduledTime: Date;
  /** Optional media URLs — stored in metadata.images, which the cron reads. */
  mediaUrls?: string[];
  /** Optional extra metadata merged into the Post.metadata JSON. */
  metadata?: Record<string, unknown>;
}

export interface ScheduleViaPostResult {
  /** The created Post id (cuid). */
  id: string;
  platform: string;
  scheduledAt: string;
  status: 'scheduled';
}

/**
 * Schedule a post through the working `Post` + cron scheduler.
 *
 * Resolves the active organization, ensures a default campaign exists, and
 * creates a `Post` row with status='scheduled'. The Vercel cron
 * `/api/cron/publish-scheduled` then publishes it via the user's connected
 * platform account.
 *
 * Throws on failure — callers should surface a real error to the user rather
 * than swallowing it (the whole point of retiring the dead path).
 */
export async function scheduleViaPost(
  input: ScheduleViaPostInput
): Promise<ScheduleViaPostResult> {
  const { userId, platform, content, scheduledTime, mediaUrls, metadata } =
    input;

  const organizationId = await getEffectiveOrganizationId(userId);

  // Get or create the default "Scheduled Posts" campaign, scoped to the active
  // brand — identical to /api/scheduler/posts so both entry points share one
  // campaign and one calendar view.
  let defaultCampaign = await prisma.campaign.findFirst({
    where: {
      userId,
      name: 'Scheduled Posts',
      ...(organizationId ? { organizationId } : { organizationId: null }),
    },
    select: { id: true },
  });

  if (!defaultCampaign) {
    defaultCampaign = await prisma.campaign.create({
      data: {
        userId,
        name: 'Scheduled Posts',
        description: 'Default campaign for scheduled posts',
        platform: 'multi',
        status: 'active',
        ...(organizationId ? { organizationId } : {}),
      },
      select: { id: true },
    });
  }

  const mergedMetadata: Record<string, unknown> = {
    ...(metadata ?? {}),
    // The cron publisher reads media from metadata.images.
    ...(mediaUrls && mediaUrls.length > 0 ? { images: mediaUrls } : {}),
  };

  const post = await prisma.post.create({
    data: {
      content,
      platform: platform.toLowerCase(),
      status: 'scheduled',
      scheduledAt: scheduledTime,
      metadata: mergedMetadata as Prisma.InputJsonValue,
      campaignId: defaultCampaign.id,
    },
    select: { id: true, platform: true, scheduledAt: true },
  });

  logger.info(
    `[schedule-via-post] Scheduled ${platform} post ${post.id} for ${scheduledTime.toISOString()} (campaign ${defaultCampaign.id})`
  );

  return {
    id: post.id,
    platform: post.platform,
    scheduledAt: (post.scheduledAt ?? scheduledTime).toISOString(),
    status: 'scheduled',
  };
}
