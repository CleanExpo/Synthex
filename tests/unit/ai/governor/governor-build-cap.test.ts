/**
 * Per-build spending cap on the Governor (founder decision 22/10/2026).
 *
 * A client build is metered at about US$80 and its direct spend must stay at
 * or under US$10-12. A build is identified by a buildId that becomes the
 * pipeline_cost_ledger run_id of every governed call in it, so "what has this
 * build spent" is one SUM over run_id.
 *
 * Test names carry the Done-contract criterion id (C1 ...) so each criterion
 * runs exactly the tests that prove it.
 */

import { getLatestModel } from '@/lib/ai/model-registry';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    runnerFlag: { findMany: jest.fn() },
    aPICredential: { findMany: jest.fn() },
    orgBudgetPolicy: { findUnique: jest.fn() },
    pipelineCostLedger: {
      groupBy: jest.fn(),
      create: jest.fn(),
      aggregate: jest.fn(),
    },
    // Media holds under a buildId count toward the cap (follow-up to #1066);
    // these suites plant none, so the media side reads as an empty build.
    mediaSpendEvent: { findMany: jest.fn(), aggregate: jest.fn() },
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
import { logger } from '@/lib/logger';
import { decryptApiKey } from '@/lib/encryption/api-key-encryption';
import {
  governedCall,
  checkBuildCap,
  getBuildSpend,
  resolveBuildCapUsd,
  DEFAULT_BUILD_CAP_USD,
  estimateCostUsd,
  type GovernedCallInput,
} from '@/lib/ai/governor';
import {
  BRAND,
  ORG_ID,
  RUNNER,
  installDefaults,
  receiptRow,
  type GovernorMocks,
} from './governor-test-harness';

type Mocks = GovernorMocks & {
  prisma: GovernorMocks['prisma'] & {
    pipelineCostLedger: { aggregate: jest.Mock };
  };
};

const mocks = {
  prisma: prisma as unknown as Mocks['prisma'],
  decryptApiKey: decryptApiKey as unknown as jest.Mock,
} as Mocks;

const PROVIDER = 'anthropic' as const;
const BUILD_ID = 'build_test_0001';
const ESTIMATE = { inputTokens: 1000, outputTokens: 1000 };
/** What ESTIMATE costs on the model the Governor will resolve. */
const ESTIMATE_USD = estimateCostUsd(
  getLatestModel(PROVIDER),
  ESTIMATE.inputTokens,
  ESTIMATE.outputTokens
);

let savedEnv: string | undefined;

beforeEach(() => {
  installDefaults(mocks);
  mocks.prisma.pipelineCostLedger.aggregate.mockResolvedValue({
    _sum: { costUsd: 0 },
  });
  (
    prisma as unknown as { mediaSpendEvent: { findMany: jest.Mock } }
  ).mediaSpendEvent.findMany.mockResolvedValue([]);
  savedEnv = process.env.SYNTHEX_BUILD_CAP_USD;
  delete process.env.SYNTHEX_BUILD_CAP_USD;
});

afterEach(() => {
  if (savedEnv === undefined) delete process.env.SYNTHEX_BUILD_CAP_USD;
  else process.env.SYNTHEX_BUILD_CAP_USD = savedEnv;
});

function spent(costUsd: unknown) {
  mocks.prisma.pipelineCostLedger.aggregate.mockResolvedValue({
    _sum: { costUsd },
  });
}

function call(
  execute: jest.Mock,
  extra: Partial<GovernedCallInput<string>> = {}
) {
  return governedCall<string>({
    organizationId: ORG_ID,
    brandSlug: BRAND,
    runner: RUNNER,
    provider: PROVIDER,
    model: { kind: 'latest' },
    pipelineName: 'governor-build-cap-test',
    estimate: ESTIMATE,
    execute,
    build: { buildId: BUILD_ID, capUsd: 12 },
    ...extra,
  });
}

function okExecute() {
  return jest.fn().mockResolvedValue({
    data: 'ok',
    inputTokens: 10,
    outputTokens: 10,
  });
}

describe('per-build spending cap', () => {
  it('sanity: the test estimate is a real, positive, small cost', () => {
    expect(ESTIMATE_USD).toBeGreaterThan(0);
    expect(ESTIMATE_USD).toBeLessThan(1);
  });

  it('C1 refuses when spent + estimate exceeds the cap, does not call the provider, and writes a refusal receipt under the buildId', async () => {
    // Just under the cap: the estimate alone tips it over.
    spent(12 - ESTIMATE_USD / 2);
    const execute = jest.fn();

    const result = await call(execute);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused_build_cap_exceeded');
    expect(execute).not.toHaveBeenCalled();
    expect(mocks.prisma.pipelineCostLedger.aggregate).toHaveBeenCalledWith({
      where: { runId: BUILD_ID },
      _sum: { costUsd: true },
    });
    expect(mocks.prisma.pipelineCostLedger.create).toHaveBeenCalledTimes(1);
    const row = receiptRow(mocks)!;
    expect(row.outcome).toBe('refused_build_cap_exceeded');
    expect(row.runId).toBe(BUILD_ID);
    expect(row.costUsd).toBe(0);
    const provenance = row.provenance as Record<string, unknown>;
    expect(String(provenance.budgetVerdict)).toContain('build_cap_exceeded');
    expect(provenance.buildCap).toMatchObject({
      buildId: BUILD_ID,
      capUsd: 12,
    });
  });

  it('C1 refuses an already-exhausted build even with a zero-cost estimate', async () => {
    spent(12.5);
    const decision = await checkBuildCap({ buildId: BUILD_ID, capUsd: 12 }, 0);
    expect(decision.allowed).toBe(false);
    expect(decision.outcome).toBe('refused_build_cap_exceeded');
  });

  it('C2 allows a call that fits under the cap and receipts it under the buildId', async () => {
    spent(5);
    const execute = okExecute();

    const result = await call(execute);

    expect(result.ok).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].runId).toBe(BUILD_ID);
    const row = receiptRow(mocks)!;
    expect(row.outcome).toBe('completed');
    expect(row.runId).toBe(BUILD_ID);
    expect((row.provenance as Record<string, unknown>).buildCap).toMatchObject({
      verdict: 'within_build_cap',
      spentUsd: 5,
      capUsd: 12,
    });
  });

  it('C2 allows spend that lands exactly on the cap (at or under, not strictly under)', async () => {
    spent(12 - 0.25);
    const decision = await checkBuildCap(
      { buildId: BUILD_ID, capUsd: 12 },
      0.25
    );
    expect(decision.allowed).toBe(true);
    expect(decision.verdict).toBe('within_build_cap');
  });

  it.each([
    ['NaN', Number.NaN],
    ['negative', -1000],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('C3 refuses a %s estimate even on an empty build', async (_l, value) => {
    spent(0);
    const decision = await checkBuildCap(
      { buildId: BUILD_ID, capUsd: 12 },
      value
    );
    expect(decision.allowed).toBe(false);
    expect(decision.outcome).toBe('refused_budget_invalid_estimate');
  });

  it('C3 refuses a NaN token estimate on the governed path, with a receipt', async () => {
    const execute = jest.fn();
    const result = await call(execute, {
      estimate: { inputTokens: Number.NaN, outputTokens: 10 },
    });
    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused_budget_invalid_estimate');
    expect(execute).not.toHaveBeenCalled();
    expect(receiptRow(mocks)!.runId).toBe(BUILD_ID);
  });

  it.each([
    ['NaN', Number.NaN],
    ['negative', -5],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('C3 refuses a %s capUsd', async (_l, capUsd) => {
    const execute = jest.fn();
    const result = await call(execute, {
      build: { buildId: BUILD_ID, capUsd },
    });
    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused_budget_untrusted_input');
    expect(execute).not.toHaveBeenCalled();
  });

  it('C3 refuses an empty buildId', async () => {
    const decision = await checkBuildCap({ buildId: '  ', capUsd: 12 }, 0.01);
    expect(decision.allowed).toBe(false);
    expect(decision.outcome).toBe('refused_budget_untrusted_input');
  });

  it('C4 refuses (fail closed) when the ledger sum cannot be read, and receipts it', async () => {
    mocks.prisma.pipelineCostLedger.aggregate.mockRejectedValue(
      new Error('connection reset')
    );
    const execute = jest.fn();

    const result = await call(execute);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused_control_plane_error');
    expect(execute).not.toHaveBeenCalled();
    expect(receiptRow(mocks)!.outcome).toBe('refused_control_plane_error');
    expect(receiptRow(mocks)!.runId).toBe(BUILD_ID);
  });

  it.each([
    ['NaN', Number.NaN],
    ['negative', -100],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a string', '3.5'],
  ])('C4 refuses a poisoned ledger sum (%s)', async (_l, value) => {
    spent(value);
    const execute = jest.fn();

    const result = await call(execute);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused_budget_untrusted_input');
    expect(execute).not.toHaveBeenCalled();
    expect(receiptRow(mocks)!.outcome).toBe('refused_budget_untrusted_input');
  });

  it('C5 shadow mode logs the would-be refusal and still runs the call, with one receipt', async () => {
    spent(50);
    const execute = okExecute();

    const result = await call(execute, { mode: 'shadow' });

    expect(result.ok).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.pipelineCostLedger.create).toHaveBeenCalledTimes(1);
    const row = receiptRow(mocks)!;
    expect(row.outcome).toBe('completed');
    expect(row.runId).toBe(BUILD_ID);
    expect(
      (row.provenance as Record<string, unknown>).shadowRefusal
    ).toMatchObject({ outcome: 'refused_build_cap_exceeded' });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('would refuse'),
      expect.objectContaining({ outcome: 'refused_build_cap_exceeded' })
    );
  });

  it('C6 a call without build never reads the build ledger and keeps its own runId', async () => {
    const execute = okExecute();

    const result = await call(execute, {
      build: undefined,
      runId: 'caller-run-id',
    });

    expect(result.ok).toBe(true);
    expect(mocks.prisma.pipelineCostLedger.aggregate).not.toHaveBeenCalled();
    const row = receiptRow(mocks)!;
    expect(row.runId).toBe('caller-run-id');
    expect(
      (row.provenance as Record<string, unknown>).buildCap
    ).toBeUndefined();
  });

  it('C6 a call without build is not capped even when another build sum would be huge', async () => {
    spent(1_000_000);
    const execute = okExecute();
    const result = await call(execute, { build: undefined });
    expect(result.ok).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('C6 refuses when runId and build.buildId disagree (one build, one ledger key)', async () => {
    const execute = jest.fn();
    const result = await call(execute, { runId: 'some-other-run' });
    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused_budget_untrusted_input');
    expect(execute).not.toHaveBeenCalled();
  });

  it('C8 getBuildSpend reports spent, cap and remaining', async () => {
    spent(4.25);
    await expect(getBuildSpend(BUILD_ID)).resolves.toEqual({
      buildId: BUILD_ID,
      spentUsd: 4.25,
      capUsd: DEFAULT_BUILD_CAP_USD,
      remainingUsd: 7.75,
    });
  });

  it('C8 getBuildSpend reports zero remaining (never negative) for an overspent build', async () => {
    spent(15);
    const report = await getBuildSpend(BUILD_ID, 10);
    expect(report.remainingUsd).toBe(0);
    expect(report.spentUsd).toBe(15);
  });

  it('C8 getBuildSpend treats a build with no rows as zero spend', async () => {
    spent(null);
    const report = await getBuildSpend(BUILD_ID, 10);
    expect(report.spentUsd).toBe(0);
    expect(report.remainingUsd).toBe(10);
  });

  it('C8 getBuildSpend throws on an unreadable or poisoned ledger instead of reporting zero', async () => {
    mocks.prisma.pipelineCostLedger.aggregate.mockRejectedValue(
      new Error('down')
    );
    await expect(getBuildSpend(BUILD_ID)).rejects.toThrow();
    spent(Number.NaN);
    await expect(getBuildSpend(BUILD_ID)).rejects.toThrow();
  });

  it('C9 the default cap is US$12 when SYNTHEX_BUILD_CAP_USD is unset', () => {
    expect(DEFAULT_BUILD_CAP_USD).toBe(12);
    expect(resolveBuildCapUsd()).toBe(12);
  });

  it('C9 SYNTHEX_BUILD_CAP_USD sets the default cap and an explicit capUsd wins', async () => {
    process.env.SYNTHEX_BUILD_CAP_USD = '10';
    expect(resolveBuildCapUsd()).toBe(10);
    expect(resolveBuildCapUsd(11)).toBe(11);

    spent(9.99);
    const decision = await checkBuildCap({ buildId: BUILD_ID }, 0.02);
    expect(decision.allowed).toBe(false);
    expect(decision.outcome).toBe('refused_build_cap_exceeded');
  });

  it.each(['abc', '-1', 'NaN', 'Infinity'])(
    'C9 an unusable SYNTHEX_BUILD_CAP_USD (%s) refuses rather than falling back',
    async raw => {
      process.env.SYNTHEX_BUILD_CAP_USD = raw;
      expect(resolveBuildCapUsd()).toBeNull();
      const decision = await checkBuildCap({ buildId: BUILD_ID }, 0.01);
      expect(decision.allowed).toBe(false);
      expect(decision.outcome).toBe('refused_budget_untrusted_input');
    }
  );

  // A blank buildId must never become a receipt's run_id: every blank-id
  // receipt would land in one shared '' bucket and be counted as one build.
  it.each([
    ['empty', ''],
    ['whitespace', '   '],
    ['missing', undefined],
    ['not a string', 42],
  ])(
    'C15 refuses an unusable buildId (%s) before any gate and never receipts a blank run_id',
    async (_l, buildId) => {
      const execute = jest.fn();

      const result = await call(execute, {
        build: { buildId: buildId as unknown as string, capUsd: 12 },
      });

      expect(result.ok).toBe(false);
      expect(result.outcome).toBe('refused_budget_untrusted_input');
      expect(result.ok === false && result.reason).toBe(
        'budget_untrusted_input:build_id_invalid'
      );
      expect(execute).not.toHaveBeenCalled();
      // Gate 0: refused before the flag, BYOK and budget gates are reached.
      expect(mocks.prisma.runnerFlag.findMany).not.toHaveBeenCalled();
      expect(mocks.prisma.pipelineCostLedger.aggregate).not.toHaveBeenCalled();
      const row = receiptRow(mocks)!;
      expect(row.outcome).toBe('refused_budget_untrusted_input');
      expect(typeof row.runId).toBe('string');
      expect((row.runId as string).trim()).not.toBe('');
    }
  );

  it('C15 shadow mode with a blank buildId runs the call but never uses a blank run_id', async () => {
    const execute = okExecute();

    const result = await call(execute, {
      mode: 'shadow',
      build: { buildId: '  ', capUsd: 12 },
    });

    expect(result.ok).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(String(execute.mock.calls[0][0].runId).trim()).not.toBe('');
    expect(mocks.prisma.pipelineCostLedger.create).toHaveBeenCalledTimes(1);
    const row = receiptRow(mocks)!;
    expect(row.outcome).toBe('completed');
    expect((row.runId as string).trim()).not.toBe('');
    expect(
      (row.provenance as Record<string, unknown>).shadowRefusal
    ).toMatchObject({ outcome: 'refused_budget_untrusted_input' });
  });
});
