/**
 * Org video-spend quota: monthly + daily caps with an MCP sub-cap.
 * Hold at submit, settle to actual at completion, release on failure.
 * Daily AND monthly counters reset lazily by date comparison at submit — no cron.
 * Spec: "Cost governance (all-day operation)".
 */
import prisma from '@/lib/prisma';
import { InitiatedBy, QuotaExceededError } from './types';

const MCP_DAILY_FRACTION = Number(
  process.env.VIDEO_MCP_DAILY_FRACTION ?? '0.5'
);

function isSameUtcDay(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

function isSameUtcMonth(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 7) === b.toISOString().slice(0, 7);
}

export async function holdQuota(
  organizationId: string,
  estimateUsd: number,
  initiatedBy: InitiatedBy
): Promise<void> {
  const quota = await prisma.organizationVideoQuota.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  });

  const now = new Date();
  const dayStale = !isSameUtcDay(new Date(quota.dayStart), now);
  const monthStale = !isSameUtcMonth(new Date(quota.periodStart), now);
  const monthly = Number(quota.monthlyBudgetUsd);
  const daily = Number(quota.dailyBudgetUsd);
  const mcpCap = daily * MCP_DAILY_FRACTION;

  if (dayStale || monthStale) {
    // Period rollover path: a stale period resets its counter(s) to the
    // estimate rather than incrementing. Guard the reset with a conditional
    // updateMany keyed on the *previous* periodStart/dayStart values so a
    // losing concurrent rollover (two requests rolling the same stale
    // period at once) no-ops instead of double-applying the reset — it
    // retries once against the now-fresh row via the standard path below.
    if (estimateUsd > monthly) {
      throw new QuotaExceededError('monthly', monthly, 0);
    }
    if (estimateUsd > daily) {
      throw new QuotaExceededError('daily', daily, 0);
    }
    if (initiatedBy === 'mcp' && estimateUsd > mcpCap) {
      throw new QuotaExceededError('mcp-daily', mcpCap, 0);
    }

    const data: Record<string, unknown> = {};
    if (monthStale) {
      data.periodStart = now;
      data.spentUsd = estimateUsd;
    } else {
      data.spentUsd = { increment: estimateUsd };
    }
    if (dayStale) {
      data.dayStart = now;
      data.spentTodayUsd = estimateUsd;
      data.spentTodayMcpUsd = initiatedBy === 'mcp' ? estimateUsd : 0;
    } else {
      data.spentTodayUsd = { increment: estimateUsd };
      if (initiatedBy === 'mcp') {
        data.spentTodayMcpUsd = { increment: estimateUsd };
      }
    }

    const result = await prisma.organizationVideoQuota.updateMany({
      where: {
        organizationId,
        ...(monthStale ? { periodStart: quota.periodStart } : {}),
        ...(dayStale ? { dayStart: quota.dayStart } : {}),
      },
      data,
    });

    if (result.count === 0) {
      // Lost the rollover race to a concurrent hold — retry once against the
      // now-fresh (already-rolled) row.
      return holdQuota(organizationId, estimateUsd, initiatedBy);
    }
    return;
  }

  // Common path (same period, no rollover): close the TOCTOU race with a
  // single conditional updateMany — `spent + amount <= cap`, expressed as
  // `spent <= cap - amount` so the comparison is against a fixed threshold
  // rather than requiring column-to-column arithmetic. Postgres evaluates the
  // WHERE predicate under the row lock it takes for the UPDATE, so two
  // concurrent holds are serialised: the second sees the first's committed
  // spend and correctly no-ops (count 0) once the cap would be exceeded,
  // instead of the previous read-then-write gap allowing both through.
  const result = await prisma.organizationVideoQuota.updateMany({
    where: {
      organizationId,
      spentUsd: { lte: monthly - estimateUsd },
      spentTodayUsd: { lte: daily - estimateUsd },
      ...(initiatedBy === 'mcp'
        ? { spentTodayMcpUsd: { lte: mcpCap - estimateUsd } }
        : {}),
    },
    data: {
      spentUsd: { increment: estimateUsd },
      spentTodayUsd: { increment: estimateUsd },
      ...(initiatedBy === 'mcp'
        ? { spentTodayMcpUsd: { increment: estimateUsd } }
        : {}),
    },
  });

  if (result.count === 0) {
    // Best-effort re-read purely to build a useful error message — never the
    // source of truth for whether the hold succeeded (the conditional
    // updateMany above already is).
    const current = await prisma.organizationVideoQuota.findUnique({
      where: { organizationId },
    });
    const spentMonth = Number(current?.spentUsd ?? monthly);
    const spentToday = Number(current?.spentTodayUsd ?? daily);
    const spentMcp = Number(current?.spentTodayMcpUsd ?? mcpCap);

    if (spentMonth + estimateUsd > monthly) {
      throw new QuotaExceededError('monthly', monthly, spentMonth);
    }
    if (spentToday + estimateUsd > daily) {
      throw new QuotaExceededError('daily', daily, spentToday);
    }
    throw new QuotaExceededError('mcp-daily', mcpCap, spentMcp);
  }
}

/** Adjust a previous hold to the actual cost (delta may be negative or positive). */
export async function settleQuota(
  organizationId: string,
  heldUsd: number,
  actualUsd: number,
  initiatedBy: InitiatedBy
): Promise<void> {
  const delta = Math.round((actualUsd - heldUsd) * 10000) / 10000;
  if (delta === 0) return;
  await prisma.organizationVideoQuota.update({
    where: { organizationId },
    data: {
      spentUsd: { increment: delta },
      spentTodayUsd: { increment: delta },
      ...(initiatedBy === 'mcp'
        ? { spentTodayMcpUsd: { increment: delta } }
        : {}),
    },
  });
}

/** Return a full hold (failed job). */
export async function releaseQuota(
  organizationId: string,
  heldUsd: number,
  initiatedBy: InitiatedBy
): Promise<void> {
  await prisma.organizationVideoQuota.update({
    where: { organizationId },
    data: {
      spentUsd: { increment: -heldUsd },
      spentTodayUsd: { increment: -heldUsd },
      ...(initiatedBy === 'mcp'
        ? { spentTodayMcpUsd: { increment: -heldUsd } }
        : {}),
    },
  });
}

/** Read-only snapshot for UI banner / MCP budgetWarning (>=80% of any cap). */
export async function quotaSnapshot(organizationId: string) {
  const q = await prisma.organizationVideoQuota.findUnique({
    where: { organizationId },
  });
  if (!q)
    return {
      spentUsd: 0,
      monthlyBudgetUsd: 25,
      spentTodayUsd: 0,
      dailyBudgetUsd: 5,
      warning: false,
    };
  const dayStale = !isSameUtcDay(new Date(q.dayStart), new Date());
  const monthStale = !isSameUtcMonth(new Date(q.periodStart), new Date());
  const spentToday = dayStale ? 0 : Number(q.spentTodayUsd);
  const spentMonth = monthStale ? 0 : Number(q.spentUsd);
  const warning =
    spentMonth >= 0.8 * Number(q.monthlyBudgetUsd) ||
    spentToday >= 0.8 * Number(q.dailyBudgetUsd);
  return {
    spentUsd: spentMonth,
    monthlyBudgetUsd: Number(q.monthlyBudgetUsd),
    spentTodayUsd: spentToday,
    dailyBudgetUsd: Number(q.dailyBudgetUsd),
    warning,
  };
}
