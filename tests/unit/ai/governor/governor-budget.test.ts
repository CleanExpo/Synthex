/**
 * SYN-1196 — budget halt across all four providers, and the receipt it writes.
 *
 * Goal-card criterion: "Governor: budget halt + receipts row per AI call,
 * across all four providers."
 *
 * Two mechanisms are under test and they need separate mutants:
 *   (a) the budget CHECK — remove it and the halt tests go red;
 *   (b) the refusal RECEIPT — remove the writeReceipt call in the refuse()
 *       helper and the receipt assertions go red while the halt still fires.
 * A single mutant covering both would let either mechanism alone satisfy the
 * suite.
 */

import { getLatestModel } from '@/lib/ai/model-registry';
import { estimateCostUsd } from '@/lib/ai/governor/model';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    runnerFlag: { findMany: jest.fn() },
    aPICredential: { findMany: jest.fn() },
    orgBudgetPolicy: { findUnique: jest.fn() },
    pipelineCostLedger: { groupBy: jest.fn(), create: jest.fn() },
  },
}));

jest.mock('@/lib/encryption/api-key-encryption', () => ({
  decryptApiKey: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { decryptApiKey } from '@/lib/encryption/api-key-encryption';
import { governedCall, checkBudget } from '@/lib/ai/governor';
import {
  ALL_PROVIDERS,
  BRAND,
  ORG_ID,
  RUNNER,
  installDefaults,
  receiptRow,
  type GovernorMocks,
} from './governor-test-harness';

const mocks = {
  prisma: prisma as unknown as GovernorMocks['prisma'],
  decryptApiKey: decryptApiKey as unknown as jest.Mock,
} as GovernorMocks;

const ESTIMATE = { inputTokens: 1000, outputTokens: 1000 };

beforeEach(() => {
  installDefaults(mocks);
});

function callFor(provider: (typeof ALL_PROVIDERS)[number], execute: jest.Mock) {
  return governedCall({
    organizationId: ORG_ID,
    brandSlug: BRAND,
    runner: RUNNER,
    provider,
    model: { kind: 'latest' },
    pipelineName: 'governor-budget-test',
    estimate: ESTIMATE,
    execute,
  });
}

describe.each(ALL_PROVIDERS)('budget halt — %s', provider => {
  it('halts when the org daily ceiling is already spent, and does not call the provider', async () => {
    mocks.prisma.orgBudgetPolicy.findUnique.mockResolvedValue({
      dailyCeilingUsd: 10,
      providerDailyCeilingsUsd: null,
      enforcementMode: 'enforce',
    });
    // Already spent the lot.
    mocks.prisma.pipelineCostLedger.groupBy.mockResolvedValue([
      { provider, _sum: { costUsd: 10 } },
    ]);
    const execute = jest.fn();

    const result = await callFor(provider, execute);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused_budget_exhausted');
    expect(execute).not.toHaveBeenCalled();
  });

  it('writes a receipt row FOR THE REFUSAL, with zero cost and the reason', async () => {
    mocks.prisma.orgBudgetPolicy.findUnique.mockResolvedValue({
      dailyCeilingUsd: 0,
      providerDailyCeilingsUsd: null,
      enforcementMode: 'enforce',
    });
    const execute = jest.fn();

    const result = await callFor(provider, execute);

    expect(result.ok).toBe(false);
    expect(mocks.prisma.pipelineCostLedger.create).toHaveBeenCalledTimes(1);

    const row = receiptRow(mocks)!;
    expect(row.outcome).toBe('refused_budget_exhausted');
    expect(row.provider).toBe(provider);
    expect(row.brandSlug).toBe(BRAND);
    expect(row.runner).toBe(RUNNER);
    expect(row.costUsd).toBe(0);
    expect(row.inputTokens).toBe(0);
    expect(row.outputTokens).toBe(0);
    // clientId = organizationId so budget-enforcer's existing SUM over
    // (clientId, createdAt) already counts Governor spend.
    expect(row.clientId).toBe(ORG_ID);
    // The model still resolves before the halt, so the NOT NULL model column
    // can be written on a refusal row.
    expect(row.model).toBe(getLatestModel(provider).id);
    expect((row.provenance as Record<string, unknown>).budgetVerdict).toContain(
      'org_daily_exhausted'
    );
  });

  it("halts on this provider's OWN ceiling even when the org ceiling has room", async () => {
    mocks.prisma.orgBudgetPolicy.findUnique.mockResolvedValue({
      dailyCeilingUsd: 1000,
      providerDailyCeilingsUsd: { [provider]: 0 },
      enforcementMode: 'enforce',
    });
    const execute = jest.fn();

    const result = await callFor(provider, execute);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused_budget_exhausted');
    expect(
      (receiptRow(mocks)!.provenance as Record<string, unknown>).budgetVerdict
    ).toContain(`provider_daily_exhausted:${provider}`);
    expect(execute).not.toHaveBeenCalled();
  });

  it('refuses when the brand has NO budget policy at all', async () => {
    mocks.prisma.orgBudgetPolicy.findUnique.mockResolvedValue(null);
    const execute = jest.fn();

    const result = await callFor(provider, execute);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused_budget_unconfigured');
    expect(execute).not.toHaveBeenCalled();
  });

  it('refuses when the ledger read itself fails — unknown is never "proceed"', async () => {
    mocks.prisma.pipelineCostLedger.groupBy.mockRejectedValue(
      new Error('connection reset')
    );
    const execute = jest.fn();

    const result = await callFor(provider, execute);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused_control_plane_error');
    expect(execute).not.toHaveBeenCalled();
  });

  it('allows the call under the ceiling and receipts the ACTUAL tokens spent', async () => {
    mocks.prisma.orgBudgetPolicy.findUnique.mockResolvedValue({
      dailyCeilingUsd: 1000,
      providerDailyCeilingsUsd: { [provider]: 500 },
      enforcementMode: 'enforce',
    });
    const execute = jest.fn().mockResolvedValue({
      data: 'generated',
      inputTokens: 640,
      outputTokens: 128,
    });

    const result = await callFor(provider, execute);

    expect(result.ok).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);

    const row = receiptRow(mocks)!;
    expect(row.outcome).toBe('completed');
    expect(row.inputTokens).toBe(640);
    expect(row.outputTokens).toBe(128);
    // Cost comes from the REGISTRY's per-model pricing, not track-cost.ts's
    // hardcoded Anthropic-only rate table.
    expect(row.costUsd).toBe(
      estimateCostUsd(getLatestModel(provider), 640, 128)
    );
  });
});

describe('budget halt — receipt is written exactly once per governed call', () => {
  it('does not double-receipt a served call', async () => {
    const execute = jest
      .fn()
      .mockResolvedValue({ data: 'ok', inputTokens: 10, outputTokens: 10 });

    await callFor('anthropic', execute);

    expect(mocks.prisma.pipelineCostLedger.create).toHaveBeenCalledTimes(1);
  });
});

/**
 * Regression for the cursor lane's P2 on budget.ts: a policy row that sets NO
 * ceiling authorised unbounded Governor spend, because only a MISSING row was
 * refused. "No budget means no spending" has to cover both or it covers
 * neither.
 */
describe.each(ALL_PROVIDERS)('budget unconfigured — %s', provider => {
  it('refuses a policy row whose ceilings are all null', async () => {
    mocks.prisma.orgBudgetPolicy.findUnique.mockResolvedValue({
      dailyCeilingUsd: null,
      providerDailyCeilingsUsd: null,
      enforcementMode: 'enforce',
    });
    const execute = jest.fn();

    const result = await callFor(provider, execute);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused_budget_unconfigured');
    expect(execute).not.toHaveBeenCalled();
  });

  it('accepts a row that sets ONLY a per-provider ceiling', async () => {
    mocks.prisma.orgBudgetPolicy.findUnique.mockResolvedValue({
      dailyCeilingUsd: null,
      providerDailyCeilingsUsd: { [provider]: 100 },
      enforcementMode: 'enforce',
    });
    const execute = jest
      .fn()
      .mockResolvedValue({ data: 'ok', inputTokens: 1, outputTokens: 1 });

    const result = await callFor(provider, execute);

    expect(result.ok).toBe(true);
  });
});

/**
 * Regression for P1-BUDGET-NEGATIVE-NAN-ESTIMATE-BYPASS (independent review,
 * cursor lane, round 3, head fb5c857).
 *
 * Every ceiling test is `spend + estimate > ceiling`. Under IEEE semantics that
 * predicate is FALSE for NaN and for a large negative estimate, so an unguarded
 * comparison returns allowed:true on a budget that is ALREADY EXHAUSTED — a
 * fail-OPEN in a module whose entire contract is fail-closed.
 *
 * The control below is the reviewer's own demonstration: $5.00 already spent
 * against a $1.00 ceiling. A zero estimate must refuse (proving the ceiling is
 * genuinely breached, so this is not the disclosed read-then-decide race and
 * not an ordinary underestimate), and NaN and negative must refuse too.
 */
describe('budget estimate is validated before it is compared', () => {
  const exhausted = () => {
    mocks.prisma.orgBudgetPolicy.findUnique.mockResolvedValue({
      dailyCeilingUsd: 1,
      providerDailyCeilingsUsd: { anthropic: 1 },
      enforcementMode: 'enforce',
    });
    mocks.prisma.pipelineCostLedger.groupBy.mockResolvedValue([
      { provider: 'anthropic', _sum: { costUsd: 5.0 } },
    ]);
  };

  it('positive control: a ZERO estimate already refuses once the ceiling is spent', async () => {
    exhausted();
    const decision = await checkBudget('org_test_syn1196', 'anthropic', 0);
    expect(decision.allowed).toBe(false);
    expect(decision.outcome).toBe('refused_budget_exhausted');
  });

  it.each([
    ['negative', -1000],
    ['NaN', Number.NaN],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])(
    'refuses a %s estimate instead of allowing spend',
    async (_label, value) => {
      exhausted();
      const decision = await checkBudget(
        'org_test_syn1196',
        'anthropic',
        value
      );
      expect(decision.allowed).toBe(false);
      expect(decision.outcome).toBe('refused_budget_invalid_estimate');
    }
  );

  it('governedCall refuses NaN token counts from the caller, and receipts it', async () => {
    exhausted();
    const execute = jest.fn();

    const result = await governedCall({
      organizationId: ORG_ID,
      brandSlug: BRAND,
      runner: RUNNER,
      provider: 'anthropic',
      model: { kind: 'latest' },
      pipelineName: 'governor-budget-test',
      estimate: { inputTokens: Number.NaN, outputTokens: 10 },
      execute,
    });

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused_budget_invalid_estimate');
    expect(execute).not.toHaveBeenCalled();
    expect(receiptRow(mocks)!.outcome).toBe('refused_budget_invalid_estimate');
  });

  it('governedCall refuses NEGATIVE token counts from the caller', async () => {
    exhausted();
    const execute = jest.fn();

    const result = await governedCall({
      organizationId: ORG_ID,
      brandSlug: BRAND,
      runner: RUNNER,
      provider: 'anthropic',
      model: { kind: 'latest' },
      pipelineName: 'governor-budget-test',
      estimate: { inputTokens: -1_000_000, outputTokens: 10 },
      execute,
    });

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused_budget_invalid_estimate');
    expect(execute).not.toHaveBeenCalled();
  });

  it('never writes a NaN cost into the ledger when the PROVIDER returns junk counts', async () => {
    // A NaN in cost_usd would poison every budget SUM that later reads it.
    installDefaults(mocks);
    const execute = jest.fn().mockResolvedValue({
      data: 'ok',
      inputTokens: Number.NaN,
      outputTokens: 50,
    });

    const result = await governedCall({
      organizationId: ORG_ID,
      brandSlug: BRAND,
      runner: RUNNER,
      provider: 'anthropic',
      model: { kind: 'latest' },
      pipelineName: 'governor-budget-test',
      estimate: { inputTokens: 10, outputTokens: 10 },
      execute,
    });

    expect(result.ok).toBe(true);
    const row = receiptRow(mocks)!;
    expect(Number.isFinite(row.costUsd as number)).toBe(true);
    expect(Number.isFinite(row.inputTokens as number)).toBe(true);
    expect((row.provenance as Record<string, unknown>).errorClass).toBe(
      'provider_returned_unusable_token_counts'
    );
  });
});
