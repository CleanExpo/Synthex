/**
 * Production Pipeline — lib/video/production-pipeline.ts
 *
 * Main autonomous orchestrator for the video production state machine.
 *
 * Episode lifecycle:
 *   queued → scripting → capturing → rendering → quality_check → publishing
 *   → published | held
 *
 * Each stage is independently error-handled. A failure in any stage writes
 * the error to VideoEpisode.errorMessage and moves the episode to 'held'
 * (never 'failed') — so every episode can be manually reviewed and retried.
 *
 * @task SYN-580
 */

import * as path from 'path';
import * as fs from 'fs';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { VideoOrchestrator } from './video-orchestrator';
import {
  generateScript,
  type TopicInput,
  type SeriesContext,
} from './script-generator';
import { runQualityGate, extractVoiceoverFromScript } from './quality-gate';
import { YouTubeUploader, type VideoMetadata } from './youtube-uploader';
import type { GeneratedScript } from './script-generator';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PipelineRunOptions {
  /** Only produce for this series (defaults to both) */
  seriesSlug?: string;
  /** Skip YouTube upload (for testing) */
  skipUpload?: boolean;
  /** Login credentials for dashboard capture */
  login?: { email: string; password: string };
}

export interface PipelineRunResult {
  seriesSlug: string;
  episodeId: string;
  episodeNumber: number;
  status: string;
  youtubeUrl?: string;
  error?: string;
}

// ── Slug generator ─────────────────────────────────────────────────────────

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 80);
}

// ── Stage helpers ─────────────────────────────────────────────────────────────

async function setStatus(
  episodeId: string,
  status: string,
  extra?: Record<string, unknown>
): Promise<void> {
  await prisma.videoEpisode.update({
    where: { id: episodeId },
    data: { status, ...(extra ?? {}) },
  });
}

// ── Stage 1: Script generation ────────────────────────────────────────────────

async function runScriptStage(
  episodeId: string,
  topic: {
    title: string;
    description: string;
    sourceType: string;
    sourceRef: string | null;
  },
  seriesContext: SeriesContext
): Promise<GeneratedScript> {
  await setStatus(episodeId, 'scripting');

  const topicInput: TopicInput = {
    title: topic.title,
    description: topic.description,
    sourceType: topic.sourceType,
    sourceRef: topic.sourceRef ?? '',
  };

  const script = await generateScript(topicInput, seriesContext);

  await setStatus(episodeId, 'scripting', {
    scriptContent: script as unknown as Record<string, unknown>,
    title: script.title,
    scriptedAt: new Date(),
  });

  logger.info('ProductionPipeline: script stage complete', {
    episodeId,
    title: script.title,
  });

  return script;
}

// ── Stage 2: Capture ──────────────────────────────────────────────────────────

async function runCaptureStage(
  episodeId: string,
  script: GeneratedScript,
  options: PipelineRunOptions
): Promise<{
  rawVideoPath: string;
  processedVideoPath: string;
  thumbnailPath?: string;
}> {
  await setStatus(episodeId, 'capturing');

  const orchestrator = new VideoOrchestrator();

  // Find the demo scene workflow key from the script, if any
  const demoScene = script.scenes.find(
    s => s.type === 'demo' && s.captureWorkflow
  );
  const workflowName = demoScene?.captureWorkflow ?? 'platformOverview';

  const captureOptions = {
    login: options.login ?? {
      email: process.env.DEMO_USER_EMAIL ?? '',
      password: process.env.DEMO_USER_PASSWORD ?? '',
    },
    skipUpload: true, // Upload is handled separately below
  };

  const result = await orchestrator.produceVideo(workflowName, captureOptions);

  if (!result.success || !result.processedVideoPath) {
    throw new Error(`Capture failed: ${result.error ?? 'unknown error'}`);
  }

  await setStatus(episodeId, 'capturing', {
    rawVideoPath: result.rawVideoPath,
    processedVideoPath: result.processedVideoPath,
    thumbnailPath: result.thumbnailPath ?? null,
    capturedAt: new Date(),
    captureAssets: {
      workflowName,
      rawPath: result.rawVideoPath,
      processedPath: result.processedVideoPath,
    },
  });

  logger.info('ProductionPipeline: capture stage complete', {
    episodeId,
    processedVideoPath: result.processedVideoPath,
  });

  return {
    rawVideoPath: result.rawVideoPath,
    processedVideoPath: result.processedVideoPath,
    thumbnailPath: result.thumbnailPath,
  };
}

// ── Stage 3: Quality gate ─────────────────────────────────────────────────────

async function runQualityStage(
  episodeId: string,
  episodeNumber: number,
  script: GeneratedScript,
  processedVideoPath: string,
  orgId?: string
): Promise<{ pass: boolean; reason: string }> {
  await setStatus(episodeId, 'quality_check');

  const voiceover = extractVoiceoverFromScript(script);
  const description = script.description ?? '';

  const gateResult = await runQualityGate({
    voiceover,
    description,
    processedVideoPath,
    episodeNumber,
    orgId,
  });

  await setStatus(episodeId, 'quality_check', {
    humannessScore: gateResult.scores.humanness,
    geoTacticScore: gateResult.scores.geoTactic,
    slopScanPassed: gateResult.scores.slopMatches <= 5,
  });

  logger.info('ProductionPipeline: quality stage complete', {
    episodeId,
    pass: gateResult.pass,
    reason: gateResult.reason,
    humanness: gateResult.scores.humanness,
  });

  return { pass: gateResult.pass, reason: gateResult.reason };
}

// ── Stage 4: YouTube upload ───────────────────────────────────────────────────

async function runUploadStage(
  episodeId: string,
  episodeNumber: number,
  script: GeneratedScript,
  processedVideoPath: string,
  thumbnailPath: string | undefined,
  series: { youtubePlaylistId?: string | null }
): Promise<string | null> {
  await setStatus(episodeId, 'publishing');

  const uploader = new YouTubeUploader();
  if (!uploader.isConfigured()) {
    logger.warn(
      'ProductionPipeline: YouTube not configured — skipping upload',
      {
        episodeId,
      }
    );
    return null;
  }

  const metadata: VideoMetadata = {
    title: `Ep ${episodeNumber}: ${script.title}`,
    description: script.description,
    tags: script.tags,
    categoryId: '28', // Science & Technology
    privacyStatus: 'public',
    playlistId: series.youtubePlaylistId ?? undefined,
    thumbnailPath,
  };

  const uploadResult = await uploader.uploadVideo(processedVideoPath, metadata);

  await setStatus(episodeId, 'publishing', {
    youtubeVideoId: uploadResult.videoId,
    youtubeUrl: uploadResult.videoUrl,
    publishedAt: new Date(),
  });

  logger.info('ProductionPipeline: upload stage complete', {
    episodeId,
    youtubeVideoId: uploadResult.videoId,
    url: uploadResult.videoUrl,
  });

  return uploadResult.videoUrl;
}

// ── Main pipeline function ────────────────────────────────────────────────────

/**
 * Run one production cycle for a single series:
 *  1. Pull next pending topic from queue
 *  2. Create VideoEpisode
 *  3. Script → Capture → Quality → Upload
 *  4. Return result
 */
export async function runProductionPipeline(
  seriesSlug: string,
  options: PipelineRunOptions = {}
): Promise<PipelineRunResult | null> {
  // ── Load series ──────────────────────────────────────────────────────────
  const series = await prisma.videoSeries.findUnique({
    where: { slug: seriesSlug },
  });

  if (!series || series.status !== 'active') {
    logger.warn('ProductionPipeline: series not found or inactive', {
      seriesSlug,
    });
    return null;
  }

  // ── Pull next topic ──────────────────────────────────────────────────────
  const topic = await prisma.videoTopicQueue.findFirst({
    where: { seriesId: series.id, status: 'pending' },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  });

  if (!topic) {
    logger.info('ProductionPipeline: topic queue empty', { seriesSlug });
    return null;
  }

  // ── Create episode ───────────────────────────────────────────────────────
  const episodeNumber = series.nextEpisodeNum;
  const titleSlug = `${seriesSlug}-ep-${episodeNumber}-${toSlug(topic.title)}`;

  const episode = await prisma.videoEpisode.create({
    data: {
      seriesId: series.id,
      episodeNumber,
      title: topic.title,
      slug: titleSlug,
      sourceType: topic.sourceType,
      sourceRef: topic.sourceRef ?? null,
      status: 'queued',
    },
  });

  // Mark topic as assigned
  await prisma.videoTopicQueue.update({
    where: { id: topic.id },
    data: { status: 'assigned', episodeId: episode.id },
  });

  // Increment series episode counter
  await prisma.videoSeries.update({
    where: { id: series.id },
    data: { nextEpisodeNum: { increment: 1 } },
  });

  const seriesType = series.seriesType as 'bts' | 'client';
  const seriesContext: SeriesContext = {
    seriesType,
    episodeNumber,
    targetDurationSeconds: (
      series.productionConfig as Record<string, unknown> | null
    )?.targetDurationSeconds as number | undefined,
  };

  const result: PipelineRunResult = {
    seriesSlug,
    episodeId: episode.id,
    episodeNumber,
    status: 'queued',
  };

  try {
    // ── Stage 1: Script ────────────────────────────────────────────────────
    const script = await runScriptStage(episode.id, topic, seriesContext);
    result.status = 'scripting';

    // ── Stage 2: Capture ───────────────────────────────────────────────────
    let processedVideoPath: string | undefined;
    let thumbnailPath: string | undefined;

    try {
      const captureResult = await runCaptureStage(episode.id, script, options);
      processedVideoPath = captureResult.processedVideoPath;
      thumbnailPath = captureResult.thumbnailPath ?? undefined;
      result.status = 'capturing';
    } catch (captureError) {
      // Capture failures are non-fatal if we have a script — move to held
      logger.warn('ProductionPipeline: capture stage failed', {
        episodeId: episode.id,
        error: String(captureError),
      });
      await setStatus(episode.id, 'held', {
        errorMessage: `Capture failed: ${String(captureError)}`,
      });
      result.status = 'held';
      result.error = String(captureError);
      return result;
    }

    // ── Stage 3: Quality gate ──────────────────────────────────────────────
    const { pass, reason } = await runQualityStage(
      episode.id,
      episodeNumber,
      script,
      processedVideoPath,
      series.organisationId ?? undefined
    );

    if (!pass) {
      await setStatus(episode.id, 'held');
      result.status = 'held';
      result.error = `Quality gate: ${reason}`;
      logger.info('ProductionPipeline: episode held after quality gate', {
        episodeId: episode.id,
        reason,
      });
      return result;
    }

    // ── Stage 4: Upload ────────────────────────────────────────────────────
    if (!options.skipUpload) {
      const youtubeUrl = await runUploadStage(
        episode.id,
        episodeNumber,
        script,
        processedVideoPath,
        thumbnailPath,
        { youtubePlaylistId: series.youtubePlaylistId }
      );

      if (youtubeUrl) {
        result.youtubeUrl = youtubeUrl;
        await setStatus(episode.id, 'published');
        result.status = 'published';
      } else {
        // Upload skipped (not configured) — mark as held for manual upload
        await setStatus(episode.id, 'held', {
          errorMessage: 'YouTube not configured — manual upload required',
        });
        result.status = 'held';
      }
    } else {
      await setStatus(episode.id, 'held', {
        errorMessage: 'Upload skipped — skipUpload=true',
      });
      result.status = 'held';
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('ProductionPipeline: unhandled error', {
      episodeId: episode.id,
      error: msg,
    });
    await setStatus(episode.id, 'held', { errorMessage: msg });
    result.status = 'held';
    result.error = msg;
  }

  logger.info('ProductionPipeline: run complete', {
    seriesSlug: result.seriesSlug,
    episodeId: result.episodeId,
    episodeNumber: result.episodeNumber,
    status: result.status,
    youtubeUrl: result.youtubeUrl ?? null,
    error: result.error ?? null,
  });
  return result;
}

/**
 * Run production for all active series.
 * Called by the cron job.
 */
export async function runAllSeriesPipelines(
  options: PipelineRunOptions = {}
): Promise<PipelineRunResult[]> {
  const series = await prisma.videoSeries.findMany({
    where: {
      status: 'active',
      ...(options.seriesSlug ? { slug: options.seriesSlug } : {}),
    },
  });

  const results: PipelineRunResult[] = [];

  for (const s of series) {
    try {
      const result = await runProductionPipeline(s.slug, options);
      if (result) results.push(result);
    } catch (err) {
      logger.error('ProductionPipeline: series pipeline failed', {
        seriesSlug: s.slug,
        error: String(err),
      });
    }
  }

  return results;
}
