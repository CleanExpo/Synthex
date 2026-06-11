import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

type OwnedSocialPageConfig = {
  slug: string;
  socialHandles: Record<string, string>;
  allowedProfileIds: Record<string, string[]>;
  blockedCrossBrandProfiles?: Record<string, string[]>;
};

const SOCIAL_PUBLISH_PLATFORMS = [
  'facebook',
  'instagram',
  'linkedin',
  'reddit',
  'youtube',
];

const CLIENTS: OwnedSocialPageConfig[] = [
  {
    slug: 'carsi',
    socialHandles: {
      facebook: 'https://www.facebook.com/carsiaus',
      instagram: 'https://www.instagram.com/carsi_aus',
      linkedin: 'https://www.linkedin.com/company/carsiaus',
      youtube: 'https://www.youtube.com/@CARSIAustralia',
    },
    allowedProfileIds: {
      facebook: ['107529017631636'],
      instagram: ['carsi_aus'],
      youtube: ['@carsi6767'],
    },
  },
  {
    slug: 'disaster-recovery',
    socialHandles: {
      facebook: 'https://www.facebook.com/disasterrecoveryau',
    },
    allowedProfileIds: {
      facebook: ['246603068727802'],
    },
    blockedCrossBrandProfiles: {
      instagram: ['nrpgaustralia'],
      linkedin: ['nrpg-australia'],
      twitter: ['NRPGAustralia'],
    },
  },
  {
    slug: 'restoreassist',
    socialHandles: {},
    allowedProfileIds: {},
  },
  {
    slug: 'ccw',
    socialHandles: {},
    allowedProfileIds: {},
  },
];

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function socialProfilesFromHandles(
  socialHandles: Record<string, string>
): Prisma.InputJsonArray {
  return Object.entries(socialHandles).map(([platform, url]) => ({
    platform,
    url,
    verified: true,
    source: 'synthex-owned-page-policy',
  }));
}

function ownedPagePolicy(config: OwnedSocialPageConfig) {
  return {
    ownPageOnly: true,
    managedThroughSynthexOnly: true,
    organicOnly: true,
    adSpendEnabled: false,
    directPlatformRoutesDisabled: true,
    allowedProfileIds: config.allowedProfileIds,
    allowedPageUrls: config.socialHandles,
    blockedCrossBrandProfiles: config.blockedCrossBrandProfiles ?? {},
    updatedAt: new Date().toISOString(),
  };
}

async function enforceClient(config: OwnedSocialPageConfig) {
  const org = await prisma.organization.findUnique({
    where: { slug: config.slug },
    select: {
      id: true,
      slug: true,
      name: true,
      settings: true,
      website: true,
      brandDna: { select: { id: true } },
    },
  });
  if (!org) throw new Error(`Organization not found: ${config.slug}`);

  const existingSettings = asRecord(org.settings);
  const policy = ownedPagePolicy(config);
  await prisma.organization.update({
    where: { id: org.id },
    data: {
      socialHandles: config.socialHandles,
      settings: {
        ...existingSettings,
        socialPublishing: {
          ...asRecord(existingSettings.socialPublishing),
          ...policy,
        },
      },
    },
  });

  if (org.brandDna) {
    await prisma.brandDNA.update({
      where: { organizationId: org.id },
      data: {
        socialProfiles: [
          {
            platform: 'website',
            url: org.website ?? '',
            verified: Boolean(org.website),
            source: 'synthex-owned-page-policy',
          },
          ...socialProfilesFromHandles(config.socialHandles),
        ],
      },
    });
  }

  const connections = await prisma.platformConnection.findMany({
    where: {
      organizationId: org.id,
      platform: { in: SOCIAL_PUBLISH_PLATFORMS },
      deletedAt: null,
    },
    select: {
      id: true,
      platform: true,
      profileId: true,
      profileName: true,
      accountType: true,
      isActive: true,
      metadata: true,
    },
  });

  const connectionUpdates = [];
  for (const connection of connections) {
    const allowedIds = config.allowedProfileIds[connection.platform] ?? [];
    const isBusinessAccount = ['business', 'business_page', 'company'].includes(
      connection.accountType
    );
    const isAllowlisted =
      Boolean(connection.profileId) &&
      allowedIds.includes(connection.profileId!);
    const publishAllowed = isBusinessAccount && isAllowlisted;

    const metadata = {
      ...asRecord(connection.metadata),
      ownedPagePolicy: {
        ownPageOnly: true,
        managedThroughSynthexOnly: true,
        profileAllowlisted: isAllowlisted,
        accountTypeAllowed: isBusinessAccount,
        publishReadiness: publishAllowed ? 'eligible' : 'blocked',
        checkedAt: new Date().toISOString(),
      },
      publishReadiness: publishAllowed ? 'eligible' : 'blocked',
    };

    await prisma.platformConnection.update({
      where: { id: connection.id },
      data: {
        metadata,
        isActive: publishAllowed ? connection.isActive : false,
      },
    });

    connectionUpdates.push({
      platform: connection.platform,
      profileName: connection.profileName,
      profileId: connection.profileId,
      publishAllowed,
    });
  }

  const campaigns = await prisma.marketingAgencyCampaign.findMany({
    where: { organizationId: org.id },
    select: { id: true, slug: true, metadata: true },
  });
  for (const campaign of campaigns) {
    await prisma.marketingAgencyCampaign.update({
      where: { id: campaign.id },
      data: {
        metadata: {
          ...asRecord(campaign.metadata),
          ownedPagePolicy: policy,
        },
      },
    });
  }

  return {
    slug: org.slug,
    socialHandles: config.socialHandles,
    allowedProfileIds: config.allowedProfileIds,
    connections: connectionUpdates,
    campaignsUpdated: campaigns.length,
  };
}

async function main() {
  const requested = process.argv
    .filter(arg => arg.startsWith('--client='))
    .map(arg => arg.replace('--client=', ''));
  const configs =
    requested.length > 0
      ? CLIENTS.filter(client => requested.includes(client.slug))
      : CLIENTS;
  if (configs.length === 0) {
    throw new Error(`No matching clients for ${requested.join(', ')}`);
  }

  const results = [];
  for (const config of configs) {
    results.push(await enforceClient(config));
  }
  console.log(JSON.stringify({ success: true, results }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
