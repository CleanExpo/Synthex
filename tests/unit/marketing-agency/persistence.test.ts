import {
  getMarketingAgencyCampaignForOrganization,
  listMarketingAgencyCampaignsForOrganization,
} from '@/lib/marketing-agency/persistence';

describe('marketing agency persistence ownership', () => {
  const delegate = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists campaign records only for the requested organization', async () => {
    delegate.findMany.mockResolvedValue([]);

    await listMarketingAgencyCampaignsForOrganization({
      prisma: { marketingAgencyCampaign: delegate },
      organizationId: 'org-a',
    });

    expect(delegate.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-a' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('reads one campaign by id and organization together', async () => {
    delegate.findFirst.mockResolvedValue(null);

    await getMarketingAgencyCampaignForOrganization({
      prisma: { marketingAgencyCampaign: delegate },
      organizationId: 'org-a',
      campaignId: 'campaign-1',
    });

    expect(delegate.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'campaign-1',
        organizationId: 'org-a',
      },
    });
  });
});
