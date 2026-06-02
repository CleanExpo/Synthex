import prisma from '../lib/prisma';
import {
  CCW_EOFY_CAMPAIGN_NAME,
  CCW_EOFY_CAMPAIGN_SLUG,
  ccwEofyCampaignCalendar,
  ccwEofyScheduledAtUtc,
  ccwEofySourceUrls,
} from '../lib/marketing-agency/ccw-eofy-calendar';

async function main() {
  const ccw = await prisma.organization.findUnique({
    where: { slug: 'ccw' },
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
    })) ??
    (await prisma.user.findFirst({
      where: { email: { in: ownerEmails } },
      orderBy: { updatedAt: 'desc' },
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

  await prisma.calendarPost.deleteMany({
    where: {
      organizationId: ccw.id,
      campaignId: campaign.id,
      tags: { has: CCW_EOFY_CAMPAIGN_SLUG },
    },
  });

  const created = [];
  for (const slot of ccwEofyCampaignCalendar) {
    const scheduledFor = ccwEofyScheduledAtUtc(slot);
    const post = await prisma.calendarPost.create({
      data: {
        title: slot.title,
        content: `${slot.content}\n\n${slot.cta}`,
        platforms: slot.platforms,
        status: 'draft',
        scheduledFor,
        mediaUrls: [],
        tags: [CCW_EOFY_CAMPAIGN_SLUG, 'ccw', 'eofy', 'calendar-draft'],
        hashtags: slot.hashtags,
        mentions: [],
        campaignId: campaign.id,
        organizationId: ccw.id,
        userId: owner.id,
        metadata: {
          calendarSlotId: slot.id,
          campaignSlug: CCW_EOFY_CAMPAIGN_SLUG,
          campaignName: CCW_EOFY_CAMPAIGN_NAME,
          source: 'synthex-live-ccw-eofy-calendar',
          objective: slot.objective,
          assetBrief: slot.assetBrief,
          gate: slot.gate,
          sourceUrls: ccwEofySourceUrls,
          externalPublishBlocked: true,
          credentialGate:
            'Facebook, Instagram, LinkedIn, and Reddit credentials must be submitted and verified before external posting.',
          scheduledAest: `${slot.date} ${slot.timeAest} AEST`,
        },
      },
    });
    created.push({
      id: post.id,
      title: post.title,
      platforms: post.platforms,
      status: post.status,
      scheduledFor: post.scheduledFor.toISOString(),
    });
  }

  console.log(
    JSON.stringify(
      {
        campaignId: campaign.id,
        organizationId: ccw.id,
        calendarPostsCreated: created.length,
        posts: created,
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
