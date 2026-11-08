/**
 * SYN-1404: load the CCW video campaign into Synthex as draft calendar slots.
 *
 * Dry run by default: prints what it would write and touches nothing.
 *   npx tsx scripts/apply-ccw-video-campaign-2026-11.ts
 * Write (needs Phill's approval first; production database):
 *   OWNER_EMAILS=... npx tsx scripts/apply-ccw-video-campaign-2026-11.ts --execute [--org ccw]
 *
 * Idempotent: slots whose slotKey already exists under this campaign are
 * skipped, never duplicated or deleted. Every draft is blocked from external
 * publishing and waits for batch approval.
 */

import prisma from '../lib/prisma';
import {
  CCW_VIDEO_CAMPAIGN_NAME,
  CCW_VIDEO_CAMPAIGN_SLUG,
  buildCcwVideoCalendarDrafts,
  ccwVideoSlots,
} from '../lib/marketing-agency/ccw-video-campaign-2026-11';
import { assertCalendarPostClean } from '../lib/marketing-calendar/prompt-guard';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const execute = process.argv.includes('--execute');
  // The CCW EOFY scripts use slug 'ccw'; portfolio-brand-configs names a
  // 'ccwarehouse' carve-out. Confirm the live slug before --execute.
  const orgSlug = arg('--org') ?? 'ccw';

  if (!execute) {
    const drafts = buildCcwVideoCalendarDrafts({
      organizationId: '<org>',
      userId: '<owner>',
      campaignId: '<campaign>',
    });
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          campaign: CCW_VIDEO_CAMPAIGN_NAME,
          orgSlug,
          slots: ccwVideoSlots.length,
          first: {
            slotKey: drafts[0].metadata.slotKey,
            scheduledFor: drafts[0].scheduledFor,
          },
          last: {
            slotKey: drafts[drafts.length - 1].metadata.slotKey,
            scheduledFor: drafts[drafts.length - 1].scheduledFor,
          },
        },
        null,
        2
      )
    );
    return;
  }

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) throw new Error(`Organisation not found for slug '${orgSlug}'`);

  const ownerEmails = (process.env.OWNER_EMAILS ?? '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);
  const owner = await prisma.user.findFirst({
    where: { email: { in: ownerEmails } },
    orderBy: { updatedAt: 'desc' },
  });
  if (!owner) throw new Error('No owner user found from OWNER_EMAILS');

  const campaign =
    (await prisma.campaign.findFirst({
      where: {
        organizationId: org.id,
        name: CCW_VIDEO_CAMPAIGN_NAME,
        deletedAt: null,
      },
    })) ??
    (await prisma.campaign.create({
      data: {
        name: CCW_VIDEO_CAMPAIGN_NAME,
        description:
          'SYN-1404: 40 short-form videos, 09/11/2026 to 04/12/2026. No charge to CCW this month.',
        platform: 'multi',
        status: 'draft',
        userId: owner.id,
        organizationId: org.id,
        content: {
          campaignSlug: CCW_VIDEO_CAMPAIGN_SLUG,
          slots: ccwVideoSlots.length,
        },
        settings: {
          publishEnabled: false,
          adSpendEnabled: false,
          requiresPhillBatchApproval: true,
        },
      },
    }));

  const existing = await prisma.calendarPost.findMany({
    where: {
      organizationId: org.id,
      campaignId: campaign.id,
      tags: { has: CCW_VIDEO_CAMPAIGN_SLUG },
    },
    select: { metadata: true },
  });
  const have = new Set(
    existing
      .map(p => (p.metadata as Record<string, unknown> | null)?.slotKey)
      .filter(Boolean)
  );

  let created = 0;
  for (const draft of buildCcwVideoCalendarDrafts({
    organizationId: org.id,
    userId: owner.id,
    campaignId: campaign.id,
  })) {
    if (have.has(draft.metadata.slotKey)) continue;
    assertCalendarPostClean(org.slug, draft);
    await prisma.calendarPost.create({ data: draft });
    created += 1;
  }

  console.log(
    JSON.stringify(
      {
        campaignId: campaign.id,
        organizationId: org.id,
        created,
        skipped: have.size,
      },
      null,
      2
    )
  );
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    // The dry run never opens a connection, so there is nothing to close.
    if (process.argv.includes('--execute')) return prisma.$disconnect();
  });
