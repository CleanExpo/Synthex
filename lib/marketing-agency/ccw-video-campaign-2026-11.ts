/**
 * CCW 4-week short-form video campaign (SYN-1404), 16/11/2026 to 11/12/2026.
 *
 * The plan data lives beside this file (ccw-video-campaign-2026-11.calendar.json;
 * docs/ is excluded from the Vercel upload). Scripts and the pack are in
 * docs/campaigns/ccw-2026-11-video/. This module
 * is the funnel wiring for it, following the CCW EOFY pattern
 * (ccw-eofy-calendar.ts): it validates the plan, builds every outbound link
 * through the canonical UTM builder, and turns each slot into a draft
 * CalendarPost payload. Drafts are blocked from external publishing and wait
 * for Phill's batch approval; nothing here publishes or writes to a database.
 *
 * Measurement: every link carries utm_campaign=ccw-video-2026-11 and
 * utm_content=<video id>, so visits and enquiries on ccwonline.com.au can be
 * traced to the exact video and channel.
 */

import { z } from 'zod';
import { buildUtmUrl } from '@/lib/utm/build-utm-url';
import calendar from './ccw-video-campaign-2026-11.calendar.json';

export const CCW_VIDEO_CAMPAIGN_SLUG = 'ccw-video-2026-11';
export const CCW_VIDEO_CAMPAIGN_NAME = 'CCW Storm-Ready Video Campaign 2026';
export const CCW_VIDEO_UTM_MEDIUM = 'organic_social';
/** CCW's live shop. ccwarehouse.com.au is email only (teardown, 08/11/2026). */
export const CCW_LANDING_ORIGIN = 'https://ccwonline.com.au';

const CHANNELS = ['instagram', 'facebook', 'youtube', 'linkedin'] as const;
export type CcwVideoChannel = (typeof CHANNELS)[number];

const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export const ccwVideoSlotSchema = z.object({
  id: z.string().regex(/^ccw-w[1-4]-d[1-5]-(am|pm)$/),
  slotKey: z.string().regex(/^\d{4}-\d{2}-\d{2}-ccw-video-[12]$/),
  date: z.string().regex(ddmmyyyy),
  weekday: z.string().min(1),
  slotAest: z.enum(['07:00', '17:30']),
  week: z.number().int().min(1).max(4),
  funnelStage: z.enum([
    'awareness',
    'consideration',
    'conversion',
    'retention',
  ]),
  theme: z.string().min(1),
  title: z.string().min(1),
  hook: z.string().min(1),
  message: z.string().min(1),
  products: z.array(z.string().min(1)).min(1),
  referenceSubjects: z.array(z.string().min(1)).min(1),
  cta: z.string().min(1),
  channels: z.array(z.enum(CHANNELS)).min(1),
  landingBase: z
    .string()
    .url()
    .refine(
      u => u.startsWith(`${CCW_LANDING_ORIGIN}/`),
      'must be a ccwonline.com.au page'
    ),
  landingUrl: z.string().url(),
  lengthSeconds: z.number().positive().max(60),
  voice: z.string().min(1),
  status: z.string().min(1),
});

export type CcwVideoSlot = z.infer<typeof ccwVideoSlotSchema>;

/** Parsed once at import: a malformed plan fails loudly, never silently. */
export const ccwVideoSlots: CcwVideoSlot[] = z
  .array(ccwVideoSlotSchema)
  .length(40)
  .parse(calendar.videos);

/** The tracked link for one video on one channel. */
export function ccwVideoLink(
  slot: CcwVideoSlot,
  channel: CcwVideoChannel
): string {
  return buildUtmUrl(slot.landingBase, {
    source: channel,
    medium: CCW_VIDEO_UTM_MEDIUM,
    campaign: CCW_VIDEO_CAMPAIGN_SLUG,
    content: slot.id,
  });
}

/**
 * calendar_posts.scheduled_for is timestamp without time zone; like the EOFY
 * calendar, store the intended AEST wall-clock value.
 */
export function ccwVideoScheduledAt(slot: CcwVideoSlot): Date {
  const m = ddmmyyyy.exec(slot.date);
  if (!m) throw new Error(`bad date on ${slot.id}: ${slot.date}`);
  const [hour, minute] = slot.slotAest.split(':').map(Number);
  return new Date(
    Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), hour, minute, 0)
  );
}

export type CcwVideoDraft = {
  title: string;
  content: string;
  platforms: string[];
  status: 'draft';
  scheduledFor: Date;
  mediaUrls: string[];
  tags: string[];
  hashtags: string[];
  mentions: string[];
  organizationId: string;
  userId: string;
  campaignId: string;
  metadata: {
    slotKey: string;
    slotKind: 'shortform_video';
    calendarSlotId: string;
    campaignSlug: string;
    funnelStage: CcwVideoSlot['funnelStage'];
    hook: string;
    cta: string;
    products: string[];
    referenceSubjects: string[];
    links: Record<string, string>;
    scriptPath: string;
    externalPublishBlocked: true;
    approvalState: 'awaiting_phill_batch_approval';
    sdaPassed: false;
    toby: 'not_sent';
  };
};

/**
 * Draft CalendarPost payloads for the whole campaign. No media yet: the SDA
 * chain attaches a rendered video only after its gate passes, and the slot
 * stays a draft until Phill approves the batch.
 */
export function buildCcwVideoCalendarDrafts(ctx: {
  organizationId: string;
  userId: string;
  campaignId: string;
}): CcwVideoDraft[] {
  return ccwVideoSlots.map(slot => {
    const links = Object.fromEntries(
      slot.channels.map(ch => [ch, ccwVideoLink(slot, ch)])
    );
    return {
      title: slot.title,
      content: `${slot.hook}\n\n${slot.message}\n\n${slot.cta}: ${links[slot.channels[0]]}`,
      platforms: [...slot.channels],
      status: 'draft' as const,
      scheduledFor: ccwVideoScheduledAt(slot),
      mediaUrls: [],
      tags: [
        CCW_VIDEO_CAMPAIGN_SLUG,
        'ccw',
        'shortform-video',
        `week-${slot.week}`,
        slot.funnelStage,
      ],
      hashtags: [],
      mentions: [],
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      campaignId: ctx.campaignId,
      metadata: {
        slotKey: slot.slotKey,
        slotKind: 'shortform_video' as const,
        calendarSlotId: slot.id,
        campaignSlug: CCW_VIDEO_CAMPAIGN_SLUG,
        funnelStage: slot.funnelStage,
        hook: slot.hook,
        cta: slot.cta,
        products: slot.products,
        referenceSubjects: slot.referenceSubjects,
        links,
        scriptPath: `docs/campaigns/ccw-2026-11-video/scripts/${slot.id}.md`,
        externalPublishBlocked: true as const,
        approvalState: 'awaiting_phill_batch_approval' as const,
        sdaPassed: false as const,
        toby: 'not_sent' as const,
      },
    };
  });
}
