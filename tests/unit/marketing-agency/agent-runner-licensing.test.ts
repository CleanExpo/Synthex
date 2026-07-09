/**
 * Unit tests for Artlist asset auto-licensing in the agent runner (SYN-979).
 *
 * Stubs prisma (incl. marketingAgencyAsset), the opportunity reader, and passes
 * a mocked AssetLicenser so no live Artlist call is made.
 *
 * Asserts:
 *   - An opportunity whose creative needs audio/video triggers a licence request
 *   - A MarketingAgencyAsset row is persisted at licenceStatus='pending'
 *   - The QA report surfaces the requested assets (metadata.assetsRequested)
 *   - The run artifacts carry the licensed assets
 *   - A licensing failure is recorded as a blocked check WITHOUT failing the run
 *     or blocking claim proposal
 */

const findUnique = jest.fn();
const updateAgent = jest.fn();
const createRun = jest.fn();
const updateRun = jest.fn();
const createClaim = jest.fn();
const createAsset = jest.fn();
const createQaReport = jest.fn();
const findFirstCampaign = jest.fn();
const createCampaign = jest.fn();
const listOpportunities = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    marketingAgent: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => updateAgent(...args),
    },
    marketingAgentRun: {
      create: (...args: unknown[]) => createRun(...args),
      update: (...args: unknown[]) => updateRun(...args),
    },
    marketingAgencyClaim: {
      create: (...args: unknown[]) => createClaim(...args),
    },
    marketingAgencyAsset: {
      create: (...args: unknown[]) => createAsset(...args),
    },
    marketingAgencyQaReport: {
      create: (...args: unknown[]) => createQaReport(...args),
    },
    marketingAgencyCampaign: {
      findFirst: (...args: unknown[]) => findFirstCampaign(...args),
      create: (...args: unknown[]) => createCampaign(...args),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('@/lib/marketing-agency/intelligence/opportunity-reader', () => ({
  listMarketingAgencyOpportunities: (...args: unknown[]) => listOpportunities(...args),
}));

jest.mock('@/lib/ai/openrouter-client', () => ({
  openRouterClient: {
    models: { creative: 'anthropic/claude-sonnet-4-6' },
    complete: jest.fn(),
  },
}));

import { runAgent, type ClaimProposer, type AssetLicenser } from '@/lib/marketing-agency/agent/runner';

const stubProposer: ClaimProposer = {
  async propose(input) {
    return {
      statement: `Claim for ${input.opportunityTitle}`,
      claimType: 'observation',
      evidenceNotes: 'Needs a primary source link',
      warnings: [],
    };
  },
};

describe('runAgent — Artlist asset auto-licensing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findUnique.mockResolvedValue({
      id: 'agent-1',
      organizationId: 'org-1',
      status: 'active',
      name: 'Test Agent',
      goal: 'Grow DR LinkedIn presence',
      maxClaimsPerRun: 3,
      config: null,
    });
    createRun.mockResolvedValue({ id: 'run-1' });
    updateRun.mockImplementation(async ({ where, data }) => ({ id: where.id, ...data }));
    updateAgent.mockResolvedValue({ id: 'agent-1' });
    createClaim.mockImplementation(async ({ data }) => ({ id: `claim-${data.statement.slice(0, 8)}` }));
    createAsset.mockImplementation(async () => ({ id: 'asset-1' }));
    createQaReport.mockResolvedValue({ id: 'qa-1' });
    findFirstCampaign.mockResolvedValue(null);
    createCampaign.mockResolvedValue({ id: 'campaign-1' });
    listOpportunities.mockResolvedValue([
      {
        id: 'op-video',
        title: 'Launch a LinkedIn reel for DR',
        recommendation: 'Cut a 30s video with an upbeat soundtrack',
        nextAction: 'Storyboard the clip',
        approvalStatus: 'pass',
        signal: { sourceLabel: 'Apify field report' },
      },
      {
        id: 'op-text',
        title: 'CARSI IICRC research',
        recommendation: 'Cite IICRC 2026 standard update',
        nextAction: 'Link the bulletin',
        approvalStatus: 'pass',
        signal: { sourceLabel: 'IICRC bulletin' },
      },
    ]);
  });

  test('requests a licence only for the media opportunity and persists a pending asset', async () => {
    const licenser: AssetLicenser = {
      requestAudioLicense: jest.fn(async ({ mood, durationSec, providerMode }) => ({
        id: 'artlist-track-1',
        provider: 'artlist' as const,
        providerMode,
        title: 'Measured Recovery Pulse',
        artist: 'Mock Artlist',
        durationSec,
        licenceStatus: 'pending' as const,
        sourceUrl: `mock://artlist/song/${encodeURIComponent(mood)}`,
      })),
    };

    const result = await runAgent({
      agentId: 'agent-1',
      triggeredById: 'user-1',
      proposer: stubProposer,
      licenser,
    });

    expect(result.status).toBe('completed');

    // Only the video opportunity triggers a licence request.
    expect(licenser.requestAudioLicense).toHaveBeenCalledTimes(1);
    expect(licenser.requestAudioLicense).toHaveBeenCalledWith(
      expect.objectContaining({ providerMode: 'mock' }),
    );

    // Asset persisted at licenceStatus='pending', tied to the campaign + opportunity.
    expect(createAsset).toHaveBeenCalledTimes(1);
    expect(createAsset.mock.calls[0][0].data).toMatchObject({
      campaignId: 'campaign-1',
      provider: 'artlist',
      providerAssetId: 'artlist-track-1',
      assetType: 'video',
      licenceStatus: 'pending',
    });
    expect(createAsset.mock.calls[0][0].data.metadata).toMatchObject({
      opportunityId: 'op-video',
      providerMode: 'mock',
    });

    // Surfaced in the QA report.
    expect(createQaReport.mock.calls[0][0].data.metadata).toMatchObject({
      assetsRequested: 1,
    });
    expect(createQaReport.mock.calls[0][0].data.blockedReasons).toContain(
      'Awaiting Artlist licence confirmation for requested assets',
    );

    // Surfaced in run artifacts.
    const completedUpdate = updateRun.mock.calls.find(
      (call) => call[0]?.data?.status === 'completed',
    )?.[0]?.data;
    expect(completedUpdate.artifacts.assets).toHaveLength(1);
    expect(completedUpdate.artifacts.assets[0]).toMatchObject({
      opportunityId: 'op-video',
      assetId: 'asset-1',
      licenceStatus: 'pending',
    });
  });

  test('records a blocked check but still completes the run when the Artlist call fails', async () => {
    const licenser: AssetLicenser = {
      requestAudioLicense: jest.fn(async () => {
        throw new Error('Artlist live recommendations are not implemented');
      }),
    };

    const result = await runAgent({
      agentId: 'agent-1',
      triggeredById: 'user-1',
      proposer: stubProposer,
      licenser,
    });

    // Run still completes; claims still proposed.
    expect(result.status).toBe('completed');
    expect(createClaim).toHaveBeenCalledTimes(2);
    expect(createAsset).not.toHaveBeenCalled();

    // The failure is surfaced as a blocked check in the QA report.
    const checks = createQaReport.mock.calls[0][0].data.checks as Array<{
      status: string;
      detail: string;
    }>;
    const blocked = checks.find((c) => c.detail.includes('Artlist licence request failed'));
    expect(blocked).toBeDefined();
    expect(blocked?.status).toBe('blocked');
  });
});
