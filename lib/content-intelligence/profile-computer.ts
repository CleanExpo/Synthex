/**
 * Profile computer — lib/content-intelligence/profile-computer.ts
 *
 * Orchestrates the per-org content intelligence computation:
 *   1. Fetches published posts + latest metrics for the org (last 180 days)
 *   2. Classifies posts via Claude Haiku (topic-extractor)
 *   3. Aggregates into ContentProfile fields
 *   4. Upserts ContentPerformanceProfile + updates IndustryBaseline
 *
 * Called by the compute-content-profiles cron route (SYN-631).
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { classifyPosts } from './topic-extractor';
import type {
  ContentFormat,
  ContentFormatScores,
  ContentProfile,
  OptimalTimes,
  PostClassification,
  PostForClassification,
  TopicScore,
} from './types';
import { computeConfidenceLevel } from './blend';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Analysis window — 6 months of published posts */
const ANALYSIS_WINDOW_DAYS = 180;
/** Cap posts analysed per org to control AI costs */
const MAX_POSTS_PER_ORG = 200;
/** Minimum engagement rate to include a post in analysis (filters noise) */
const MIN_ENGAGEMENT_RATE = 0.005; // 0.5%

// ── Helpers ───────────────────────────────────────────────────────────────────

function inferFormat(mediaUrls: string[]): ContentFormat {
  if (mediaUrls.length === 0) return 'text';
  if (mediaUrls.length > 1) return 'carousel';
  // Single media — assume image (video detection would require metadata inspection)
  return 'image';
}

function windowStart(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ANALYSIS_WINDOW_DAYS);
  return d;
}

// ── Aggregators ───────────────────────────────────────────────────────────────

function aggregateTopics(classifications: PostClassification[]): TopicScore[] {
  const map = new Map<string, { totalEngagement: number; count: number }>();

  for (const c of classifications) {
    for (const topic of c.topics) {
      const existing = map.get(topic) ?? { totalEngagement: 0, count: 0 };
      map.set(topic, {
        totalEngagement: existing.totalEngagement + c.engagementRate,
        count: existing.count + 1,
      });
    }
  }

  return Array.from(map.entries())
    .map(([topic, { totalEngagement, count }]) => ({
      topic,
      avgEngagementRate: count > 0 ? totalEngagement / count : 0,
      postCount: count,
    }))
    .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)
    .slice(0, 15); // keep top 15 topics
}

function aggregateOptimalTimes(classifications: PostClassification[]): OptimalTimes {
  // Build map: dayOfWeek → hourUtc → avg engagement
  const map = new Map<string, Map<number, { total: number; count: number }>>();

  for (const c of classifications) {
    const dayMap = map.get(c.dayOfWeek) ?? new Map();
    const hourData = dayMap.get(c.hourUtc) ?? { total: 0, count: 0 };
    dayMap.set(c.hourUtc, {
      total: hourData.total + c.engagementRate,
      count: hourData.count + 1,
    });
    map.set(c.dayOfWeek, dayMap);
  }

  const result: OptimalTimes = {};
  for (const [day, hourMap] of map.entries()) {
    // Sort hours by avg engagement, take top 2
    const sorted = Array.from(hourMap.entries())
      .map(([hour, { total, count }]) => ({
        hour,
        avg: count > 0 ? total / count : 0,
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 2)
      .map(({ hour }) => `${String(hour).padStart(2, '0')}:00`);
    result[day] = sorted;
  }
  return result;
}

function aggregateHashtags(classifications: PostClassification[]): string[] {
  const map = new Map<string, { totalEngagement: number; count: number }>();

  for (const c of classifications) {
    for (const tag of c.hashtags) {
      const norm = tag.replace(/^#/, '').toLowerCase();
      if (!norm) continue;
      const existing = map.get(norm) ?? { totalEngagement: 0, count: 0 };
      map.set(norm, {
        totalEngagement: existing.totalEngagement + c.engagementRate,
        count: existing.count + 1,
      });
    }
  }

  return Array.from(map.entries())
    .sort(([, a], [, b]) => b.totalEngagement / b.count - a.totalEngagement / a.count)
    .slice(0, 30)
    .map(([tag]) => tag);
}

function aggregateFormatScores(classifications: PostClassification[]): ContentFormatScores {
  const map = new Map<ContentFormat, { total: number; count: number }>();

  for (const c of classifications) {
    const existing = map.get(c.format) ?? { total: 0, count: 0 };
    map.set(c.format, {
      total: existing.total + c.engagementRate,
      count: existing.count + 1,
    });
  }

  const result: ContentFormatScores = {
    video: 0,
    image: 0,
    carousel: 0,
    text: 0,
  };
  for (const [fmt, { total, count }] of map.entries()) {
    result[fmt] = count > 0 ? total / count : 0;
  }
  return result;
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface ComputeProfileResult {
  organizationId: string;
  postCount: number;
  confidenceLevel: number;
  skipped: boolean;
  reason?: string;
  /** Top topics from this profile run — available when skipped = false */
  topTopics?: TopicScore[];
  /** Optimal posting times from this profile run — available when skipped = false */
  optimalTimes?: OptimalTimes;
}

/**
 * Compute and upsert the ContentPerformanceProfile for a single org.
 * Also updates the IndustryBaseline for the org's industry.
 */
export async function computeOrgProfile(
  organizationId: string
): Promise<ComputeProfileResult> {
  // 1. Look up org industry
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, industry: true },
  });

  if (!org) {
    return { organizationId, postCount: 0, confidenceLevel: 0, skipped: true, reason: 'org_not_found' };
  }

  const industry = org.industry ?? 'general';

  // 2. Fetch published posts in the analysis window
  const since = windowStart();

  const rawPosts = await prisma.platformPost.findMany({
    where: {
      connection: { organizationId },
      status: 'published',
      publishedAt: { gte: since },
      deletedAt: null,
    },
    include: {
      metrics: {
        orderBy: { recordedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { publishedAt: 'desc' },
    take: MAX_POSTS_PER_ORG,
  });

  // 3. Filter to posts with non-trivial engagement
  const postsForAnalysis: PostForClassification[] = rawPosts
    .filter((p) => {
      const engRate = p.metrics[0]?.engagementRate ?? 0;
      return p.publishedAt !== null && engRate >= MIN_ENGAGEMENT_RATE;
    })
    .map((p) => ({
      id: p.id,
      content: p.content,
      hashtags: p.hashtags,
      engagementRate: p.metrics[0]?.engagementRate ?? 0,
      format: inferFormat(p.mediaUrls),
      publishedAt: p.publishedAt!.toISOString(),
    }));

  const postCount = postsForAnalysis.length;

  // If no posts, write a minimal profile with zero confidence
  if (postCount === 0) {
    await upsertProfile(organizationId, industry, 0, {
      topTopics: [],
      optimalTimes: {},
      winningHashtags: [],
      contentFormatScores: { video: 0, image: 0, carousel: 0, text: 0 },
    });
    return { organizationId, postCount: 0, confidenceLevel: 0, skipped: false };
  }

  // 4. Classify posts via Claude Haiku
  const classifications = await classifyPosts(postsForAnalysis);

  // 5. Aggregate into profile fields
  const profile: ContentProfile = {
    topTopics: aggregateTopics(classifications),
    optimalTimes: aggregateOptimalTimes(classifications),
    winningHashtags: aggregateHashtags(classifications),
    contentFormatScores: aggregateFormatScores(classifications),
  };

  const confidenceLevel = computeConfidenceLevel(postCount);

  // 6. Upsert ContentPerformanceProfile
  await upsertProfile(organizationId, industry, postCount, profile, confidenceLevel);

  // 7. Update IndustryBaseline (additive merge — no org data isolation)
  await updateIndustryBaseline(industry, profile);

  logger.info('profile-computer: org profile computed', {
    organizationId,
    industry,
    postCount,
    confidenceLevel,
  });

  return {
    organizationId,
    postCount,
    confidenceLevel,
    skipped: false,
    topTopics: profile.topTopics,
    optimalTimes: profile.optimalTimes,
  };
}

// ── DB writes ─────────────────────────────────────────────────────────────────

async function upsertProfile(
  organizationId: string,
  industry: string,
  postCount: number,
  profile: ContentProfile,
  confidenceLevel = 0
): Promise<void> {
  // Resolve industry baseline id if it exists
  const baseline = await prisma.industryBaseline.findUnique({
    where: { industry },
    select: { id: true },
  });

  await prisma.contentPerformanceProfile.upsert({
    where: { organizationId },
    create: {
      organizationId,
      postCount,
      confidenceLevel,
      topTopics: profile.topTopics as unknown as object[],
      optimalTimes: profile.optimalTimes as unknown as object,
      winningHashtags: profile.winningHashtags,
      contentFormatScores: profile.contentFormatScores as unknown as object,
      industryBaselineId: baseline?.id ?? null,
    },
    update: {
      postCount,
      confidenceLevel,
      topTopics: profile.topTopics as unknown as object[],
      optimalTimes: profile.optimalTimes as unknown as object,
      winningHashtags: profile.winningHashtags,
      contentFormatScores: profile.contentFormatScores as unknown as object,
      industryBaselineId: baseline?.id ?? null,
    },
  });
}

async function updateIndustryBaseline(
  industry: string,
  profile: ContentProfile
): Promise<void> {
  // Read current baseline if it exists
  const existing = await prisma.industryBaseline.findUnique({
    where: { industry },
  });

  const currentTopics = (existing?.topTopics as TopicScore[] | null) ?? [];
  const currentTimes = (existing?.optimalTimes as OptimalTimes | null) ?? {};
  const currentHashtags = (existing?.winningHashtags as string[] | null) ?? [];
  const currentFormats = (existing?.contentFormatScores as ContentFormatScores | null) ?? {
    video: 0, image: 0, carousel: 0, text: 0,
  };
  const sampleSize = (existing?.sampleSize ?? 0) + 1;

  // Simple merge: blend at equal weight between existing baseline and new org
  const alpha = 1 / sampleSize; // weight of the new org contribution

  // Merge top topics
  const mergedTopics = mergeBaselineTopics(currentTopics, profile.topTopics, alpha);
  // Merge optimal times: union
  const mergedTimes: OptimalTimes = { ...currentTimes };
  for (const [day, times] of Object.entries(profile.optimalTimes)) {
    if (!mergedTimes[day] || (alpha > 0.3)) {
      mergedTimes[day] = times;
    }
  }
  // Merge hashtags: union, preserving order
  const hashtagSet = new Set([...currentHashtags, ...profile.winningHashtags]);
  const mergedHashtags = Array.from(hashtagSet).slice(0, 50);
  // Merge format scores: rolling average
  const mergedFormats: ContentFormatScores = {
    video:    currentFormats.video    * (1 - alpha) + profile.contentFormatScores.video    * alpha,
    image:    currentFormats.image    * (1 - alpha) + profile.contentFormatScores.image    * alpha,
    carousel: currentFormats.carousel * (1 - alpha) + profile.contentFormatScores.carousel * alpha,
    text:     currentFormats.text     * (1 - alpha) + profile.contentFormatScores.text     * alpha,
  };

  await prisma.industryBaseline.upsert({
    where: { industry },
    create: {
      industry,
      sampleSize: 1,
      topTopics: profile.topTopics as unknown as object[],
      optimalTimes: profile.optimalTimes as unknown as object,
      winningHashtags: profile.winningHashtags,
      contentFormatScores: profile.contentFormatScores as unknown as object,
    },
    update: {
      sampleSize,
      topTopics: mergedTopics as unknown as object[],
      optimalTimes: mergedTimes as unknown as object,
      winningHashtags: mergedHashtags,
      contentFormatScores: mergedFormats as unknown as object,
    },
  });
}

function mergeBaselineTopics(
  existing: TopicScore[],
  incoming: TopicScore[],
  alpha: number
): TopicScore[] {
  const map = new Map<string, TopicScore>();
  for (const t of existing) {
    map.set(t.topic, { ...t });
  }
  for (const t of incoming) {
    const ex = map.get(t.topic);
    if (ex) {
      map.set(t.topic, {
        topic: t.topic,
        avgEngagementRate: ex.avgEngagementRate * (1 - alpha) + t.avgEngagementRate * alpha,
        postCount: ex.postCount + t.postCount,
      });
    } else {
      map.set(t.topic, { ...t, avgEngagementRate: t.avgEngagementRate * alpha });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)
    .slice(0, 20);
}
