import { listMarketingAgencyOpportunities } from '@/lib/marketing-agency/intelligence/opportunity-reader';

describe('marketing agency opportunity reader', () => {
  it('returns org-scoped governed opportunities ordered for review', async () => {
    const findMany = jest.fn(async () => [
      {
        id: 'opportunity-db-1',
        externalId: 'opportunity-signal-1',
        title: 'Lead with proof before workflow detail',
        recommendation: 'Open the campaign with reporting proof.',
        score: 88,
        confidence: 0.91,
        risk: 0.12,
        status: 'draft',
        approvalStatus: 'pass',
        blockedReasons: [],
        warnings: ['Keep claim evidence attached.'],
        evidenceRefs: ['docs/marketing-agency/source.md'],
        nextAction: 'Draft a proof-led creative variant.',
        outcomeMetric: 'Approval rate on proof-led creative.',
        createdAt: new Date('2026-05-22T08:00:00.000Z'),
        signal: {
          externalId: 'signal-1',
          sourceKind: 'search',
          sourceLabel: 'Apify Google intelligence',
          capturedAt: new Date('2026-05-22T07:30:00.000Z'),
          scoreTotal: 0.88,
          riskState: 'clear',
        },
      },
    ]);

    const result = await listMarketingAgencyOpportunities(
      { organizationId: 'org-restoreassist', limit: 5 },
      { marketingAgencyOpportunity: { findMany } }
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-restoreassist' },
        take: 5,
        orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      })
    );
    expect(result).toEqual([
      expect.objectContaining({
        id: 'opportunity-db-1',
        score: 88,
        approvalStatus: 'pass',
        evidenceRefs: ['docs/marketing-agency/source.md'],
        warnings: ['Keep claim evidence attached.'],
        createdAt: '2026-05-22T08:00:00.000Z',
        signal: expect.objectContaining({
          externalId: 'signal-1',
          riskState: 'clear',
        }),
      }),
    ]);
  });

  it('clamps the requested limit to the public API maximum', async () => {
    const findMany = jest.fn(async () => []);

    await listMarketingAgencyOpportunities(
      { organizationId: 'org-restoreassist', limit: 999 },
      { marketingAgencyOpportunity: { findMany } }
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
      })
    );
  });
});
