/**
 * Autopilot Launch Pipeline
 *
 * @description Post-onboarding first-week content generation pipeline.
 * Replaces the original content-kickstart with a full autopilot-aware flow:
 *   1. Reads BrandDNA + connected platforms + posting mode
 *   2. Creates/enables AutopilotConfig
 *   3. Creates "Autopilot Content" Campaign
 *   4. For each platform × each day: generate → score → gate → schedule/draft
 *   5. Records AutopilotRun for observability
 *   6. Sets up daily autopilot loop if postingMode === 'auto'
 *
 * @module lib/autopilot/launch-pipeline
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { AIContentGenerator } from '@/lib/ai/content-generator';
import type { ContentRequest } from '@/lib/ai/content-generator';
import type { Platform } from '@/lib/ml/posting-time-predictor';
import { evaluateContent, scoreDimensions } from './quality-gate';
import { allocateSlots } from './content-strategy';
import type {
  LaunchPipelineInput,
  LaunchPipelineResult,
  ContentMix,
  ContentTheme,
} from './types';
import { PLATFORM_SPECS, THEME_PROMPTS, DEFAULT_CONTENT_MIX } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_REGENERATION_ATTEMPTS = 3;
const PLANNING_HORIZON_DAYS = 7;
const POSTS_PER_DAY_PER_PLATFORM = 1;

const VALID_PLATFORMS_FOR_PREDICTOR: Platform[] = [
  'twitter',
  'instagram',
  'linkedin',
  'facebook',
  'tiktok',
  'youtube',
];

// ============================================================================
// MAIN PIPELINE
// ============================================================================

export async function runLaunchPipeline(
  input: LaunchPipelineInput
): Promise<LaunchPipelineResult> {
  const startTime = Date.now();
  const generator = new AIContentGenerator();

  logger.info('[autopilot:launch] Starting launch pipeline', {
    userId: input.userId,
    orgId: input.organizationId,
  });

  // ── 1. Read org context ──────────────────────────────────────────────
  const org = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: {
      id: true,
      name: true,
      industry: true,
      brandDna: {
        select: {
          businessName: true,
          vertical: true,
          industry: true,
          brandVoice: true,
          persona: true,
          offerings: true,
        },
      },
    },
  });

  if (!org) {
    throw new Error(`Organisation ${input.organizationId} not found`);
  }

  // Read connected platforms
  const connections = await prisma.platformConnection.findMany({
    where: {
      organizationId: input.organizationId,
      isActive: true,
      deletedAt: null,
    },
    select: { platform: true },
    distinct: ['platform'],
  });

  const connectedPlatforms = connections
    .map(c => c.platform)
    .filter(p => p in PLATFORM_SPECS);

  if (connectedPlatforms.length === 0) {
    logger.info('[autopilot:launch] No connected platforms — skipping', {
      orgId: input.organizationId,
    });
    return {
      success: true,
      runId: '',
      postsGenerated: 0,
      postsScheduled: 0,
      postsDrafted: 0,
      postsRejected: 0,
      avgScore: 0,
      campaignId: '',
      postIds: [],
    };
  }

  // Read posting mode from onboarding progress
  const progress = await prisma.onboardingProgress.findFirst({
    where: { userId: input.userId, organizationId: input.organizationId },
    select: { postingMode: true },
  });
  const postingMode =
    (progress?.postingMode as 'manual' | 'assisted' | 'auto') ?? 'assisted';

  // Extract brand context
  const brandDna = org.brandDna;
  const businessName = brandDna?.businessName ?? org.name;
  const industry = brandDna?.industry ?? org.industry ?? '';
  const brandVoice = brandDna?.brandVoice as Record<string, unknown> | null;
  const tone = (brandVoice?.tone as string) ?? 'professional';
  const offerings = (brandDna?.offerings as string[]) ?? [];

  // ── 2. Create/enable AutopilotConfig ─────────────────────────────────
  const isAutoMode = postingMode === 'auto';
  const nextRunAt = isAutoMode
    ? new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
    : null;

  const config = await prisma.autopilotConfig.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId,
      enabled: isAutoMode,
      status: 'generating',
      enabledPlatforms: connectedPlatforms,
      nextRunAt,
    },
    update: {
      enabled: isAutoMode,
      status: 'generating',
      enabledPlatforms: connectedPlatforms,
      nextRunAt,
    },
  });

  // ── 3. Create Campaign ───────────────────────────────────────────────
  const campaign = await prisma.campaign.create({
    data: {
      name: `Autopilot Content — ${businessName}`,
      description: `AI-generated autopilot content for ${businessName}`,
      platform: connectedPlatforms[0] ?? 'instagram',
      status: 'active',
      userId: input.userId,
      organizationId: input.organizationId,
      settings: {
        source: 'autopilot',
        runType: 'kickstart',
        generatedAt: new Date().toISOString(),
      },
    },
  });

  // ── 4. Plan content slots ────────────────────────────────────────────
  const contentMix = (config.contentMix as ContentMix) ?? DEFAULT_CONTENT_MIX;
  const slots = allocateSlots(
    connectedPlatforms,
    PLANNING_HORIZON_DAYS,
    POSTS_PER_DAY_PER_PLATFORM,
    contentMix
  );

  // ── 5. Generate, score, gate, create posts ───────────────────────────
  const postIds: string[] = [];
  let postsScheduled = 0;
  let postsDrafted = 0;
  let postsRejected = 0;
  let totalScore = 0;
  let scoreCount = 0;

  // Create a run record upfront
  const run = await prisma.autopilotRun.create({
    data: {
      organizationId: input.organizationId,
      runType: 'kickstart',
      status: 'running',
      campaignId: campaign.id,
      inputSummary: {
        platforms: connectedPlatforms,
        postingMode,
        slotsPlanned: slots.length,
      },
    },
  });

  // Process slots sequentially to avoid overwhelming the AI provider
  for (const slot of slots) {
    try {
      const result = await generateAndGatePost({
        generator,
        slot,
        businessName,
        industry,
        tone,
        offerings,
        campaignId: campaign.id,
        orgId: input.organizationId,
        userId: input.userId,
        runId: run.id,
        autoApproveThreshold: config.autoApproveThreshold,
        minScoreThreshold: config.minScoreThreshold,
        postingMode,
      });

      if (result) {
        postIds.push(result.postId);
        totalScore += result.score;
        scoreCount++;

        if (result.status === 'scheduled') postsScheduled++;
        else if (result.status === 'draft') postsDrafted++;
        else postsRejected++;
      }
    } catch (err) {
      logger.warn('[autopilot:launch] Slot generation failed', {
        platform: slot.platform,
        theme: slot.theme,
        error: err instanceof Error ? err.message : String(err),
      });
      postsRejected++;
    }
  }

  // ── 6. Finalise run record ───────────────────────────────────────────
  const durationMs = Date.now() - startTime;
  const avgScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;

  await prisma.autopilotRun.update({
    where: { id: run.id },
    data: {
      status: postsRejected === slots.length ? 'failed' : 'completed',
      postsGenerated: postIds.length,
      postsScheduled,
      postsDrafted,
      postsRejected,
      avgScore,
      postIds,
      completedAt: new Date(),
      durationMs,
    },
  });

  // Update config status
  await prisma.autopilotConfig.update({
    where: { organizationId: input.organizationId },
    data: {
      status: isAutoMode ? 'idle' : 'paused',
      lastRunAt: new Date(),
    },
  });

  logger.info('[autopilot:launch] Launch pipeline complete', {
    orgId: input.organizationId,
    postsGenerated: postIds.length,
    postsScheduled,
    postsDrafted,
    postsRejected,
    avgScore,
    durationMs,
  });

  return {
    success: true,
    runId: run.id,
    postsGenerated: postIds.length,
    postsScheduled,
    postsDrafted,
    postsRejected,
    avgScore,
    campaignId: campaign.id,
    postIds,
  };
}

// ============================================================================
// SINGLE POST GENERATION + GATING
// ============================================================================

interface GeneratePostInput {
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
  postingMode: 'manual' | 'assisted' | 'auto';
}

interface GeneratePostResult {
  postId: string;
  score: number;
  status: 'scheduled' | 'draft' | 'rejected';
}

async function generateAndGatePost(
  input: GeneratePostInput
): Promise<GeneratePostResult | null> {
  const { generator, slot, postingMode } = input;
  const spec = PLATFORM_SPECS[slot.platform];
  if (!spec) return null;

  let bestContent = '';
  let bestScore = 0;
  let bestDecision: 'schedule' | 'draft' | 'reject' = 'reject';
  let bestDimensions: Record<string, number> = {};

  // Try up to MAX_REGENERATION_ATTEMPTS
  for (let attempt = 1; attempt <= MAX_REGENERATION_ATTEMPTS; attempt++) {
    const request: ContentRequest = {
      type: 'post',
      platform: slot.platform as ContentRequest['platform'],
      topic: THEME_PROMPTS[slot.theme],
      tone: input.tone as ContentRequest['tone'],
      targetAudience: `customers of ${input.businessName} in ${input.industry || 'professional services'}`,
      keywords: input.offerings.slice(0, 5),
      includeEmojis: slot.platform !== 'linkedin',
      includeHashtags: spec.hashtagCount > 0,
      includeCTA: true,
      orgId: input.orgId,
    };

    try {
      const generated = await generator.generateContent(request);
      const gateResult = evaluateContent(
        generated.content,
        slot.platform,
        input.autoApproveThreshold,
        input.minScoreThreshold
      );

      if (gateResult.score > bestScore) {
        bestContent = generated.content;
        bestScore = gateResult.score;
        bestDecision = gateResult.decision;
        bestDimensions = scoreDimensions(generated.content, slot.platform);
      }

      // If we hit auto-approve, stop trying
      if (gateResult.decision === 'schedule') break;

      // If we're at draft level and it's the last attempt, keep it
      if (
        gateResult.decision === 'draft' &&
        attempt === MAX_REGENERATION_ATTEMPTS
      )
        break;
    } catch (err) {
      logger.warn('[autopilot:launch] Generation attempt failed', {
        platform: slot.platform,
        attempt,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // If no usable content was generated, skip
  if (!bestContent || bestDecision === 'reject') {
    return { postId: '', score: bestScore, status: 'rejected' };
  }

  // Determine optimal posting time
  let scheduledAt = slot.date;
  if (VALID_PLATFORMS_FOR_PREDICTOR.includes(slot.platform as Platform)) {
    try {
      const { postingTimePredictor } =
        await import('@/lib/ml/posting-time-predictor');
      const timeResult = await postingTimePredictor.getOptimalTimes(
        input.userId,
        slot.platform as Platform,
        'Australia/Sydney'
      );
      if (timeResult.nextOptimalTime) {
        // Use the optimal hour but keep the planned date
        const optHour = timeResult.topSlot.hour;
        scheduledAt = new Date(slot.date);
        scheduledAt.setHours(optHour, 0, 0, 0);
      }
    } catch {
      // Fallback to default 9am — non-fatal
    }
  }

  // Determine post status based on quality gate + posting mode
  let postStatus: string;
  if (postingMode === 'manual') {
    postStatus = 'draft';
  } else if (bestDecision === 'schedule' && postingMode === 'auto') {
    postStatus = 'scheduled';
  } else {
    postStatus = 'draft';
  }

  // Create the post
  const post = await prisma.post.create({
    data: {
      content: bestContent,
      platform: slot.platform,
      campaignId: input.campaignId,
      status: postStatus,
      scheduledAt: postStatus === 'scheduled' ? scheduledAt : null,
      metadata: {
        source: 'autopilot' as const,
        runId: input.runId,
        theme: slot.theme,
        scoreOverall: bestScore,
        scoreDimensions: bestDimensions,
        qualityDecision: postStatus === 'scheduled' ? 'scheduled' : 'draft',
        generationAttempt: 1,
        generatedAt: new Date().toISOString(),
      },
    },
    select: { id: true },
  });

  return {
    postId: post.id,
    score: bestScore,
    status: postStatus === 'scheduled' ? 'scheduled' : 'draft',
  };
}
