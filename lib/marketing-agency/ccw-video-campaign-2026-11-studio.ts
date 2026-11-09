/**
 * SYN-1404: CCW's review portal. Each finished campaign video becomes one draft
 * on the CCW studio board (/dashboard/marketing-agency/ccw/studio), where Toby
 * watches it and signs it off.
 *
 * Sign-off only. A draft is saved with NO platforms, so the studio's Approve
 * (approveAndScheduleStudioDraft) records who approved and when and schedules
 * nothing: a draft with no cron-eligible platform commits as `approved` with
 * no Post, and the organisation publish gate is never reached. Posting stays
 * with CCW and Phill's batch approval. The channels the video is planned for
 * travel in metadata, where nothing reads them as publish targets.
 */

import type { Prisma } from '@prisma/client';
import type { SaveStudioDraftInput } from '@/lib/marketing-agency/studio/draft-store';
import {
  CCW_VIDEO_CAMPAIGN_SLUG,
  ccwVideoLink,
  type CcwVideoSlot,
} from './ccw-video-campaign-2026-11';

export const CCW_STUDIO_CLIENT_SLUG = 'ccw';

/** Private bucket the review copies live in (existing, mp4 allowed). */
export const CCW_REVIEW_BUCKET = 'media-uploads';

/** Signed review links outlive the four-week campaign (09/11 to 04/12/2026). */
export const CCW_REVIEW_LINK_TTL_SECONDS = 35 * 24 * 60 * 60;

export interface CcwReviewVideo {
  /** Signed URL of the delivery copy. */
  videoUrl: string;
  /** Finalised spoken script, so the card shows what the video says. */
  voiceover: string;
  /** Path inside CCW_REVIEW_BUCKET. */
  storagePath: string;
  sha256: string;
  bytes: number;
}

/** Storage path for one video's review copy. */
export function ccwReviewStoragePath(slot: Pick<CcwVideoSlot, 'id'>): string {
  return `ccw/${CCW_VIDEO_CAMPAIGN_SLUG}/${slot.id}-delivery.mp4`;
}

/** DD/MM/YYYY + HH:MM AEST to an ISO instant (Queensland, UTC+10, no DST). */
export function ccwPostAtIso(
  slot: Pick<CcwVideoSlot, 'date' | 'slotAest'>
): string {
  const [dd, mm, yyyy] = slot.date.split('/');
  return `${yyyy}-${mm}-${dd}T${slot.slotAest}:00+10:00`;
}

export function buildCcwStudioDraft(
  slot: CcwVideoSlot,
  organizationId: string,
  video: CcwReviewVideo
): SaveStudioDraftInput {
  // Scripts sit outside the type-check, so a missing value must stop here.
  if (!video.voiceover?.trim()) {
    throw new Error(`${slot.id}: no finalised voiceover for the sign-off card`);
  }
  const links = Object.fromEntries(
    slot.channels.map(channel => [channel, ccwVideoLink(slot, channel)])
  );
  const metadata: Prisma.InputJsonObject = {
    campaign: CCW_VIDEO_CAMPAIGN_SLUG,
    linear: 'SYN-1404',
    videoId: slot.id,
    slotKey: slot.slotKey,
    review: 'client_sign_off',
    postAt: ccwPostAtIso(slot),
    plannedChannels: slot.channels,
    links,
    storageBucket: CCW_REVIEW_BUCKET,
    storagePath: video.storagePath,
    sha256: video.sha256,
    bytes: video.bytes,
  };
  return {
    organizationId,
    clientSlug: CCW_STUDIO_CLIENT_SLUG,
    topic: `${slot.weekday} ${slot.date}, ${slot.slotAest}: ${slot.title}`,
    // Never the calendar's hook and message: those are the first draft and
    // some lines changed in review. The client signs off these words.
    script: [video.voiceover, `${slot.cta}: ${slot.landingBase}`].join('\n\n'),
    // Sign-off only: no platform means Approve can never schedule a post.
    platforms: [],
    videoProvider: 'remotion',
    videoUrl: video.videoUrl,
    dedupeKey: slot.id,
    metadata,
  };
}
