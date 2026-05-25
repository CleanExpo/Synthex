/**
 * Unit test for the Marketing Agency agent runner happy path.
 *
 * Stubs:
 *   - prisma (marketingAgent, marketingAgentRun, marketingAgencyClaim,
 *     marketingAgencyQaReport, marketingAgencyCampaign)
 *   - listMarketingAgencyOpportunities
 *   - openRouterClient (via custom ClaimProposer passed in)
 *
 * Asserts:
 *   - Run row created with status='running' then updated to 'completed'
 *   - One claim row created per eligible opportunity (capped at maxClaimsPerRun)
 *   - All claims persisted with evidenceStatus='blocked'
 *   - QA report created with status='blocked'
 *   - Run record reflects correct counts
 */

const findUnique = jest.fn();
const updateAgent = jest.fn();
const createRun = jest.fn();
const updateRun = jest.fn();
const createClaim = jest.fn();
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

import { runAgent, type ClaimProposer } from '@/lib/marketing-agency/agent/runner';

describe('runAgent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findUnique.mockResolvedValue({
      id: 'agent-1',
      organizationId: 'org-1',
      status: 'active',
      name: 'Test Agent',
      goal: 'Grow DR LinkedIn presence',
      maxClaimsPerRun: 3,
    });
    createRun.mockResolvedValue({ id: 'run-1' });
    updateRun.mockImplementation(async ({ where, data }) => ({ id: where.id, ...data }));
    updateAgent.mockResolvedValue({ id: 'agent-1' });
    createClaim.mockImplementation(async ({ data }) => ({ id: `claim-${data.statement.slice(0, 8)}` }));
    createQaReport.mockResolvedValue({ id: 'qa-1' });
    findFirstCampaign.mockResolvedValue(null);
    createCampaign.mockResolvedValue({ id: 'campaign-1' });
    listOpportunities.mockResolvedValue([
      {
        id: 'op-1',
        title: 'DR job-evidence story',
        recommendation: 'Lead with a job evidence photo and timeline',
        approvalStatus: 'pass',
        signal: { sourceLabel: 'Apify field report' },
      },
      {
        id: 'op-2',
        title: 'CARSI IICRC research',
        recommendation: 'Cite IICRC 2026 standard update',
        approvalStatus: 'pass',
        signal: { sourceLabel: 'IICRC bulletin' },
      },
    ]);
  });

  test('completes a run end-to-end and creates one claim per eligible opportunity', async () => {
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

    const result = await runAgent({
      agentId: 'agent-1',
      triggeredById: 'user-1',
      proposer: stubProposer,
    });

    expect(result.status).toBe('completed');
    expect(result.runId).toBe('run-1');

    expect(createRun).toHaveBeenCalledTimes(1);
    expect(createRun.mock.calls[0][0].data).toMatchObject({
      agentId: 'agent-1',
      organizationId: 'org-1',
      triggeredById: 'user-1',
      status: 'running',
    });

    expect(createClaim).toHaveBeenCalledTimes(2);
    expect(createClaim.mock.calls[0][0].data).toMatchObject({
      evidenceStatus: 'blocked',
      campaignId: 'campaign-1',
    });

    expect(createQaReport).toHaveBeenCalledTimes(1);
    expect(createQaReport.mock.calls[0][0].data).toMatchObject({
      status: 'blocked',
    });

    const updateData = updateRun.mock.calls.find(
      (call) => call[0]?.data?.status === 'completed',
    )?.[0]?.data;
    expect(updateData).toMatchObject({
      status: 'completed',
      opportunitiesConsidered: 2,
      claimsProposed: 2,
      evidenceGapsFlagged: 2,
      qaReportId: 'qa-1',
    });
  });

  test('marks run as failed and sets errorMessage when ensureCampaignForAgent throws mid-loop', async () => {
    // This is the path the runner's outer try/catch was designed to catch.
    // findUnique succeeds (agent loaded), createRun succeeds (run row exists
    // at status='running'), then ensureCampaignForAgent's inner findFirst
    // throws — the catch block must update the run row to status='failed'
    // with errorMessage truncated.
    findFirstCampaign.mockRejectedValueOnce(new Error('campaign lookup db error'));

    const result = await runAgent({
      agentId: 'agent-1',
      triggeredById: 'user-1',
      proposer: {
        async propose() {
          throw new Error('should not reach');
        },
      },
    });

    expect(result.status).toBe('failed');
    expect(result.runId).toBe('run-1');
    expect(result.summary).toMatch(/Run failed: campaign lookup db error/);

    const failedUpdate = updateRun.mock.calls.find(
      (call) => call[0]?.data?.status === 'failed',
    )?.[0]?.data;
    expect(failedUpdate).toMatchObject({
      status: 'failed',
      errorMessage: expect.stringContaining('campaign lookup db error'),
    });
    expect(failedUpdate?.completedAt).toBeInstanceOf(Date);
  });

  test('does not throw if the failed-status update itself also fails (resilience to DB outage)', async () => {
    // Original failure: ensureCampaignForAgent throws.
    // Then the runner's catch tries to update run to 'failed' — that update
    // ALSO throws (e.g. DB still down). The runner must still return a
    // graceful result rather than re-throwing; the second failure is logged.
    findFirstCampaign.mockRejectedValueOnce(new Error('original db error'));
    updateRun.mockImplementationOnce(async ({ where, data }) => ({ id: where.id, ...data })); // first updateRun call is the 'running' status update — actually createRun handles that. The first updateRun is the failed-status one.
    // Replace updateRun so the FIRST call (the failed-status update) throws.
    updateRun.mockReset();
    updateRun.mockRejectedValueOnce(new Error('update also failed'));

    const result = await runAgent({
      agentId: 'agent-1',
      triggeredById: 'user-1',
      proposer: {
        async propose() {
          throw new Error('should not reach');
        },
      },
    });

    expect(result.status).toBe('failed');
    expect(result.runId).toBe('run-1');
    // The returned summary still reflects the ORIGINAL failure, not the update failure.
    expect(result.summary).toMatch(/Run failed: original db error/);
  });

  test('rejects when agent is not active', async () => {
    findUnique.mockResolvedValue({
      id: 'agent-1',
      organizationId: 'org-1',
      status: 'paused',
      name: 'Test Agent',
      goal: 'X',
      maxClaimsPerRun: 3,
    });

    await expect(
      runAgent({ agentId: 'agent-1', triggeredById: 'user-1' }),
    ).rejects.toThrow(/not active/);
  });
});
