/**
 * BUDGET-ENFORCER — unit contract for lib/ai/budget-enforcer.ts.
 *
 * Prisma is mocked (policy row + ledger sums); Redis runs on the REAL
 * redis-client memory fallback so the atomic INCRBY reservation counters are
 * genuinely exercised (reset between tests).
 *
 * Pins the deploy-safety contract:
 *   - no policy row + no env defaults  → no-op (null reservation, no throw)
 *   - policy-read error (e.g. P2021)   → warn + fail-open
 *   - breach under 'enforce' row       → OrgBudgetExceededError, counters
 *                                        rolled back (fail-closed)
 *   - breach under 'log_only' / env    → warn + proceed
 *   - reservation lifecycle            → commit/release decrement exactly once
 *   - concurrency                      → two near-ceiling reserves: exactly
 *                                        one proceeds (TOCTOU guard)
 */

const mockPolicyFindUnique = jest.fn();
const mockLedgerAggregate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    orgBudgetPolicy: {
      findUnique: (...a: unknown[]) => mockPolicyFindUnique(...a),
    },
    pipelineCostLedger: {
      aggregate: (...a: unknown[]) => mockLedgerAggregate(...a),
    },
  },
  default: {
    orgBudgetPolicy: {
      findUnique: (...a: unknown[]) => mockPolicyFindUnique(...a),
    },
    pipelineCostLedger: {
      aggregate: (...a: unknown[]) => mockLedgerAggregate(...a),
    },
  },
}));

const mockLoggerWarn = jest.fn();
const mockLoggerInfo = jest.fn();
jest.mock('@/lib/logger', () => ({
  logger: {
    warn: (...a: unknown[]) => mockLoggerWarn(...a),
    info: (...a: unknown[]) => mockLoggerInfo(...a),
    error: jest.fn(),
  },
}));

import {
  commitActual,
  estimateCalendarGenerationCostUsd,
  getOrgSpendSnapshot,
  OrgBudgetExceededError,
  previewBudget,
  releaseReservation,
  reserveBudget,
} from '@/lib/ai/budget-enforcer';
import { estimateContentGenerationCostUsd } from '@/lib/ai/generation-context';
import { resetRedisClient } from '@/lib/redis-client';

const ORG = 'org-budget-test';
const CTX = { organizationId: ORG, traceId: 'trace-1', userId: 'user-1' };

function policyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pol-1',
    organizationId: ORG,
    dailyCeilingUsd: 10,
    monthlyCeilingUsd: null,
    enforcementMode: 'enforce',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function ledgerSum(usd: number) {
  mockLedgerAggregate.mockResolvedValue({ _sum: { costUsd: usd } });
}

async function inFlightDailyUsd(): Promise<number> {
  const snapshot = await getOrgSpendSnapshot(ORG);
  return snapshot.inFlightReservedUsd.daily;
}

describe('budget-enforcer', () => {
  const envBackup = {
    daily: process.env.SYNTHEX_DEFAULT_DAILY_COST_CEILING_USD,
    monthly: process.env.SYNTHEX_DEFAULT_MONTHLY_COST_CEILING_USD,
  };

  beforeEach(async () => {
    delete process.env.SYNTHEX_DEFAULT_DAILY_COST_CEILING_USD;
    delete process.env.SYNTHEX_DEFAULT_MONTHLY_COST_CEILING_USD;
    await resetRedisClient(); // fresh in-memory counters per test
    mockPolicyFindUnique.mockResolvedValue(null);
    ledgerSum(0);
  });

  afterAll(() => {
    process.env.SYNTHEX_DEFAULT_DAILY_COST_CEILING_USD = envBackup.daily;
    process.env.SYNTHEX_DEFAULT_MONTHLY_COST_CEILING_USD = envBackup.monthly;
    if (envBackup.daily === undefined)
      delete process.env.SYNTHEX_DEFAULT_DAILY_COST_CEILING_USD;
    if (envBackup.monthly === undefined)
      delete process.env.SYNTHEX_DEFAULT_MONTHLY_COST_CEILING_USD;
  });

  // -------------------------------------------------------------------------
  // Deploy safety: absent policy = no behaviour change
  // -------------------------------------------------------------------------
  it('is a no-op when no policy row exists and env defaults are unset', async () => {
    const reservation = await reserveBudget(CTX, 1.0);
    expect(reservation).toBeNull();
    // No ledger read even attempted (no ceilings to enforce against).
    expect(mockLedgerAggregate).not.toHaveBeenCalled();
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  it('fails OPEN with a warn when the policy read errors (e.g. missing table P2021)', async () => {
    mockPolicyFindUnique.mockRejectedValue(
      new Error('The table `public.org_budget_policies` does not exist')
    );
    const reservation = await reserveBudget(CTX, 1.0);
    expect(reservation).toBeNull();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('policy read failed'),
      expect.objectContaining({ organizationId: ORG })
    );
  });

  it('fails OPEN (skip) when the ledger window read errors', async () => {
    mockPolicyFindUnique.mockResolvedValue(policyRow());
    mockLedgerAggregate.mockRejectedValue(new Error('connection refused'));
    const reservation = await reserveBudget(CTX, 1.0);
    expect(reservation).toBeNull();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('ledger window read failed'),
      expect.anything()
    );
  });

  it('skips the system organisation entirely', async () => {
    mockPolicyFindUnique.mockResolvedValue(policyRow());
    const reservation = await reserveBudget({ organizationId: 'system' }, 1.0);
    expect(reservation).toBeNull();
    expect(mockPolicyFindUnique).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Fail-closed on breach under an enforcing policy row
  // -------------------------------------------------------------------------
  it('throws OrgBudgetExceededError when ledger spend + estimate breaches an enforcing daily ceiling', async () => {
    mockPolicyFindUnique.mockResolvedValue(
      policyRow({ dailyCeilingUsd: 1.0, enforcementMode: 'enforce' })
    );
    ledgerSum(0.99);

    await expect(reserveBudget(CTX, 0.05)).rejects.toThrow(
      OrgBudgetExceededError
    );
    // Counters rolled back — nothing left in flight after the rejection.
    expect(await inFlightDailyUsd()).toBe(0);
  });

  it('carries typed fields for the 402 envelope on the error', async () => {
    mockPolicyFindUnique.mockResolvedValue(policyRow({ dailyCeilingUsd: 1.0 }));
    ledgerSum(0.99);
    try {
      await reserveBudget(CTX, 0.05);
      throw new Error('expected OrgBudgetExceededError');
    } catch (error) {
      const budgetError = error as OrgBudgetExceededError;
      expect(budgetError).toBeInstanceOf(OrgBudgetExceededError);
      expect(budgetError.organizationId).toBe(ORG);
      expect(budgetError.window).toBe('daily');
      expect(budgetError.spendUsd).toBeCloseTo(0.99);
      expect(budgetError.ceilingUsd).toBe(1.0);
      expect(budgetError.estimatedCostUsd).toBeCloseTo(0.05);
    }
  });

  it('enforces the monthly ceiling independently of the daily one', async () => {
    mockPolicyFindUnique.mockResolvedValue(
      policyRow({ dailyCeilingUsd: null, monthlyCeilingUsd: 2.0 })
    );
    ledgerSum(1.99);
    await expect(reserveBudget(CTX, 0.05)).rejects.toMatchObject({
      window: 'monthly',
    });
  });

  // -------------------------------------------------------------------------
  // Log-only modes proceed on breach
  // -------------------------------------------------------------------------
  it("proceeds (warn only) on breach when the policy row is 'log_only'", async () => {
    mockPolicyFindUnique.mockResolvedValue(
      policyRow({ dailyCeilingUsd: 1.0, enforcementMode: 'log_only' })
    );
    ledgerSum(5.0); // already way over

    const reservation = await reserveBudget(CTX, 0.05);
    expect(reservation).not.toBeNull();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('log-only'),
      expect.objectContaining({ organizationId: ORG, window: 'daily' })
    );
    await releaseReservation(reservation);
  });

  it('env-default ceilings (no policy row) are ALWAYS log-only — never throw', async () => {
    process.env.SYNTHEX_DEFAULT_DAILY_COST_CEILING_USD = '1.0';
    mockPolicyFindUnique.mockResolvedValue(null);
    ledgerSum(5.0); // over the env ceiling

    const reservation = await reserveBudget(CTX, 0.05);
    expect(reservation).not.toBeNull();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('log-only'),
      expect.objectContaining({ policySource: 'env_default' })
    );
    await releaseReservation(reservation);
  });

  // -------------------------------------------------------------------------
  // Reservation lifecycle
  // -------------------------------------------------------------------------
  it('reserve → commit decrements the in-flight counters exactly once (idempotent)', async () => {
    mockPolicyFindUnique.mockResolvedValue(policyRow({ dailyCeilingUsd: 10 }));
    ledgerSum(0);

    const reservation = await reserveBudget(CTX, 0.5);
    expect(reservation).not.toBeNull();
    expect(await inFlightDailyUsd()).toBeCloseTo(0.5);

    await commitActual(reservation);
    expect(await inFlightDailyUsd()).toBe(0);

    // Double-commit / late release are no-ops (settled flag).
    await commitActual(reservation);
    await releaseReservation(reservation);
    expect(await inFlightDailyUsd()).toBe(0);
  });

  it('reserve → release on failure returns the counters to zero', async () => {
    mockPolicyFindUnique.mockResolvedValue(policyRow({ dailyCeilingUsd: 10 }));
    ledgerSum(0);

    const reservation = await reserveBudget(CTX, 0.25);
    expect(await inFlightDailyUsd()).toBeCloseTo(0.25);
    await releaseReservation(reservation);
    expect(await inFlightDailyUsd()).toBe(0);
  });

  it('in-flight reservations count against a following reserve (pre-commit spend is visible)', async () => {
    mockPolicyFindUnique.mockResolvedValue(policyRow({ dailyCeilingUsd: 1.0 }));
    ledgerSum(0);

    const first = await reserveBudget(CTX, 0.6); // fits
    await expect(reserveBudget(CTX, 0.6)).rejects.toThrow(
      OrgBudgetExceededError
    ); // 0.6 in flight + 0.6 > 1.0
    await releaseReservation(first);

    // After release the same request fits again.
    const second = await reserveBudget(CTX, 0.6);
    expect(second).not.toBeNull();
    await releaseReservation(second);
  });

  // -------------------------------------------------------------------------
  // Concurrency (TOCTOU guard) — must_fix 8
  // -------------------------------------------------------------------------
  it('two parallel near-ceiling reserves: exactly one proceeds', async () => {
    mockPolicyFindUnique.mockResolvedValue(policyRow({ dailyCeilingUsd: 1.0 }));
    ledgerSum(0.4);

    const results = await Promise.allSettled([
      reserveBudget({ ...CTX, traceId: 'race-a' }, 0.35),
      reserveBudget({ ...CTX, traceId: 'race-b' }, 0.35),
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      OrgBudgetExceededError
    );

    // Loser rolled back; only the winner's amount remains in flight.
    expect(await inFlightDailyUsd()).toBeCloseTo(0.35);
    await releaseReservation(
      (fulfilled[0] as PromiseFulfilledResult<any>).value
    );
  });

  // -------------------------------------------------------------------------
  // previewBudget (enqueue fast-fail) + snapshot
  // -------------------------------------------------------------------------
  it('previewBudget throws under an enforcing row without holding a reservation', async () => {
    mockPolicyFindUnique.mockResolvedValue(policyRow({ dailyCeilingUsd: 1.0 }));
    ledgerSum(0.99);

    await expect(previewBudget(ORG, 0.05)).rejects.toThrow(
      OrgBudgetExceededError
    );
    expect(await inFlightDailyUsd()).toBe(0); // read-only — nothing reserved
  });

  it('previewBudget no-ops for absent policy and warns (not throws) for log_only', async () => {
    await expect(previewBudget(ORG, 100)).resolves.toBeUndefined();

    mockPolicyFindUnique.mockResolvedValue(
      policyRow({ dailyCeilingUsd: 1.0, enforcementMode: 'log_only' })
    );
    ledgerSum(5.0);
    await expect(previewBudget(ORG, 0.05)).resolves.toBeUndefined();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('log-only'),
      expect.anything()
    );
  });

  it('getOrgSpendSnapshot reports spend, in-flight, ceilings and mode', async () => {
    mockPolicyFindUnique.mockResolvedValue(
      policyRow({ dailyCeilingUsd: 10, monthlyCeilingUsd: 100 })
    );
    ledgerSum(1.25);

    const reservation = await reserveBudget(CTX, 0.5);
    const snapshot = await getOrgSpendSnapshot(ORG);
    expect(snapshot).toMatchObject({
      organizationId: ORG,
      dailySpendUsd: 1.25,
      monthlySpendUsd: 1.25,
      dailyCeilingUsd: 10,
      monthlyCeilingUsd: 100,
      enforcementMode: 'enforce',
      policySource: 'policy_row',
    });
    expect(snapshot.inFlightReservedUsd.daily).toBeCloseTo(0.5);
    expect(snapshot.inFlightReservedUsd.monthly).toBeCloseTo(0.5);
    await releaseReservation(reservation);
  });

  // -------------------------------------------------------------------------
  // Calendar estimator
  // -------------------------------------------------------------------------
  it('estimateCalendarGenerationCostUsd = days × platforms × postsPerDay × per-post estimate', async () => {
    const perPost = estimateContentGenerationCostUsd({ type: 'post' });
    expect(
      estimateCalendarGenerationCostUsd(7, ['twitter', 'linkedin'], 3)
    ).toBeCloseTo(7 * 2 * 3 * perPost, 6);
    // Accepts a count as well as a platform array.
    expect(estimateCalendarGenerationCostUsd(1, 4, 1)).toBeCloseTo(
      4 * perPost,
      6
    );
    expect(estimateCalendarGenerationCostUsd(0, 3, 2)).toBe(0);
  });
});
