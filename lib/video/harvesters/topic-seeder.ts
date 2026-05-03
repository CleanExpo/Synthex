/**
 * Topic Seeder — lib/video/harvesters/topic-seeder.ts
 *
 * Idempotent seeder that:
 *  1. Calls both harvesters to collect raw topics
 *  2. Looks up (or creates) VideoSeries records for BTS + CLIENT
 *  3. Upserts into VideoTopicQueue — skips existing sourceRefs to avoid duplicates
 *  4. Returns a summary report
 *
 * Safe to re-run at any time: new material is added, existing rows are left alone.
 *
 * @task SYN-578
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { harvestBoardMemos, type HarvestedTopic } from './board-memo-harvester';
import { harvestDashboardFeatures } from './feature-harvester';

// ── Default series configuration ──────────────────────────────────────────────

/**
 * Canonical series definitions. These are created once in the DB if missing.
 * organisationId is left null — the video system is org-level, seeded globally
 * and then assigned to an org via the VideoSeries.organisationId field.
 */
const SERIES_DEFINITIONS = {
  bts: {
    slug: 'behind-the-scenes',
    name: 'Behind the Scenes',
    description:
      'Board room discussions, product decisions, and the real story of how Synthex was built. ' +
      'Transparent, technical, and honest — for founders and developers.',
    seriesType: 'bts',
    productionConfig: {
      captureTarget: 'localhost',
      captureUrl: 'http://localhost:3008',
      targetDurationSeconds: 600,
      schedule: 'twice-weekly',
      providers: ['playwright', 'elevenlabs', 'remotion'],
      reviewGateEpisodes: 5,
    },
  },
  client: {
    slug: 'smb-benefits',
    name: 'Benefits for SMB Clients',
    description:
      'Why Synthex is built for AU/NZ small businesses. Real feature demos, actual data, ' +
      'and practical walkthroughs showing how local business owners get more from their marketing.',
    seriesType: 'client',
    productionConfig: {
      captureTarget: 'production',
      captureUrl: 'https://synthex.social',
      targetDurationSeconds: 480,
      schedule: 'twice-weekly',
      providers: ['playwright', 'elevenlabs'],
      reviewGateEpisodes: 5,
    },
  },
} as const;

// ── Types ────────────────────────────────────────────────────────────────────

export interface SeedResult {
  bts: SeriesSeedResult;
  client: SeriesSeedResult;
  totalInserted: number;
  totalSkipped: number;
}

interface SeriesSeedResult {
  seriesId: string;
  inserted: number;
  skipped: number;
  errors: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Get or create a VideoSeries record by slug.
 */
async function upsertSeries(
  seriesDef: (typeof SERIES_DEFINITIONS)[keyof typeof SERIES_DEFINITIONS],
  organisationId?: string
): Promise<string> {
  const existing = await prisma.videoSeries.findUnique({
    where: { slug: seriesDef.slug },
  });

  if (existing) {
    logger.debug('TopicSeeder: series exists', {
      slug: seriesDef.slug,
      id: existing.id,
    });
    return existing.id;
  }

  const created = await prisma.videoSeries.create({
    data: {
      slug: seriesDef.slug,
      name: seriesDef.name,
      description: seriesDef.description,
      seriesType: seriesDef.seriesType,
      organisationId: organisationId ?? null,
      productionConfig: seriesDef.productionConfig,
      status: 'active',
      nextEpisodeNum: 1,
    },
  });

  logger.info('TopicSeeder: series created', {
    slug: seriesDef.slug,
    id: created.id,
  });

  return created.id;
}

/**
 * Upsert topics into VideoTopicQueue for a given series.
 * Skips any row whose sourceRef already exists in the queue.
 */
async function seedTopics(
  seriesId: string,
  topics: HarvestedTopic[]
): Promise<{ inserted: number; skipped: number; errors: number }> {
  // Fetch all existing sourceRefs for this series in one query
  const existing = await prisma.videoTopicQueue.findMany({
    where: { seriesId },
    select: { sourceRef: true },
  });
  const existingRefs = new Set(existing.map(e => e.sourceRef));

  const newTopics = topics.filter(t => !existingRefs.has(t.sourceRef));
  let inserted = 0;
  let errors = 0;

  // Insert in batches of 20
  const BATCH_SIZE = 20;
  for (let i = 0; i < newTopics.length; i += BATCH_SIZE) {
    const batch = newTopics.slice(i, i + BATCH_SIZE);

    try {
      await prisma.videoTopicQueue.createMany({
        data: batch.map(t => ({
          seriesId,
          title: t.title.substring(0, 500),
          description: t.description.substring(0, 1000),
          sourceType: t.sourceType,
          sourceRef: t.sourceRef ?? null,
          priority: t.priority,
          status: 'pending',
        })),
        skipDuplicates: true,
      });

      inserted += batch.length;
    } catch (err) {
      logger.error('TopicSeeder: batch insert failed', {
        batchStart: i,
        error: String(err),
      });
      errors += batch.length;
    }
  }

  return {
    inserted,
    skipped: topics.length - newTopics.length - errors,
    errors,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Run the full seed operation.
 *
 * @param repoRoot        Absolute path to the repository root
 * @param organisationId  Optional org to assign both series to
 */
export async function seedTopicQueue(
  repoRoot: string = process.cwd(),
  organisationId?: string
): Promise<SeedResult> {
  logger.info('TopicSeeder: starting seed', { repoRoot });

  // Run harvesters in parallel
  const [btsHarvest, clientHarvest] = await Promise.all([
    harvestBoardMemos(repoRoot),
    harvestDashboardFeatures(repoRoot),
  ]);

  logger.info('TopicSeeder: harvest complete', {
    btsTopics: btsHarvest.topics.length,
    clientTopics: clientHarvest.topics.length,
  });

  // Upsert series records
  const [btsSeriesId, clientSeriesId] = await Promise.all([
    upsertSeries(SERIES_DEFINITIONS.bts, organisationId),
    upsertSeries(SERIES_DEFINITIONS.client, organisationId),
  ]);

  // Seed topic queues in parallel
  const [btsSeed, clientSeed] = await Promise.all([
    seedTopics(btsSeriesId, btsHarvest.topics),
    seedTopics(clientSeriesId, clientHarvest.topics),
  ]);

  const result: SeedResult = {
    bts: { seriesId: btsSeriesId, ...btsSeed },
    client: { seriesId: clientSeriesId, ...clientSeed },
    totalInserted: btsSeed.inserted + clientSeed.inserted,
    totalSkipped: btsSeed.skipped + clientSeed.skipped,
  };

  logger.info('TopicSeeder: seed complete', {
    btsInserted: result.bts.inserted,
    btsSkipped: result.bts.skipped,
    clientInserted: result.client.inserted,
    clientSkipped: result.client.skipped,
    totalInserted: result.totalInserted,
  });
  return result;
}

/**
 * Seed a single topic directly — useful for on-demand additions.
 */
export async function seedSingleTopic(
  seriesId: string,
  topic: HarvestedTopic
): Promise<{ inserted: boolean }> {
  const existing = await prisma.videoTopicQueue.findFirst({
    where: { seriesId, sourceRef: topic.sourceRef },
  });

  if (existing) {
    return { inserted: false };
  }

  await prisma.videoTopicQueue.create({
    data: {
      seriesId,
      title: topic.title.substring(0, 500),
      description: topic.description.substring(0, 1000),
      sourceType: topic.sourceType,
      sourceRef: topic.sourceRef ?? null,
      priority: topic.priority,
      status: 'pending',
    },
  });

  return { inserted: true };
}
