/**
 * Org video-spend quota: monthly + daily caps with an MCP sub-cap.
 * Hold at submit, settle to actual at completion, release on failure.
 * Daily AND monthly counters reset lazily by date comparison at submit — no cron.
 * Spec: "Cost governance (all-day operation)".
 */
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
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
  // Optimistic read-then-write: two concurrent holds can briefly overrun a cap
  // by one estimate. Acceptable at internal-tool volume; SELECT ... FOR UPDATE
  // via $queryRaw is the upgrade path if generation becomes high-concurrency.
  await prisma.$transaction(async tx => {
    const quota = await (
      tx as Prisma.TransactionClient
    ).organizationVideoQuota.upsert({
      where: { organizationId },
      create: { organizationId },
      update: {},
    });

    const now = new Date();
    const dayStale = !isSameUtcDay(new Date(quota.dayStart), now);
    const monthStale = !isSameUtcMonth(new Date(quota.periodStart), now);
    const spentToday = dayStale ? 0 : Number(quota.spentTodayUsd);
    const spentTodayMcp = dayStale ? 0 : Number(quota.spentTodayMcpUsd);
    const monthly = Number(quota.monthlyBudgetUsd);
    const daily = Number(quota.dailyBudgetUsd);
    const spentMonth = monthStale ? 0 : Number(quota.spentUsd);

    if (spentMonth + estimateUsd > monthly) {
      throw new QuotaExceededError('monthly', monthly, spentMonth);
    }
    if (spentToday + estimateUsd > daily) {
      throw new QuotaExceededError('daily', daily, spentToday);
    }
    if (
      initiatedBy === 'mcp' &&
      spentTodayMcp + estimateUsd > daily * MCP_DAILY_FRACTION
    ) {
      throw new QuotaExceededError(
        'mcp-daily',
        daily * MCP_DAILY_FRACTION,
        spentTodayMcp
      );
    }

    // Lazy resets: a stale period sets the counter to the new estimate
    // instead of incrementing; otherwise atomic increment.
    const data: Record<string, unknown> = {
      spentUsd: monthStale ? estimateUsd : { increment: estimateUsd },
      spentTodayUsd: dayStale ? estimateUsd : { increment: estimateUsd },
    };
    if (monthStale) data.periodStart = now;
    if (dayStale) {
      data.dayStart = now;
      data.spentTodayMcpUsd = initiatedBy === 'mcp' ? estimateUsd : 0;
    } else if (initiatedBy === 'mcp') {
      data.spentTodayMcpUsd = { increment: estimateUsd };
    }
    await (tx as Prisma.TransactionClient).organizationVideoQuota.update({
      where: { organizationId },
      data,
    });
  });
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
