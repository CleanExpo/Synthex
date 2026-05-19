export interface MarketingAgencyCampaignRecord {
  id: string;
  organizationId: string;
  createdById: string;
  name: string;
  slug: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CampaignDelegate {
  findMany(args: {
    where: { organizationId: string };
    orderBy: { createdAt: 'desc' };
  }): Promise<MarketingAgencyCampaignRecord[]>;
  findFirst(args: {
    where: { id: string; organizationId: string };
  }): Promise<MarketingAgencyCampaignRecord | null>;
}

export interface MarketingAgencyPrisma {
  marketingAgencyCampaign: CampaignDelegate;
}

export async function listMarketingAgencyCampaignsForOrganization({
  prisma,
  organizationId,
}: {
  prisma: MarketingAgencyPrisma;
  organizationId: string;
}) {
  return prisma.marketingAgencyCampaign.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getMarketingAgencyCampaignForOrganization({
  prisma,
  organizationId,
  campaignId,
}: {
  prisma: MarketingAgencyPrisma;
  organizationId: string;
  campaignId: string;
}) {
  return prisma.marketingAgencyCampaign.findFirst({
    where: {
      id: campaignId,
      organizationId,
    },
  });
}
