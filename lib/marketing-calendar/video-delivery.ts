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
import {
  PORTFOLIO_CALENDAR_TAG,
  buildPortfolioCalendar,
} from './portfolio-plan';
import {
  PORTFOLIO_BRANDS,
  PORTFOLIO_WEEK_STARTS,
  brandHits,
} from './portfolio-brands';
import { loadWorkspaceOrgs } from './workspace';

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
  | { outcome: 'conflict'; reason: string }
  | { outcome: 'refused'; reason: string };

export async function attachVideoToSlot(
  delivery: VideoDelivery
): Promise<DeliveryResult> {
  // The slot key must be in the plan, and its row must sit under that plan
  // brand's workspace org: a tagged row in any other org is never touched.
  const planned = buildPortfolioCalendar(
    PORTFOLIO_BRANDS,
    PORTFOLIO_WEEK_STARTS
  ).find(s => s.slotKey === delivery.slotKey);
  if (!planned) return { outcome: 'not_found' };
  // A caption is draft copy for this brand: its forbidden words never go in.
  const brand = PORTFOLIO_BRANDS.find(b => b.orgSlug === planned.orgSlug)!;
  const banned = brandHits(delivery.captionDraft ?? '', brand);
  if (banned.length > 0) {
    return {
      outcome: 'refused',
      reason: `caption names words this brand never uses: ${banned.join(', ')}`,
    };
  }
  // The membership read, the row lookup and the write run in one transaction
  // that first share-locks the brand org rows: a brand cannot be deleted,
  // deactivated or re-parented between the membership check and the write.
  try {
    return await prisma.$transaction(async tx => {
      const slugs = PORTFOLIO_BRANDS.map(b => b.orgSlug);
      await tx.$queryRaw`SELECT id FROM organizations WHERE slug = ANY(${slugs}) FOR SHARE`;
      const org = (await loadWorkspaceOrgs(tx)).get(planned.orgSlug);
      if (!org) return { outcome: 'not_found' };
      const matches = await tx.calendarPost.findMany({
        where: {
          organizationId: org.id,
          tags: { has: PORTFOLIO_CALENDAR_TAG },
          metadata: { path: ['slotKey'], equals: delivery.slotKey },
        },
        take: 2,
      });
      const post = matches[0];
      if (!post) return { outcome: 'not_found' };
      // Never pick one of two rows that claim the same slot.
      if (matches.length > 1) {
        return {
          outcome: 'conflict',
          reason:
            'more than one draft claims this slot key; resolve the duplicate first',
        };
      }

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

      // The checks above are repeated in the WHERE so they hold at write time,
      // and the row must be unchanged since the read (updatedAt), because the
      // metadata written is built from that read: a slot scheduled, re-keyed,
      // edited or filled by another delivery since then matches nothing and is
      // reported as a conflict.
      const { count } = await tx.calendarPost.updateMany({
        where: {
          id: post.id,
          organizationId: org.id,
          status: 'draft',
          mediaUrls: { isEmpty: true },
          tags: { has: PORTFOLIO_CALENDAR_TAG },
          updatedAt: post.updatedAt,
          AND: [
            { metadata: { path: ['slotKind'], equals: 'shortform_video' } },
            { metadata: { path: ['slotKey'], equals: delivery.slotKey } },
          ],
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
      // The brand rows are share-locked, so membership cannot change before
      // commit; re-checking it here keeps the write honest if that ever fails.
      if (!(await loadWorkspaceOrgs(tx)).has(planned.orgSlug)) {
        throw new LeftWorkspace();
      }
      return { outcome: 'attached', postId: post.id } as const;
    });
  } catch (error) {
    if (error instanceof LeftWorkspace) {
      return {
        outcome: 'conflict',
        reason: 'brand left the workspace during delivery',
      };
    }
    throw error;
  }
}

/** Thrown inside the delivery transaction to roll the write back. */
class LeftWorkspace extends Error {}
