import {
  persistGovernedSignalRun,
  recordMarketingAgencyOutcome,
} from '@/lib/marketing-agency/intelligence/signal-persistence';
import {
  convertSignalsToOpportunities,
  rankGovernedSignals,
  type GovernedSignal,
} from '@/lib/marketing-agency/intelligence/signal-ledger';

const governedSignal: GovernedSignal = {
  id: 'signal-apify-google-restoration-reporting-proof',
  source: {
    id: 'source-apify-google-restoration-reporting-proof',
    kind: 'search',
    label: 'Apify google intelligence',
    sourceUrl: 'https://example.com/restoration-reporting-proof',
    capturedAt: '2026-05-22T08:30:00.000Z',
    permissionContext: 'public',
  },
  capturedAt: '2026-05-22T08:30:00.000Z',
  business: 'Synthex',
  client: 'RestoreAssist',
  product: 'RestoreAssist reporting workflow',
  audienceSegment: 'Restoration business owners',
  narrative: 'Owners are searching for evidence-backed reporting proof',
  content:
    'Restoration operators are searching for field reporting software that turns site evidence into client-ready reports.',
  freshness: 0.95,
  confidence: 0.9,
  commercialImpact: 0.86,
  creativePotential: 0.8,
  risk: 0.12,
  status: 'captured',
  evidenceRefs: ['docs/marketing-agency/APIFY-LIVE-INTELLIGENCE-2026-05-16.md'],
};

function createPersistenceClient() {
  const signalRecords = new Map<string, { id: string; externalId: string; campaignId?: string }>();
  const opportunityRecords = new Map<string, { id: string; externalId: string; signalId: string }>();

  const client = {
    $transaction: jest.fn(async callback => callback(client)),
    marketingAgencySignal: {
      upsert: jest.fn(async (args: any) => {
        const record = {
          id: `db-${args.create.externalId}`,
          externalId: args.create.externalId,
          campaignId: args.create.campaignId,
        };
        signalRecords.set(args.create.externalId, record);
        return record;
      }),
      findUnique: jest.fn(async (args: any) => {
        return signalRecords.get(args.where.organizationId_externalId.externalId) ?? null;
      }),
    },
    marketingAgencyOpportunity: {
      upsert: jest.fn(async (args: any) => {
        const record = {
          id: `db-${args.create.externalId}`,
          externalId: args.create.externalId,
          signalId: args.create.signalId,
        };
        opportunityRecords.set(args.create.externalId, record);
        return record;
      }),
      findUnique: jest.fn(async (args: any) => {
        return opportunityRecords.get(args.where.organizationId_externalId.externalId) ?? null;
      }),
    },
    marketingAgencyOutcomeEvent: {
      upsert: jest.fn(),
      create: jest.fn(async (args: any) => ({ id: 'outcome-1', ...args.data })),
    },
  };

  return client;
}

describe('governed signal persistence', () => {
  it('upserts ranked signals with org scope, evidence, risk, and approval state', async () => {
    const client = createPersistenceClient();
    const rankedSignals = rankGovernedSignals([governedSignal]);

    const result = await persistGovernedSignalRun(
      {
        organizationId: 'org-restoreassist',
        campaignId: 'campaign-restoreassist',
        rankedSignals,
        opportunities: [],
        metadata: { runId: 'apify-run-1' },
      },
      client
    );

    expect(result).toEqual({ signalsPersisted: 1, opportunitiesPersisted: 0 });
    expect(client.marketingAgencySignal.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_externalId: {
            organizationId: 'org-restoreassist',
            externalId: governedSignal.id,
          },
        },
        create: expect.objectContaining({
          organizationId: 'org-restoreassist',
          campaignId: 'campaign-restoreassist',
          externalId: governedSignal.id,
          sourceKind: 'search',
          scoreTotal: rankedSignals[0].score.total,
          riskState: 'clear',
          approvalStatus: 'pass',
          evidenceRefs: governedSignal.evidenceRefs,
        }),
      })
    );
  });

  it('links persisted opportunities to the stored signal row', async () => {
    const client = createPersistenceClient();
    const rankedSignals = rankGovernedSignals([governedSignal]);
    const opportunities = convertSignalsToOpportunities([governedSignal]);

    const result = await persistGovernedSignalRun(
      {
        organizationId: 'org-restoreassist',
        rankedSignals,
        opportunities,
      },
      client
    );

    expect(result).toEqual({ signalsPersisted: 1, opportunitiesPersisted: 1 });
    expect(client.marketingAgencyOpportunity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          organizationId: 'org-restoreassist',
          signalId: `db-${governedSignal.id}`,
          externalId: opportunities[0].id,
          approvalStatus: 'pass',
          status: 'draft',
        }),
      })
    );
  });

  it('records outcome learning against a persisted signal and opportunity', async () => {
    const client = createPersistenceClient();
    const rankedSignals = rankGovernedSignals([governedSignal]);
    const opportunities = convertSignalsToOpportunities([governedSignal]);

    await persistGovernedSignalRun({
      organizationId: 'org-restoreassist',
      campaignId: 'campaign-restoreassist',
      rankedSignals,
      opportunities,
    }, client);

    await recordMarketingAgencyOutcome(
      {
        organizationId: 'org-restoreassist',
        signalExternalId: governedSignal.id,
        opportunityExternalId: opportunities[0].id,
        eventType: 'approval_reviewed',
        outcomeMetric: 'Validated opportunity converted into a reviewed campaign draft.',
        observedValue: 'approved_for_draft',
        confidence: 0.88,
      },
      client
    );

    expect(client.marketingAgencyOutcomeEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-restoreassist',
        campaignId: 'campaign-restoreassist',
        signalId: `db-${governedSignal.id}`,
        opportunityId: `db-${opportunities[0].id}`,
        eventType: 'approval_reviewed',
        observedValue: 'approved_for_draft',
      }),
    });
  });

  it('rejects outcome learning when an opportunity external ID is missing', async () => {
    const client = createPersistenceClient();
    const rankedSignals = rankGovernedSignals([governedSignal]);
    const opportunities = convertSignalsToOpportunities([governedSignal]);

    await persistGovernedSignalRun({
      organizationId: 'org-restoreassist',
      campaignId: 'campaign-restoreassist',
      rankedSignals,
      opportunities,
    }, client);

    await expect(
      recordMarketingAgencyOutcome(
        {
          organizationId: 'org-restoreassist',
          signalExternalId: governedSignal.id,
          opportunityExternalId: 'missing-opportunity',
          eventType: 'approval_reviewed',
        },
        client
      )
    ).rejects.toThrow('Cannot record outcome for missing opportunity');

    expect(client.marketingAgencyOutcomeEvent.create).not.toHaveBeenCalled();
  });

  it('rejects outcome learning when the opportunity belongs to another signal', async () => {
    const client = createPersistenceClient();
    const secondSignal: GovernedSignal = {
      ...governedSignal,
      id: 'signal-apify-google-restoration-proof-second',
      content:
        'Restoration teams are also comparing reporting workflows for insurer-ready site evidence.',
    };
    const rankedSignals = rankGovernedSignals([governedSignal, secondSignal]);
    const opportunities = convertSignalsToOpportunities([
      governedSignal,
      secondSignal,
    ]);

    await persistGovernedSignalRun({
      organizationId: 'org-restoreassist',
      campaignId: 'campaign-restoreassist',
      rankedSignals,
      opportunities,
    }, client);

    const secondOpportunity = opportunities.find(
      opportunity => opportunity.signalId === secondSignal.id
    );
    expect(secondOpportunity).toBeDefined();

    await expect(
      recordMarketingAgencyOutcome(
        {
          organizationId: 'org-restoreassist',
          signalExternalId: governedSignal.id,
          opportunityExternalId: secondOpportunity!.id,
          eventType: 'approval_reviewed',
        },
        client
      )
    ).rejects.toThrow('linked to a different signal');

    expect(client.marketingAgencyOutcomeEvent.create).not.toHaveBeenCalled();
  });

  it('rejects governed signals with malformed capturedAt timestamps', async () => {
    const client = createPersistenceClient();
    const malformedSignal: GovernedSignal = {
      ...governedSignal,
      id: 'signal-malformed-captured-at',
      capturedAt: 'not-a-date',
    };

    await expect(
      persistGovernedSignalRun(
        {
          organizationId: 'org-restoreassist',
          rankedSignals: rankGovernedSignals([malformedSignal]),
          opportunities: [],
        },
        client
      )
    ).rejects.toThrow('Invalid governed signal capturedAt timestamp');

    expect(client.marketingAgencySignal.upsert).not.toHaveBeenCalled();
  });
});
