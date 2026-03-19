/**
 * Prompt Optimiser
 *
 * Reads recent high-confidence TrendInsights from the database and
 * logs a summary of insights that should inform content generation.
 * The actual injection into prompts happens in content-generator.ts.
 */
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface OptimisationResult {
  insightsApplied: number;
  platformsUpdated: string[];
}

/**
 * Mark recent high-confidence insights as applied and return a summary.
 * The content generator will read these insights at generation time.
 */
export async function optimisePrompts(
  runId: string,
  orgId?: string
): Promise<OptimisationResult> {
  // Fetch high-confidence insights from this run
  const insights = await prisma.trendInsight.findMany({
    where: {
      runId,
      confidence: { gte: 0.7 },
      applied: false,
      OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
    },
    orderBy: { confidence: 'desc' },
    take: 50,
  });

  if (insights.length === 0) {
    return { insightsApplied: 0, platformsUpdated: [] };
  }

  // Mark insights as applied
  await prisma.trendInsight.updateMany({
    where: { id: { in: insights.map(i => i.id) } },
    data: { applied: true },
  });

  const platformsUpdated = [...new Set(insights.map(i => i.platform))];

  logger.info('PromptOptimiser: insights applied', {
    count: insights.length,
    platforms: platformsUpdated,
    runId,
  });

  return { insightsApplied: insights.length, platformsUpdated };
}
