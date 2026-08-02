/**
 * Shared jest mock for the media spend log (SYN-1115).
 *
 * Image generation reserves against the append-only spend log before any
 * provider call, which means every suite that exercises generateImage /
 * generateBatch / generateVariations reaches Prisma. These suites test
 * generation behaviour, not accounting, so they stub the log primitives out.
 *
 * The log's own behaviour is NOT mocked away from its own coverage — the
 * idempotency and ceiling semantics are proven in
 * tests/integration/media-spend-log.integration.test.ts against a real
 * database, which is the only place they can be proven.
 *
 * Usage — at the top of a suite, before importing the service:
 *
 *   jest.mock('@/lib/services/ai/image/spend-log', () =>
 *     jest.requireActual('../../support/mock-media-quota').mockSpendLog()
 *   );
 */

/**
 * Permissive by default: reservations succeed. Pass `{ reserveRejectsWith }`
 * to simulate an over-budget organisation without needing a database.
 */
export function mockSpendLog(opts?: { reserveRejectsWith?: Error }) {
  // PLAIN async functions, not jest.fn — the unit profile sets resetMocks,
  // which wipes a jest.fn's implementation between tests and makes it return
  // undefined. Anything whose RETURN VALUE the code under test depends on must
  // therefore not be a jest.fn here.
  return {
    reserveSpend: async (params: { holdId: string }) => {
      if (opts?.reserveRejectsWith) throw opts.reserveRejectsWith;
      return { holdId: params.holdId, heldUsd: 0 };
    },
    finalizeSpend: async () => true,
    // SYN-1115 round-7: every real provider call records an attempt, and
    // settlement derives its amount from them.
    recordAttempt: async () => undefined,
    attemptTotals: async () => ({
      count: 0,
      knownCostUsd: 0,
      unknownCount: 0,
    }),
    // No attempts recorded in a mocked run ⇒ nothing was spent.
    settlementAmountUsd: async () => 0,
    findStaleReservations: async () => [],
    spendSnapshot: async () => ({
      dailyUsd: 0,
      monthlyUsd: 0,
      mcpDailyUsd: 0,
      dailyCapUsd: 5,
      monthlyCapUsd: 25,
    }),
    reserveKey: (holdId: string) => `hold:${holdId}:reserve`,
    finalizeKey: (holdId: string) => `hold:${holdId}:final`,
  };
}

/** Legacy alias — some suites still mock the video quota module directly. */
export function mockMediaQuota(opts?: { holdRejectsWith?: Error }) {
  const holdQuota = jest.fn(async () => {
    if (opts?.holdRejectsWith) throw opts.holdRejectsWith;
  });
  return {
    holdQuota,
    settleQuota: jest.fn(async () => undefined),
    releaseQuota: jest.fn(async () => undefined),
    quotaSnapshot: jest.fn(async () => ({
      spentUsd: 0,
      monthlyBudgetUsd: 25,
      spentTodayUsd: 0,
      dailyBudgetUsd: 5,
      warning: false,
    })),
  };
}
