/**
 * SYN-1196 — per-brand kill-switch and default-off runner flags.
 *
 * Goal-card criteria: "Kill-switch per brand stops a runner immediately" and
 * "every runner behind a per-brand flag".
 *
 * "IMMEDIATELY" IS THE ASSERTION THAT MATTERS. A kill-switch honoured from a
 * cache stops a runner eventually, which is a different and much weaker
 * promise. The test that proves it — "reads the flag on every call" below —
 * makes two calls in a row, flips the switch between them, and requires the
 * second to refuse. Add any caching to resolveRunnerFlag and that test fails.
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    runnerFlag: { findMany: jest.fn() },
    aPICredential: { findFirst: jest.fn() },
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
import { governedCall } from '@/lib/ai/governor';
import { BRAND_WIDE_RUNNER } from '@/lib/ai/governor/types';
import {
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

beforeEach(() => {
  installDefaults(mocks);
});

function call(execute: jest.Mock, runner = RUNNER) {
  return governedCall({
    organizationId: ORG_ID,
    brandSlug: BRAND,
    runner,
    provider: 'anthropic',
    model: { kind: 'latest' },
    pipelineName: 'governor-kill-switch-test',
    estimate: { inputTokens: 10, outputTokens: 10 },
    execute,
  });
}

describe('kill-switch', () => {
  it('stops the runner when the BRAND-WIDE row is killed, even though the runner row is enabled', async () => {
    mocks.prisma.runnerFlag.findMany.mockResolvedValue([
      { runner: RUNNER, enabled: true, killSwitch: false },
      { runner: BRAND_WIDE_RUNNER, enabled: true, killSwitch: true },
    ]);
    const execute = jest.fn();

    const result = await call(execute);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused_kill_switch');
    expect(execute).not.toHaveBeenCalled();

    const row = receiptRow(mocks)!;
    expect(row.outcome).toBe('refused_kill_switch');
    expect((row.provenance as Record<string, unknown>).flagVerdict).toBe(
      'brand_kill_switch'
    );
  });

  it('stops the runner when the RUNNER row itself is killed, overriding enabled', async () => {
    mocks.prisma.runnerFlag.findMany.mockResolvedValue([
      { runner: RUNNER, enabled: true, killSwitch: true },
    ]);
    const execute = jest.fn();

    const result = await call(execute);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused_kill_switch');
    expect(execute).not.toHaveBeenCalled();
  });

  it('reads the flag on EVERY call — a switch flipped between calls stops the next one', async () => {
    const execute = jest
      .fn()
      .mockResolvedValue({ data: 'ok', inputTokens: 1, outputTokens: 1 });

    // First call: permitted.
    mocks.prisma.runnerFlag.findMany.mockResolvedValueOnce([
      { runner: RUNNER, enabled: true, killSwitch: false },
    ]);
    const first = await call(execute);
    expect(first.ok).toBe(true);

    // Operator flips the brand kill-switch. No process restart, no cache purge.
    mocks.prisma.runnerFlag.findMany.mockResolvedValueOnce([
      { runner: RUNNER, enabled: true, killSwitch: false },
      { runner: BRAND_WIDE_RUNNER, enabled: true, killSwitch: true },
    ]);
    const second = await call(execute);

    expect(second.ok).toBe(false);
    expect(second.outcome).toBe('refused_kill_switch');
    // The provider ran once (the first call) and not again.
    expect(execute).toHaveBeenCalledTimes(1);
    // Two calls, two flag reads: nothing was cached.
    expect(mocks.prisma.runnerFlag.findMany).toHaveBeenCalledTimes(2);
  });

  it("does not let one brand's kill-switch be read from another brand", async () => {
    const execute = jest
      .fn()
      .mockResolvedValue({ data: 'ok', inputTokens: 1, outputTokens: 1 });
    await call(execute);

    expect(mocks.prisma.runnerFlag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: ORG_ID,
          brandSlug: BRAND,
        }),
      })
    );
  });
});

describe('runner flags default OFF', () => {
  it('refuses when NO flag row exists — absence is a refusal, not a permit', async () => {
    mocks.prisma.runnerFlag.findMany.mockResolvedValue([]);
    const execute = jest.fn();

    const result = await call(execute);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused_flag_missing');
    expect(execute).not.toHaveBeenCalled();
  });

  it('refuses when the row exists but enabled is false', async () => {
    mocks.prisma.runnerFlag.findMany.mockResolvedValue([
      { runner: RUNNER, enabled: false, killSwitch: false },
    ]);
    const execute = jest.fn();

    const result = await call(execute);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused_flag_disabled');
    expect(execute).not.toHaveBeenCalled();
  });

  it('refuses when the flag read fails — fail-closed, unlike budget-enforcer', async () => {
    mocks.prisma.runnerFlag.findMany.mockRejectedValue(new Error('db down'));
    const execute = jest.fn();

    const result = await call(execute);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('refused_control_plane_error');
    expect(execute).not.toHaveBeenCalled();
  });

  it('refuses a runner that tries to impersonate the brand-wide row name', async () => {
    const execute = jest.fn();

    const result = await call(execute, BRAND_WIDE_RUNNER);

    expect(result.ok).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });
});
