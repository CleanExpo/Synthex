/**
 * Shared jest mock for the media spend quota (SYN-1115).
 *
 * The image service now holds against the organisation's shared media budget
 * before any provider call, which means every test that exercises
 * generateImage / generateBatch / generateVariations reaches Prisma. These
 * suites are unit tests of generation behaviour, not of the quota, so they stub
 * the quota primitives out.
 *
 * The quota itself is NOT mocked away from its own coverage: its real
 * behaviour — conditional updateMany under the row lock, rollover, TOCTOU —
 * is proven by tests/unit/lib/services/ai/video/quota.test.ts and
 * __tests__/video-engine/quota.test.ts, which import it directly and are
 * deliberately untouched by this ticket so they remain a clean regression
 * control.
 *
 * Usage — at the top of a suite, before importing the service:
 *
 *   jest.mock('@/lib/services/ai/video/quota', () =>
 *     require('../../support/mock-media-quota').mockMediaQuota()
 *   );
 */

export interface MediaQuotaMock {
  holdQuota: jest.Mock;
  settleQuota: jest.Mock;
  releaseQuota: jest.Mock;
  quotaSnapshot: jest.Mock;
}

/**
 * Permissive by default: holds succeed. Pass `{ holdRejectsWith }` to simulate
 * an over-budget organisation without needing a database.
 */
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
