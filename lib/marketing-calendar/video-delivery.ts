/**
 * Hand-off from the short-form engine into a portfolio calendar slot.
 *
 * The engine renders a video, runs its SDA visual gate, and once the video
 * passes it calls POST /api/portfolio-calendar/video-delivery with the slot's
 * slotKey. This attaches the video to that draft slot. It never approves,
 * schedules or publishes: the slot stays 'draft' for Phill to approve.
 */

import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { PORTFOLIO_CALENDAR_TAG } from './portfolio-plan';

export const DELIVERY_TOKEN_ENV = 'SHORTFORM_DELIVERY_TOKEN';

const httpsUrl = z
  .string()
  .url()
  .max(2000)
  .refine(u => u.startsWith('https://'), 'must be an https URL');

export const videoDeliverySchema = z.object({
  slotKey: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+-video-\d+$/,
      'not a short-form slot key'
    ),
  videoUrl: httpsUrl,
  thumbnailUrl: httpsUrl.optional(),
  durationSeconds: z.number().positive().max(180).optional(),
  // The engine's SDA gate must have passed; a failed or missing verdict is refused.
  sdaPassed: z.literal(true),
  sdaVerdictId: z.string().min(1).max(200),
  captionDraft: z.string().max(2200).optional(),
  engineRunId: z.string().max(200).optional(),
});

export type VideoDelivery = z.infer<typeof videoDeliverySchema>;

/** Constant-time check of the X-Delivery-Token header. Null token = not provisioned. */
export function checkDeliveryToken(
  presented: string | null,
  expected: string | undefined
): 'ok' | 'not_provisioned' | 'invalid' {
  if (!expected) return 'not_provisioned';
  if (!presented) return 'invalid';
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return 'invalid';
  return timingSafeEqual(a, b) ? 'ok' : 'invalid';
}

export type DeliveryResult =
  | { outcome: 'attached' | 'unchanged'; postId: string }
  | { outcome: 'not_found' }
  | { outcome: 'conflict'; reason: string };

export async function attachVideoToSlot(
  delivery: VideoDelivery
): Promise<DeliveryResult> {
  const post = await prisma.calendarPost.findFirst({
    where: {
      tags: { has: PORTFOLIO_CALENDAR_TAG },
      metadata: { path: ['slotKey'], equals: delivery.slotKey },
    },
  });
  if (!post) return { outcome: 'not_found' };

  const metadata = (post.metadata ?? {}) as Record<string, unknown>;
  if (metadata.slotKind !== 'shortform_video') {
    return {
      outcome: 'conflict',
      reason: 'slot is not a short-form video slot',
    };
  }
  if (post.status !== 'draft') {
    return {
      outcome: 'conflict',
      reason: `slot is ${post.status}; only draft slots take a video`,
    };
  }
  if (post.mediaUrls[0] === delivery.videoUrl) {
    return { outcome: 'unchanged', postId: post.id };
  }
  if (post.mediaUrls.length > 0) {
    return {
      outcome: 'conflict',
      reason: 'slot already holds a different video; detach it first',
    };
  }

  // The checks above are repeated in the WHERE so they hold at write time: a
  // slot scheduled, or filled by another delivery, since the read matches
  // nothing and is reported as a conflict.
  const { count } = await prisma.calendarPost.updateMany({
    where: {
      id: post.id,
      status: 'draft',
      mediaUrls: { isEmpty: true },
      tags: { has: PORTFOLIO_CALENDAR_TAG },
      metadata: { path: ['slotKind'], equals: 'shortform_video' },
    },
    data: {
      mediaUrls: [delivery.videoUrl],
      metadata: {
        ...metadata,
        videoDelivery: {
          status: 'delivered',
          deliveredAt: new Date().toISOString(),
          videoUrl: delivery.videoUrl,
          thumbnailUrl: delivery.thumbnailUrl ?? null,
          durationSeconds: delivery.durationSeconds ?? null,
          sdaPassed: true,
          sdaVerdictId: delivery.sdaVerdictId,
          captionDraft: delivery.captionDraft ?? null,
          engineRunId: delivery.engineRunId ?? null,
        },
        approvalState: 'pending_approval',
      } as Prisma.InputJsonValue,
    },
  });
  if (count === 0) {
    return {
      outcome: 'conflict',
      reason:
        'slot changed while attaching (scheduled or given another video); re-check it',
    };
  }
  return { outcome: 'attached', postId: post.id };
}
