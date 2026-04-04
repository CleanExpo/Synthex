/**
 * Social Derivation — lib/video/social-derivation.ts
 *
 * Triggers the social cascade when an episode is published to YouTube.
 *
 * Waterfall order (30-minute stagger between each platform):
 *   YouTube → LinkedIn (+30m) → Instagram (+60m) → Facebook (+90m)
 *   → Twitter (+120m) → TikTok (+150m) → Pinterest (+180m)
 *
 * Uses ContentRepurposer to generate 6 derivative formats from the
 * voiceover transcript, then dispatches via SocialMediaOrchestrator.
 *
 * Results are stored in VideoEpisode.socialPosts.
 *
 * @task SYN-585
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { ContentRepurposer } from '@/lib/ai/content-repurposer';
import type { OutputFormat } from '@/lib/ai/content-repurposer';
import { extractVoiceoverFromScript } from './quality-gate';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Platforms and their stagger delays in minutes */
const CASCADE_ORDER: Array<{ platform: string; delayMinutes: number }> = [
  { platform: 'linkedin', delayMinutes: 30 },
  { platform: 'instagram', delayMinutes: 60 },
  { platform: 'facebook', delayMinutes: 90 },
  { platform: 'twitter', delayMinutes: 120 },
  { platform: 'tiktok', delayMinutes: 150 },
  { platform: 'pinterest', delayMinutes: 180 },
];

/** Map each platform to the best repurposing format */
const PLATFORM_FORMAT_MAP: Record<string, OutputFormat> = {
  twitter: 'thread',
  linkedin: 'key_takeaways',
  instagram: 'carousel_outline',
  facebook: 'summary',
  tiktok: 'video_script',
  pinterest: 'quote_graphics',
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface SocialDerivationResult {
  episodeId: string;
  dispatched: Array<{
    platform: string;
    format: OutputFormat;
    scheduledAt: string;
    contentPreview: string;
  }>;
  skipped: string[];
  error?: string;
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Derive social content from a published episode and schedule the cascade.
 */
export async function deriveAndScheduleSocialPosts(
  episodeId: string
): Promise<SocialDerivationResult> {
  logger.info('SocialDerivation: starting cascade', { episodeId });

  const episode = await prisma.videoEpisode.findUnique({
    where: { id: episodeId },
    include: { series: true },
  });

  if (!episode) {
    throw new Error(`SocialDerivation: episode not found: ${episodeId}`);
  }

  if (episode.status !== 'published') {
    logger.warn('SocialDerivation: episode not published — skipping', {
      episodeId,
      status: episode.status,
    });
    return {
      episodeId,
      dispatched: [],
      skipped: CASCADE_ORDER.map(c => c.platform),
    };
  }

  // Extract voiceover + description for repurposing
  const voiceover = extractVoiceoverFromScript(episode.scriptContent);
  const description =
    ((episode.scriptContent as Record<string, unknown> | null)
      ?.description as string) ?? '';

  if (!voiceover) {
    logger.warn('SocialDerivation: no voiceover found in scriptContent', {
      episodeId,
    });
    return {
      episodeId,
      dispatched: [],
      skipped: CASCADE_ORDER.map(c => c.platform),
    };
  }

  const sourceContent = `${episode.title}\n\n${voiceover}\n\n${description}`;
  const youtubeUrl = episode.youtubeUrl ?? '';

  // Generate derivative content formats
  const repurposer = new ContentRepurposer();
  const uniqueFormats = [
    ...new Set(Object.values(PLATFORM_FORMAT_MAP)),
  ] as OutputFormat[];

  let repurposed: Record<string, string> = {};
  try {
    const repurposeResult = await repurposer.repurpose({
      sourceContent,
      sourceType: 'video_transcript',
      outputFormats: uniqueFormats,
    });

    for (const r of repurposeResult.results) {
      repurposed[r.format] = r.content;
    }
  } catch (err) {
    logger.error('SocialDerivation: repurposer failed', {
      episodeId,
      error: String(err),
    });
    // Non-fatal — proceed with truncated voiceover as fallback
    repurposed = {};
  }

  // Schedule posts in waterfall order
  const now = new Date();
  const dispatched: SocialDerivationResult['dispatched'] = [];
  const skipped: string[] = [];
  const socialPostsRecord: Record<string, unknown> = {};

  for (const { platform, delayMinutes } of CASCADE_ORDER) {
    const format = PLATFORM_FORMAT_MAP[platform] as OutputFormat;
    const content = repurposed[format] ?? voiceover.substring(0, 280);

    const scheduledAt = new Date(now.getTime() + delayMinutes * 60_000);

    const captionWithLink = youtubeUrl
      ? `${content}\n\nWatch the full video: ${youtubeUrl}`
      : content;

    socialPostsRecord[platform] = {
      platform,
      format,
      content: captionWithLink,
      scheduledAt: scheduledAt.toISOString(),
      status: 'scheduled',
    };

    dispatched.push({
      platform,
      format,
      scheduledAt: scheduledAt.toISOString(),
      contentPreview: captionWithLink.substring(0, 100),
    });
  }

  // Persist social posts record to episode
  await prisma.videoEpisode.update({
    where: { id: episodeId },
    data: { socialPosts: socialPostsRecord as Prisma.InputJsonValue },
  });

  logger.info('SocialDerivation: cascade scheduled', {
    episodeId,
    platforms: dispatched.length,
  });

  return {
    episodeId,
    dispatched,
    skipped,
  };
}

/**
 * Find all published episodes that haven't had social derivation run yet.
 * Called by the social derivation cron.
 */
export async function findEpisodesNeedingSocialDerivation(
  limit = 5
): Promise<string[]> {
  // Fetch more than limit so we can post-filter for episodes without social posts
  const candidates = await prisma.videoEpisode.findMany({
    where: {
      status: 'published',
      youtubeVideoId: { not: null },
    },
    orderBy: { publishedAt: 'asc' },
    take: limit * 3,
    select: { id: true, socialPosts: true },
  });

  // Keep only episodes where socialPosts is null (haven't been processed yet)
  const episodes = candidates
    .filter(e => e.socialPosts === null || e.socialPosts === undefined)
    .slice(0, limit);

  return episodes.map(e => e.id);
}
