import type {
  CalendarPlatform,
  CalendarSlot,
  ContentCalendarData,
} from '@/lib/calendar/types';
import {
  CAMPAIGN_AUTHORITY_MANIFEST_KEY,
  type CampaignEvidenceManifest,
} from './campaign-authority-manifest';
import { assertCampaignPublishable } from './publish-gate';
import {
  CCW_EOFY_CAMPAIGN_SLUG,
  ccwEofyCampaignCalendar,
  ccwEofyScheduledAtUtc,
  type CcwEofyCalendarSlot,
} from './ccw-eofy-calendar';
import { buildCcwEofyCampaignAuthorityManifest } from './ccw-eofy-authority-manifest';

export const CCW_EOFY_PUBLISHING_SIGNALS_VERSION =
  'ccw-eofy-sales-2026-approved-v1';

export interface CcwEofyPublishingPackageInput {
  campaignId: string;
  approvedBy: string;
  approvedAt?: string;
}

export interface CcwEofyPublishingWeek {
  weekStart: Date;
  weekEnd: Date;
  data: ContentCalendarData;
}

export interface CcwEofyPublishingCalendarSummary {
  calendarId: string;
  weekStart: string;
  weekEnd: string;
  slots: number;
}

export interface CcwEofyPublishingCampaignMetadataInput
  extends CcwEofyPublishingPackageInput {
  contentCalendars: CcwEofyPublishingCalendarSummary[];
  publishQueueItems: number;
}

type CcwEofyPublishingSlot = CalendarSlot & {
  status: 'approved';
  selectedCaption: 0;
  title: string;
  sourceSlotId: string;
  campaignSlug: string;
  campaignId: string;
  objective: string;
  cta: string;
  assetBrief: string;
  approvalGate: string;
  platformPackage: true;
  publishGate: ReturnType<typeof assertCampaignPublishable>;
  [CAMPAIGN_AUTHORITY_MANIFEST_KEY]: CampaignEvidenceManifest;
};

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseCampaignDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function ccwEofyWeekStart(date: string): Date {
  const parsed = parseCampaignDate(date);
  const mondayIndexedDay = (parsed.getUTCDay() + 6) % 7;
  return addDays(parsed, -mondayIndexedDay);
}

function ccwEofyDayOfWeek(date: string): number {
  return (parseCampaignDate(date).getUTCDay() + 6) % 7;
}

function normalisePlatform(platform: string): CalendarPlatform {
  return platform.trim().toLowerCase() as CalendarPlatform;
}

function buildPlatformSlot(
  slot: CcwEofyCalendarSlot,
  platform: string,
  input: Required<CcwEofyPublishingPackageInput>
): CcwEofyPublishingSlot {
  const normalisedPlatform = normalisePlatform(platform);
  const manifest = buildCcwEofyCampaignAuthorityManifest({
    campaignId: input.campaignId,
    approvedBy: input.approvedBy,
    approvedAt: input.approvedAt,
    humanApproved: true,
  });
  const publishGate = assertCampaignPublishable({
    manifest,
    platforms: [normalisedPlatform],
    requestedAction: 'ccw_eofy_schedule_platform_package',
  });

  return {
    id: `${slot.id}-${normalisedPlatform}`,
    dayOfWeek: ccwEofyDayOfWeek(slot.date),
    scheduledAt: ccwEofyScheduledAtUtc(slot).toISOString(),
    platform: normalisedPlatform,
    captions: [`${slot.content}\n\n${slot.cta}`],
    hashtags: slot.hashtags,
    contentType: 'promotional',
    status: 'approved',
    selectedCaption: 0,
    title: slot.title,
    sourceSlotId: slot.id,
    campaignSlug: CCW_EOFY_CAMPAIGN_SLUG,
    campaignId: input.campaignId,
    objective: slot.objective,
    cta: slot.cta,
    assetBrief: slot.assetBrief,
    approvalGate: slot.gate,
    platformPackage: true,
    [CAMPAIGN_AUTHORITY_MANIFEST_KEY]: manifest,
    publishGate,
  };
}

export function buildCcwEofyPublishingWeeks(
  input: CcwEofyPublishingPackageInput
): CcwEofyPublishingWeek[] {
  const approvedAt = input.approvedAt ?? new Date().toISOString();
  const resolvedInput: Required<CcwEofyPublishingPackageInput> = {
    ...input,
    approvedAt,
  };
  const weeks = new Map<string, CcwEofyPublishingWeek>();

  for (const campaignSlot of ccwEofyCampaignCalendar) {
    const weekStart = ccwEofyWeekStart(campaignSlot.date);
    const key = dateOnly(weekStart);
    const weekEnd = addDays(weekStart, 6);

    if (!weeks.has(key)) {
      weeks.set(key, {
        weekStart,
        weekEnd,
        data: {
          weekStart: dateOnly(weekStart),
          weekEnd: dateOnly(weekEnd),
          slots: [],
          signalsVersion: CCW_EOFY_PUBLISHING_SIGNALS_VERSION,
          digestCount: ccwEofyCampaignCalendar.length,
        },
      });
    }

    const week = weeks.get(key);
    if (!week) continue;

    for (const platform of campaignSlot.platforms) {
      week.data.slots.push(
        buildPlatformSlot(campaignSlot, platform, resolvedInput)
      );
    }
  }

  return Array.from(weeks.values()).sort(
    (a, b) => a.weekStart.getTime() - b.weekStart.getTime()
  );
}

export function buildCcwEofyPublishingCampaignMetadata(
  input: CcwEofyPublishingCampaignMetadataInput
): Record<string, unknown> {
  const approvedAt = input.approvedAt ?? new Date().toISOString();
  const manifest = buildCcwEofyCampaignAuthorityManifest({
    campaignId: input.campaignId,
    approvedBy: input.approvedBy,
    approvedAt,
    humanApproved: true,
  });
  const publishGate = assertCampaignPublishable({
    manifest,
    platforms: Array.from(
      new Set(ccwEofyCampaignCalendar.flatMap(slot => slot.platforms))
    ),
    requestedAction: 'ccw_eofy_schedule_platform_package',
  });

  return {
    [CAMPAIGN_AUTHORITY_MANIFEST_KEY]: manifest,
    publishGate,
    ccwEofyPublishingPackage: {
      status: 'scheduled',
      campaignSlug: CCW_EOFY_CAMPAIGN_SLUG,
      approvedBy: input.approvedBy,
      approvedAt,
      contentCalendars: input.contentCalendars,
      publishQueueItems: input.publishQueueItems,
      externalPublishing:
        'Approval-gated package queued. Live publishing still requires platform credentials, live calendar mode, subscription, due time, and publish safety checks.',
    },
  };
}

export function isCcwEofyPublishingSlot(slot: unknown): boolean {
  if (!slot || typeof slot !== 'object' || Array.isArray(slot)) return false;
  const record = slot as Record<string, unknown>;
  return (
    record.campaignSlug === CCW_EOFY_CAMPAIGN_SLUG ||
    (typeof record.id === 'string' &&
      record.id.startsWith(`${CCW_EOFY_CAMPAIGN_SLUG}-`))
  );
}
