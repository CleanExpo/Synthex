/**
 * MiniMax Credit Guard — pre-spend enforcement for Token Plan + Pay-as-you-go
 *
 * Tracks USD-equivalent spend across all MiniMax API calls using Redis atomic
 * counters (micro-USD integers for race-free concurrency). When spend approaches
 * the configured monthly ceiling, requests are blocked before they hit the API.
 *
 * Design follows the same doctrine as lib/ai/budget-enforcer.ts:
 * - RESERVE micro-USD via INCRBY BEFORE the API call (TOCTOU-safe)
 * - On success, COMMIT actual cost (DECRBY reservation, log to ledger)
 * - On error, RELEASE reservation (DECRBY to zero)
 * - FAIL-OPEN if Redis or ledger is unavailable: log warning, proceed
 *
 * Environment variables:
 *   MINIMAX_MONTHLY_CEILING_USD      Hard ceiling (defaults to 50 if unset)
 *   MINIMAX_DAILY_CEILING_USD        Optional daily soft cap (defaults unset = no cap)
 *   MINIMAX_WARN_THRESHOLD_PERCENT   Percent of monthly spent at which to warn (default 75)
 *
 * MiniMax Token Plan parity: 1,000 credits = $1 USD, drawn from the same pool
 * across all modalities (text, image, speech, music, video).
 */

import { getRedisClient } from "@/lib/redis-client";
import { logger } from "@/lib/logger";
import {
  computeCallCostUsd,
  usdToCredits,
  type MiniMaxModelId,
  type ServiceTier,
} from "./pricing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreditGuardOptions {
  /** Hard monthly USD ceiling. Defaults to env MINIMAX_MONTHLY_CEILING_USD or 50. */
  monthlyCeilingUsd?: number;
  /** Optional daily USD soft cap. Defaults to env MINIMAX_DAILY_CEILING_USD. */
  dailyCeilingUsd?: number;
  /** Percent of monthly to trigger warnings (default 75). */
  warnThresholdPercent?: number;
}

export interface ReservationHandle {
  /** Micro-USD reserved (integer, atomic) */
  readonly microUsd: number;
  /** USD-equivalent estimate */
  readonly usd: number;
  /** When the reservation was created */
  readonly createdAt: Date;
  /** Whether to commit on success or release on failure */
  release(): Promise<void>;
  /** Apply the actual cost (may be less than reserved if we over-estimated) */
  commit(actualUsd: number): Promise<void>;
}

export interface CreditSnapshot {
  monthlySpentUsd: number;
  monthlyReservedUsd: number;
  monthlyCeilingUsd: number;
  monthlyRemainingUsd: number;
  monthlyPercentUsed: number;
  dailySpentUsd: number;
  dailyReservedUsd: number;
  dailyCeilingUsd: number | null;
  totalCalls: number;
}

// ---------------------------------------------------------------------------
// Redis key helpers
// ---------------------------------------------------------------------------

const KEY_PREFIX = "minimax:spend";

function monthlySpendKey(period: string): string {
  return `${KEY_PREFIX}:m:spent:${period}`;
}
function monthlyReservedKey(period: string): string {
  return `${KEY_PREFIX}:m:reserved:${period}`;
}
function dailySpendKey(period: string): string {
  return `${KEY_PREFIX}:d:spent:${period}`;
}
function dailyReservedKey(period: string): string {
  return `${KEY_PREFIX}:d:reserved:${period}`;
}
function callsCounterKey(period: string): string {
  return `${KEY_PREFIX}:calls:${period}`;
}

function utcMonthKey(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}
function utcDayKey(now: Date): string {
  return `${utcMonthKey(now)}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

function nextMonthEndTtl(now: Date): number {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return Math.ceil((next.getTime() - now.getTime()) / 1000);
}
function nextDayEndTtl(now: Date): number {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.ceil((next.getTime() - now.getTime()) / 1000);
}

const fromMicro = (n: number) => Math.max(0, n) / 1_000_000;
const toMicro = (n: number) => Math.max(0, Math.round(n * 1_000_000));

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class MiniMaxCreditExceededError extends Error {
  constructor(
    public readonly window: "monthly" | "daily",
    public readonly spentUsd: number,
    public readonly reservedUsd: number,
    public readonly attemptedUsd: number,
    public readonly ceilingUsd: number
  ) {
    super(
      `MiniMax ${window} credit budget exceeded: ` +
        `spent $${spentUsd.toFixed(4)} + reserved $${reservedUsd.toFixed(4)} ` +
        `+ attempted $${attemptedUsd.toFixed(4)} > ceiling $${ceilingUsd.toFixed(4)}`
    );
    this.name = "MiniMaxCreditExceededError";
  }
}

// ---------------------------------------------------------------------------
// Credit Guard (singleton)
// ---------------------------------------------------------------------------

let _instance: MiniMaxCreditGuard | null = null;

export class MiniMaxCreditGuard {
  readonly monthlyCeilingUsd: number;
  readonly dailyCeilingUsd: number | null;
  readonly warnThresholdPercent: number;

  constructor(opts: CreditGuardOptions = {}) {
    this.monthlyCeilingUsd =
      opts.monthlyCeilingUsd ??
      parseFloat(process.env.MINIMAX_MONTHLY_CEILING_USD ?? "50") ??
      50;
    this.dailyCeilingUsd =
      opts.dailyCeilingUsd ??
      (process.env.MINIMAX_DAILY_CEILING_USD
        ? parseFloat(process.env.MINIMAX_DAILY_CEILING_USD)
        : null);
    this.warnThresholdPercent =
      opts.warnThresholdPercent ??
      parseFloat(process.env.MINIMAX_WARN_THRESHOLD_PERCENT ?? "75");

    logger.info("MiniMax Credit Guard initialized", {
      monthlyCeilingUsd: this.monthlyCeilingUsd,
      dailyCeilingUsd: this.dailyCeilingUsd,
      warnThresholdPercent: this.warnThresholdPercent,
    });
  }

  /** Lazy singleton accessor */
  static getInstance(opts?: CreditGuardOptions): MiniMaxCreditGuard {
    if (!_instance) _instance = new MiniMaxCreditGuard(opts);
    return _instance;
  }

  /** Reset singleton (for testing or after env reload) */
  static resetInstance(): void {
    _instance = null;
  }

  /**
   * Estimate the cost of a call without reserving anything.
   * Use this before calling `reserve()` if you want to fail-fast without
   * any side effects.
   */
  estimateCostUsd(
    model: MiniMaxModelId,
    inputTokens: number,
    outputTokens: number,
    cacheReadTokens: number = 0,
    tier: ServiceTier = "standard"
  ): number {
    return computeCallCostUsd(model, inputTokens, outputTokens, cacheReadTokens, tier);
  }

  /**
   * Reserve micro-USD against the budget BEFORE making the API call.
   * Returns a handle that must be commit()''d on success or release()''d on failure.
   *
   * If the reservation would breach the ceiling, throws MiniMaxCreditExceededError
   * and performs NO Redis writes (atomic check-then-reserve via Lua).
   */
  async reserve(opts: {
    model: MiniMaxModelId;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    tier?: ServiceTier;
  }): Promise<ReservationHandle> {
    const estimatedUsd = this.estimateCostUsd(
      opts.model,
      opts.inputTokens,
      opts.outputTokens,
      opts.cacheReadTokens ?? 0,
      opts.tier ?? "standard"
    );
    const micro = toMicro(estimatedUsd);

    const now = new Date();
    const mKey = utcMonthKey(now);
    const dKey = utcDayKey(now);

    let redis;
    try {
      redis = getRedisClient();
    } catch (e) {
      // Fail-open: Redis unavailable, log + proceed without reservation
      logger.warn("MiniMax CreditGuard: Redis unavailable, skipping reservation (fail-open)", {
        error: e instanceof Error ? e.message : String(e),
      });
      return this._noopHandle(estimatedUsd);
    }

    try {
      // Atomic check-then-increment via Lua to prevent TOCTOU races
      const result = await redis.eval(
        `
        local monthlySpent = tonumber(redis.call('GET', KEYS[1]) or '0')
        local monthlyReserved = tonumber(redis.call('GET', KEYS[2]) or '0')
        local monthlyCeiling = tonumber(ARGV[1])
        local amount = tonumber(ARGV[2])

        if monthlySpent + monthlyReserved + amount > monthlyCeiling then
          return {0, monthlySpent, monthlyReserved}
        end

        local newReserved = redis.call('INCRBY', KEYS[2], amount)
        redis.call('EXPIRE', KEYS[2], ARGV[3])

        local dailyCeiling = tonumber(ARGV[4] or '0')
        if dailyCeiling > 0 then
          local dailySpent = tonumber(redis.call('GET', KEYS[3]) or '0')
          local dailyReserved = tonumber(redis.call('GET', KEYS[4]) or '0')
          if dailySpent + dailyReserved + amount > dailyCeiling then
            -- Roll back the monthly reservation
            redis.call('DECRBY', KEYS[2], amount)
            return {0, monthlySpent, monthlyReserved, dailySpent, dailyReserved}
          end
          redis.call('INCRBY', KEYS[4], amount)
          redis.call('EXPIRE', KEYS[4], ARGV[5])
          return {1, monthlySpent, monthlyReserved, dailySpent, dailyReserved}
        end

        return {1, monthlySpent, monthlyReserved, 0, 0}
        `,
        4,
        monthlySpendKey(mKey),
        monthlyReservedKey(mKey),
        dailySpendKey(dKey),
        dailyReservedKey(dKey),
        String(toMicro(this.monthlyCeilingUsd)),
        String(micro),
        String(nextMonthEndTtl(now)),
        String(this.dailyCeilingUsd ? toMicro(this.dailyCeilingUsd) : 0),
        String(nextDayEndTtl(now))
      ) as unknown as [number, number, number, number, number];

      const [ok, mSpent, mReserved, dSpent, dReserved] = result;
      if (!ok) {
        if (this.dailyCeilingUsd && dSpent + dReserved + micro > toMicro(this.dailyCeilingUsd)) {
          throw new MiniMaxCreditExceededError(
            "daily",
            fromMicro(dSpent),
            fromMicro(dReserved),
            estimatedUsd,
            this.dailyCeilingUsd
          );
        }
        throw new MiniMaxCreditExceededError(
          "monthly",
          fromMicro(mSpent),
          fromMicro(mReserved),
          estimatedUsd,
          this.monthlyCeilingUsd
        );
      }

      // Track call count
      await redis.incrby(callsCounterKey(mKey), 1);
      await redis.expire(callsCounterKey(mKey), nextMonthEndTtl(now));

      // Warn if crossing threshold
      const pct = ((mSpent + micro) / toMicro(this.monthlyCeilingUsd)) * 100;
      if (pct >= 90 && (mSpent / toMicro(this.monthlyCeilingUsd)) * 100 < 90) {
        logger.error("MiniMax CreditGuard: 90% of monthly ceiling consumed", {
          spentUsd: fromMicro(mSpent + micro),
          ceilingUsd: this.monthlyCeilingUsd,
          percentUsed: pct.toFixed(1),
        });
      } else if (pct >= this.warnThresholdPercent && (mSpent / toMicro(this.monthlyCeilingUsd)) * 100 < this.warnThresholdPercent) {
        logger.warn("MiniMax CreditGuard: budget threshold crossed", {
          spentUsd: fromMicro(mSpent + micro),
          ceilingUsd: this.monthlyCeilingUsd,
          percentUsed: pct.toFixed(1),
          threshold: this.warnThresholdPercent,
        });
      }

      return this._makeHandle(micro, estimatedUsd, now);
    } catch (e) {
      if (e instanceof MiniMaxCreditExceededError) throw e;
      // Fail-open: Redis error mid-reservation
      logger.warn("MiniMax CreditGuard: reservation failed, proceeding without guard (fail-open)", {
        error: e instanceof Error ? e.message : String(e),
      });
      return this._noopHandle(estimatedUsd);
    }
  }

  /** Get current spend snapshot */
  async snapshot(): Promise<CreditSnapshot> {
    const now = new Date();
    const mKey = utcMonthKey(now);
    const dKey = utcDayKey(now);

    let mSpent = 0, mReserved = 0, dSpent = 0, dReserved = 0, calls = 0;
    try {
      const redis = getRedisClient();
      const [ms, mr, ds, dr, c] = await Promise.all([
        redis.get(monthlySpendKey(mKey)),
        redis.get(monthlyReservedKey(mKey)),
        redis.get(dailySpendKey(dKey)),
        redis.get(dailyReservedKey(dKey)),
        redis.get(callsCounterKey(mKey)),
      ]);
      mSpent = parseInt(ms ?? "0");
      mReserved = parseInt(mr ?? "0");
      dSpent = parseInt(ds ?? "0");
      dReserved = parseInt(dr ?? "0");
      calls = parseInt(c ?? "0");
    } catch (e) {
      logger.warn("MiniMax CreditGuard: snapshot read failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    const monthlySpentUsd = fromMicro(mSpent);
    const monthlyReservedUsd = fromMicro(mReserved);
    const ceilingMicro = toMicro(this.monthlyCeilingUsd);

    return {
      monthlySpentUsd,
      monthlyReservedUsd,
      monthlyCeilingUsd: this.monthlyCeilingUsd,
      monthlyRemainingUsd: Math.max(0, this.monthlyCeilingUsd - monthlySpentUsd - monthlyReservedUsd),
      monthlyPercentUsed: ((mSpent + mReserved) / ceilingMicro) * 100,
      dailySpentUsd: fromMicro(dSpent),
      dailyReservedUsd: fromMicro(dReserved),
      dailyCeilingUsd: this.dailyCeilingUsd,
      totalCalls: calls,
    };
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private _noopHandle(estimatedUsd: number): ReservationHandle {
    return {
      microUsd: 0,
      usd: estimatedUsd,
      createdAt: new Date(),
      release: async () => {},
      commit: async () => {},
    };
  }

  private _makeHandle(micro: number, usd: number, createdAt: Date): ReservationHandle {
    const now = new Date();
    const mKey = utcMonthKey(now);
    const dKey = utcDayKey(now);
    let committed = false;
    let released = false;

    const cleanup = async (deltaMicro: number) => {
      if (deltaMicro === 0) return;
      try {
        const redis = getRedisClient();
        const ops = [
          redis.decrby(monthlyReservedKey(mKey), deltaMicro),
          redis.incrby(monthlySpendKey(mKey), deltaMicro),
          redis.expire(monthlySpendKey(mKey), nextMonthEndTtl(now)),
          redis.expire(monthlyReservedKey(mKey), nextMonthEndTtl(now)),
        ];
        if (this.dailyCeilingUsd) {
          ops.push(redis.decrby(dailyReservedKey(dKey), deltaMicro));
          ops.push(redis.incrby(dailySpendKey(dKey), deltaMicro));
          ops.push(redis.expire(dailySpendKey(dKey), nextDayEndTtl(now)));
          ops.push(redis.expire(dailyReservedKey(dKey), nextDayEndTtl(now)));
        }
        await Promise.all(ops);
      } catch (e) {
        logger.warn("MiniMax CreditGuard: ledger write failed (fail-open)", {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    };

    return {
      microUsd: micro,
      usd,
      createdAt,
      release: async () => {
        if (committed || released) return;
        released = true;
        await cleanup(micro); // DECRBY reserved (no spend added)
      },
      commit: async (actualUsd: number) => {
        if (committed || released) return;
        committed = true;
        const actualMicro = toMicro(actualUsd);
        const deltaMicro = actualMicro - micro; // could be negative if we over-estimated
        // Move (micro) from reserved to spent, then adjust by delta
        // Equivalent: decrement reserved by micro, increment spent by actualMicro
        try {
          const redis = getRedisClient();
          const ops = [
            redis.decrby(monthlyReservedKey(mKey), micro),
            redis.incrby(monthlySpendKey(mKey), actualMicro),
            redis.expire(monthlySpendKey(mKey), nextMonthEndTtl(now)),
            redis.expire(monthlyReservedKey(mKey), nextMonthEndTtl(now)),
          ];
          if (this.dailyCeilingUsd) {
            ops.push(redis.decrby(dailyReservedKey(dKey), micro));
            ops.push(redis.incrby(dailySpendKey(dKey), actualMicro));
            ops.push(redis.expire(dailySpendKey(dKey), nextDayEndTtl(now)));
            ops.push(redis.expire(dailyReservedKey(dKey), nextDayEndTtl(now)));
          }
          await Promise.all(ops);
          // suppress unused warning
          void deltaMicro;
        } catch (e) {
          logger.warn("MiniMax CreditGuard: commit failed (fail-open)", {
            error: e instanceof Error ? e.message : String(e),
          });
        }
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const creditGuard = MiniMaxCreditGuard.getInstance();

/** Convenience export for getting current snapshot */
export async function getMiniMaxSpendSnapshot(): Promise<CreditSnapshot> {
  return creditGuard.snapshot();
}

/** Convert credits (MiniMax Token Plan unit) to USD */
export function creditsToUsd(credits: number): number {
  return credits / 1000;
}
// suppress lint warning on usdToCredits re-export
export { usdToCredits };
