import prisma from '../lib/prisma';
import { seedPublishQueue } from '../lib/publish/publishQueue';
import type { ContentCalendarData } from '../lib/calendar/types';
import {
  CCW_EOFY_CAMPAIGN_NAME,
  CCW_EOFY_CAMPAIGN_SLUG,
} from '../lib/marketing-agency/ccw-eofy-calendar';
import {
  buildCcwEofyPublishingWeeks,
  buildCcwEofyPublishingCampaignMetadata,
  isCcwEofyPublishingSlot,
} from '../lib/marketing-agency/ccw-eofy-publishing-package';

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function mergeCalendarData(
  existing: unknown,
  next: ContentCalendarData
): ContentCalendarData {
  const existingData = asRecord(existing) as Partial<ContentCalendarData>;
  const existingSlots = Array.isArray(existingData.slots)
    ? existingData.slots.filter(slot => !isCcwEofyPublishingSlot(slot))
    : [];

  return {
    ...next,
    slots: [...existingSlots, ...next.slots],
  };
}

async function main() {
  const ccw = await prisma.organization.findUnique({
    where: { slug: 'ccw' },
    select: { id: true, name: true, slug: true },
  });
  if (!ccw) throw new Error('CCW organization not found');

  const ownerEmails = (process.env.OWNER_EMAILS ?? '')
    .split(',')
    .map(email => email.trim())
    .filter(Boolean);

  const owner =
    (await prisma.user.findFirst({
      where: {
        email: { in: ownerEmails },
        activeOrganizationId: ccw.id,
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, email: true, name: true },
    })) ??
    (await prisma.user.findFirst({
      where: { email: { in: ownerEmails } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, email: true, name: true },
    }));
  if (!owner) throw new Error('No owner user found from OWNER_EMAILS');

  const campaign = await prisma.campaign.findFirst({
    where: {
      organizationId: ccw.id,
      name: CCW_EOFY_CAMPAIGN_NAME,
      deletedAt: null,
    },
    orderBy: { updatedAt: 'desc' },
  });
  if (!campaign) {
    throw new Error(`Campaign not found: ${CCW_EOFY_CAMPAIGN_NAME}`);
  }

  const approvedAt = new Date().toISOString();
  const weeks = buildCcwEofyPublishingWeeks({
    campaignId: campaign.id,
    approvedBy: owner.email,
    approvedAt,
  });

  const outputs = [];

  for (const week of weeks) {
    const existing = await prisma.contentCalendar.findUnique({
      where: {
        organizationId_weekStart: {
          organizationId: ccw.id,
          weekStart: week.weekStart,
        },
      },
      select: { id: true, slots: true },
    });

    const mergedData = mergeCalendarData(existing?.slots, week.data);
    const calendar = await prisma.contentCalendar.upsert({
      where: {
        organizationId_weekStart: {
          organizationId: ccw.id,
          weekStart: week.weekStart,
        },
      },
      create: {
        organizationId: ccw.id,
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
        status: 'approved',
        signalsVersion: week.data.signalsVersion,
        slots: mergedData,
      },
      update: {
        weekEnd: week.weekEnd,
        status: 'approved',
        signalsVersion: week.data.signalsVersion,
        slots: mergedData,
      },
      select: { id: true, weekStart: true, weekEnd: true, slots: true },
    });

    const slotIds = week.data.slots.map(slot => slot.id);
    await prisma.publishQueueItem.deleteMany({
      where: {
        organizationId: ccw.id,
        calendarId: calendar.id,
        slotId: { in: slotIds },
        status: { in: ['pending', 'failed', 'held'] },
      },
    });

    const seeded = await seedPublishQueue(calendar.id, ccw.id);
    const queued = await prisma.publishQueueItem.findMany({
      where: {
        organizationId: ccw.id,
        calendarId: calendar.id,
        slotId: { in: slotIds },
      },
      select: {
        id: true,
        slotId: true,
        platform: true,
        scheduledAt: true,
        status: true,
      },
      orderBy: [{ scheduledAt: 'asc' }, { platform: 'asc' }],
    });

    outputs.push({
      calendarId: calendar.id,
      weekStart: calendar.weekStart.toISOString().slice(0, 10),
      weekEnd: calendar.weekEnd.toISOString().slice(0, 10),
      packageSlots: slotIds.length,
      seeded,
      queued: queued.map(item => ({
        ...item,
        scheduledAt: item.scheduledAt.toISOString(),
      })),
    });
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      settings: {
        ...asRecord(campaign.settings),
        ...buildCcwEofyPublishingCampaignMetadata({
          campaignId: campaign.id,
          approvedBy: owner.email,
          approvedAt,
          contentCalendars: outputs.map(output => ({
            calendarId: output.calendarId,
            weekStart: output.weekStart,
            weekEnd: output.weekEnd,
            slots: output.packageSlots,
          })),
          publishQueueItems: outputs.reduce(
            (total, output) => total + output.queued.length,
            0
          ),
        }),
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        success: true,
        organization: ccw.slug,
        campaignId: campaign.id,
        campaignName: campaign.name,
        weeks: outputs,
      },
      null,
      2
    )
  );
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
