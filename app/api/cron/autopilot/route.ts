/**
 * Daily Autopilot Cron
 *
 * GET /api/cron/autopilot
 * Runs daily at 2 AM UTC via Vercel Cron.
 *
 * For each org with autopilot enabled and nextRunAt <= now:
 *   1. Plan daily content (detect gaps in the horizon)
 *   2. Generate content for each gap slot
 *   3. Score → quality gate → schedule or draft
 *   4. Update config.lastRunAt, config.nextRunAt
 *   5. Record AutopilotRun
 *
 * @module app/api/cron/autopilot/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { AIContentGenerator } from '@/lib/ai/content-generator';
import type { ContentRequest } from '@/lib/ai/content-generator';
import type { Platform } from '@/lib/ml/posting-time-predictor';
import { planDailyContent } from '@/lib/autopilot/daily-planner';
import { evaluateContent, scoreDimensions } from '@/lib/autopilot/quality-gate';
import type { ContentMix, ContentTheme } from '@/lib/autopilot/types';
import { PLATFORM_SPECS, THEME_PROMPTS } from '@/lib/autopilot/types';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

const MAX_REGENERATION_ATTEMPTS = 2;
const VALID_PLATFORMS: Platform[] = [
  'twitter',
  'instagram',
  'linkedin',
  'facebook',
  'tiktok',
  'youtube',
];

export async function GET(request: NextRequest) {
  const auth = verifyCronRequest(request, 'AUTOPILOT');
  if (!auth.ok) return auth.response;

  const startTime = Date.now();
  logger.info('cron:autopilot:start', { timestamp: new Date().toISOString() });

  try {
    const now = new Date();

    // Find all orgs with enabled autopilot that are due for a run
    const configs = await prisma.autopilotConfig.findMany({
      where: {
        enabled: true,
        nextRunAt: { lte: now },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            industry: true,
            brandDna: {
              select: {
                businessName: true,
                industry: true,
                brandVoice: true,
                offerings: true,
              },
            },
            users: {
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    logger.info('cron:autopilot:orgs-found', { count: configs.length });

    let totalGenerated = 0;
    let totalOrgsProcessed = 0;

    for (const config of configs) {
      try {
        // Mark as generating
        await prisma.autopilotConfig.update({
          where: { id: config.id },
          data: { status: 'generating' },
        });

        const org = config.organization;
        const userId = org.users[0]?.id;
        if (!userId) continue;

        // Plan what content is needed
        const plan = await planDailyContent(
          org.id,
          config.enabledPlatforms,
          config.planningHorizonDays,
          config.postsPerDayPerPlatform,
          config.contentMix as ContentMix
        );

        if (plan.slots.length === 0) {
          await prisma.autopilotConfig.update({
            where: { id: config.id },
            data: {
              status: 'idle',
              lastRunAt: now,
              nextRunAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
              lastErrorMessage: null,
            },
          });
          continue;
        }

        // Find or create autopilot campaign
        let campaign = await prisma.campaign.findFirst({
          where: {
            organizationId: org.id,
            settings: { path: ['source'], equals: 'autopilot' },
            status: 'active',
          },
          select: { id: true },
        });

        if (!campaign) {
          campaign = await prisma.campaign.create({
            data: {
              name: `Autopilot Content — ${org.brandDna?.businessName ?? org.name}`,
              platform: config.enabledPlatforms[0] ?? 'instagram',
              status: 'active',
              userId,
              organizationId: org.id,
              settings: { source: 'autopilot', generatedAt: now.toISOString() },
            },
            select: { id: true },
          });
        }

        // Generate content for each slot
        const generator = new AIContentGenerator();
        const brandVoice = org.brandDna?.brandVoice as Record<
          string,
          unknown
        > | null;
        const tone = (brandVoice?.tone as string) ?? 'professional';
        const offerings = (org.brandDna?.offerings as string[]) ?? [];
        const businessName = org.brandDna?.businessName ?? org.name;
        const industry = org.brandDna?.industry ?? org.industry ?? '';

        const run = await prisma.autopilotRun.create({
          data: {
            organizationId: org.id,
            runType: 'daily',
            status: 'running',
            campaignId: campaign.id,
            inputSummary: {
              slotsPlanned: plan.slots.length,
              platforms: config.enabledPlatforms,
            },
          },
        });

        const postIds: string[] = [];
        let postsScheduled = 0;
        let postsDrafted = 0;
        let postsRejected = 0;
        let totalScore = 0;

        for (const slot of plan.slots) {
          try {
            const result = await generateSlotContent({
              generator,
              slot,
              businessName,
              industry,
              tone,
              offerings,
              campaignId: campaign.id,
              orgId: org.id,
              userId,
              runId: run.id,
              autoApproveThreshold: config.autoApproveThreshold,
              minScoreThreshold: config.minScoreThreshold,
            });

            if (result) {
              postIds.push(result.postId);
              totalScore += result.score;
              if (result.status === 'scheduled') postsScheduled++;
              else if (result.status === 'draft') postsDrafted++;
              else postsRejected++;
            } else {
              postsRejected++;
            }
          } catch {
            postsRejected++;
          }
        }

        const avgScore =
          postIds.length > 0 ? Math.round(totalScore / postIds.length) : 0;
        totalGenerated += postIds.length;

        // Finalise run
        await prisma.autopilotRun.update({
          where: { id: run.id },
          data: {
            status: postIds.length > 0 ? 'completed' : 'failed',
            postsGenerated: postIds.length,
            postsScheduled,
            postsDrafted,
            postsRejected,
            avgScore,
            postIds,
            completedAt: new Date(),
            durationMs: Date.now() - startTime,
          },
        });

        // Schedule next run
        await prisma.autopilotConfig.update({
          where: { id: config.id },
          data: {
            status: 'idle',
            lastRunAt: now,
            nextRunAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
            lastErrorMessage: null,
          },
        });

        totalOrgsProcessed++;
      } catch (err) {
        logger.error('cron:autopilot:org-error', {
          orgId: config.organizationId,
          error: err instanceof Error ? err.message : String(err),
        });

        await prisma.autopilotConfig.update({
          where: { id: config.id },
          data: {
            status: 'error',
            lastErrorMessage: err instanceof Error ? err.message : String(err),
            nextRunAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          },
        });
      }
    }

    const duration = Date.now() - startTime;
    logger.info('cron:autopilot:end', {
      orgsProcessed: totalOrgsProcessed,
      totalGenerated,
      durationMs: duration,
    });

    return NextResponse.json({
      success: true,
      orgsProcessed: totalOrgsProcessed,
      totalGenerated,
      durationMs: duration,
    });
  } catch (error) {
    logger.error('cron:autopilot:fatal', { error });
    return NextResponse.json(
      { error: 'Autopilot cron failed' },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER — Generate a single slot's content
// ============================================================================

interface SlotInput {
  generator: AIContentGenerator;
  slot: { platform: string; date: Date; theme: ContentTheme };
  businessName: string;
  industry: string;
  tone: string;
  offerings: string[];
  campaignId: string;
  orgId: string;
  userId: string;
  runId: string;
  autoApproveThreshold: number;
  minScoreThreshold: number;
}

async function generateSlotContent(input: SlotInput): Promise<{
  postId: string;
  score: number;
  status: 'scheduled' | 'draft' | 'rejected';
} | null> {
  const spec = PLATFORM_SPECS[input.slot.platform];
  if (!spec) return null;

  let bestContent = '';
  let bestScore = 0;
  let bestDecision: 'schedule' | 'draft' | 'reject' = 'reject';
  let bestDimensions: Record<string, number> = {};

  for (let attempt = 1; attempt <= MAX_REGENERATION_ATTEMPTS; attempt++) {
    try {
      const request: ContentRequest = {
        type: 'post',
        platform: input.slot.platform as ContentRequest['platform'],
        topic: THEME_PROMPTS[input.slot.theme],
        tone: input.tone as ContentRequest['tone'],
        targetAudience: `customers of ${input.businessName}`,
        keywords: input.offerings.slice(0, 5),
        includeEmojis: input.slot.platform !== 'linkedin',
        includeHashtags: spec.hashtagCount > 0,
        includeCTA: true,
        orgId: input.orgId,
      };

      const generated = await input.generator.generateContent(request);
      const gate = evaluateContent(
        generated.content,
        input.slot.platform,
        input.autoApproveThreshold,
        input.minScoreThreshold
      );

      if (gate.score > bestScore) {
        bestContent = generated.content;
        bestScore = gate.score;
        bestDecision = gate.decision;
        bestDimensions = scoreDimensions(
          generated.content,
          input.slot.platform
        );
      }

      if (gate.decision === 'schedule') break;
    } catch {
      // Continue to next attempt
    }
  }

  if (!bestContent || bestDecision === 'reject') {
    return null;
  }

  // Optimal time
  let scheduledAt = input.slot.date;
  if (VALID_PLATFORMS.includes(input.slot.platform as Platform)) {
    try {
      const { postingTimePredictor } =
        await import('@/lib/ml/posting-time-predictor');
      const timeResult = await postingTimePredictor.getOptimalTimes(
        input.userId,
        input.slot.platform as Platform,
        'Australia/Sydney'
      );
      const optHour = timeResult.topSlot.hour;
      scheduledAt = new Date(input.slot.date);
      scheduledAt.setHours(optHour, 0, 0, 0);
    } catch {
      // Keep default
    }
  }

  const postStatus = bestDecision === 'schedule' ? 'scheduled' : 'draft';

  const post = await prisma.post.create({
    data: {
      content: bestContent,
      platform: input.slot.platform,
      campaignId: input.campaignId,
      status: postStatus,
      scheduledAt: postStatus === 'scheduled' ? scheduledAt : null,
      metadata: {
        source: 'autopilot' as const,
        runId: input.runId,
        theme: input.slot.theme,
        scoreOverall: bestScore,
        scoreDimensions: bestDimensions,
        qualityDecision: postStatus === 'scheduled' ? 'scheduled' : 'draft',
        generationAttempt: 1,
        generatedAt: new Date().toISOString(),
      },
    },
    select: { id: true },
  });

  return { postId: post.id, score: bestScore, status: postStatus };
}
