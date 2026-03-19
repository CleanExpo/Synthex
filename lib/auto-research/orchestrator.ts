/**
 * Auto-Research Orchestrator
 *
 * Coordinates the full research loop:
 * 1. Create run record in DB
 * 2. Scrape platforms via Apify
 * 3. Analyse posts with AI
 * 4. Store TrendInsights in DB
 * 5. Mark insights as applied via PromptOptimiser
 * 6. Update run record with results
 */
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { runActor } from './apify/client';
import { ACTOR_REGISTRY } from './apify/actors';
import { analyseScrapedPosts } from './trend-analyzer';
import { optimisePrompts } from './prompt-optimizer';
import type { SupportedPlatform, ResearchResult } from './types';
import type { ScrapedPost } from './apify/types';

const QUICK_PLATFORMS: SupportedPlatform[] = ['instagram', 'tiktok', 'twitter'];
const DEEP_PLATFORMS: SupportedPlatform[] = [
  'instagram',
  'tiktok',
  'twitter',
  'linkedin',
  'facebook',
  'google',
];
const QUICK_LIMIT = 50;
const DEEP_LIMIT = 200;

async function runResearch(
  platforms: SupportedPlatform[],
  limit: number,
  orgId?: string
): Promise<ResearchResult> {
  // 1. Create run record
  const run = await prisma.autoResearchRun.create({
    data: {
      runType: limit === QUICK_LIMIT ? 'daily_trends' : 'weekly_deep',
      status: 'running',
      platforms,
      organizationId: orgId ?? null,
    },
  });

  logger.info('AutoResearch: run started', {
    runId: run.id,
    platforms,
    limit,
    orgId,
  });

  try {
    let totalInsights = 0;

    for (const platform of platforms) {
      const actor = ACTOR_REGISTRY[platform];
      if (!actor) continue;

      try {
        // 2. Scrape via Apify
        const posts = await runActor<ScrapedPost>(
          actor.actorId,
          actor.buildInput({ limit })
        );

        logger.info('AutoResearch: scraped platform', {
          platform,
          postCount: posts.length,
        });

        // 3. Analyse with AI
        const insights = await analyseScrapedPosts(platform, posts);

        if (insights.length === 0) continue;

        // 4. Store insights
        // Set validUntil to 14 days from now
        const validUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

        await prisma.trendInsight.createMany({
          data: insights.map(insight => ({
            platform: insight.platform,
            category: insight.category,
            insight: insight.insight,
            confidence: insight.confidence,
            dataPoints: insight.dataPoints,
            validUntil,
            organizationId: orgId ?? null,
            runId: run.id,
          })),
        });

        totalInsights += insights.length;
        logger.info('AutoResearch: insights stored', {
          platform,
          count: insights.length,
        });
      } catch (platformErr) {
        logger.error('AutoResearch: platform scrape failed', {
          platform,
          error: platformErr,
        });
        // Continue with other platforms
      }
    }

    // 5. Mark insights as applied via prompt optimiser
    const optimResult = await optimisePrompts(run.id, orgId);

    // 6. Update run as completed
    await prisma.autoResearchRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        insightsCount: totalInsights,
        promptsUpdated: optimResult.insightsApplied,
        completedAt: new Date(),
      },
    });

    logger.info('AutoResearch: run completed', {
      runId: run.id,
      totalInsights,
    });

    return {
      runId: run.id,
      insightsExtracted: totalInsights,
      promptsUpdated: optimResult.insightsApplied,
      platformsScraped: platforms,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await prisma.autoResearchRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        error: errorMessage,
        completedAt: new Date(),
      },
    });

    logger.error('AutoResearch: run failed', { runId: run.id, error: err });

    return {
      runId: run.id,
      insightsExtracted: 0,
      promptsUpdated: 0,
      platformsScraped: [],
      error: errorMessage,
    };
  }
}

export function runDailyTrends(orgId?: string): Promise<ResearchResult> {
  return runResearch(QUICK_PLATFORMS, QUICK_LIMIT, orgId);
}

export function runWeeklyDeep(orgId?: string): Promise<ResearchResult> {
  return runResearch(DEEP_PLATFORMS, DEEP_LIMIT, orgId);
}
