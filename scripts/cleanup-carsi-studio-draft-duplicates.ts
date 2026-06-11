#!/usr/bin/env tsx
/**
 * Remove duplicate CARSI authority studio cards and backfill dedupe keys.
 *
 * Defaults to dry-run. Use --write after reviewing the printed delete/update counts.
 */

import { prisma } from '../lib/prisma';

const CAMPAIGN_ID = 'carsi-restoration-training-authority-2026-06-11';
const CLIENT_SLUG = 'carsi';
const WRITE = process.argv.includes('--write');

type StudioDraft = {
  id: string;
  topic: string;
  status: string;
  createdAt: Date;
  approvedAt: Date | null;
  publishedAt: Date | null;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function dedupeKeyForTopic(topic: string): string {
  return `${CAMPAIGN_ID}:${slugify(topic)}`;
}

function statusRank(status: string): number {
  if (status === 'published') return 3;
  if (status === 'approved') return 2;
  if (status === 'awaiting_approval') return 1;
  return 0;
}

function preferredDraft(a: StudioDraft, b: StudioDraft): StudioDraft {
  const aRank = statusRank(a.status);
  const bRank = statusRank(b.status);
  if (aRank !== bRank) return aRank > bRank ? a : b;

  const aActionedAt = a.publishedAt ?? a.approvedAt ?? a.createdAt;
  const bActionedAt = b.publishedAt ?? b.approvedAt ?? b.createdAt;
  return aActionedAt >= bActionedAt ? a : b;
}

async function main() {
  const org = await prisma.organization.findUnique({
    where: { slug: CLIENT_SLUG },
    select: { id: true, name: true },
  });
  if (!org) throw new Error(`Organisation not found for slug: ${CLIENT_SLUG}`);

  const drafts = await prisma.studioContentDraft.findMany({
    where: {
      organizationId: org.id,
      clientSlug: CLIENT_SLUG,
      metadata: { path: ['authorityCampaignId'], equals: CAMPAIGN_ID },
    },
    select: {
      id: true,
      topic: true,
      status: true,
      createdAt: true,
      approvedAt: true,
      publishedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const groups = new Map<string, StudioDraft[]>();
  for (const draft of drafts) {
    const key = dedupeKeyForTopic(draft.topic);
    groups.set(key, [...(groups.get(key) ?? []), draft]);
  }

  let keysBackfilled = 0;
  let duplicatesRemoved = 0;

  for (const [dedupeKey, group] of groups) {
    const keeper = group.reduce(preferredDraft);
    const duplicateIds = group
      .filter(draft => draft.id !== keeper.id)
      .map(draft => draft.id);

    console.log(
      `[cleanup] ${dedupeKey} keep=${keeper.id}:${keeper.status} remove=${duplicateIds.length}`
    );

    if (!WRITE) {
      keysBackfilled += 1;
      duplicatesRemoved += duplicateIds.length;
      continue;
    }

    if (duplicateIds.length > 0) {
      const deleted = await prisma.studioContentDraft.deleteMany({
        where: { id: { in: duplicateIds } },
      });
      duplicatesRemoved += deleted.count;
    }

    await prisma.studioContentDraft.update({
      where: { id: keeper.id },
      data: { dedupeKey },
    });
    keysBackfilled += 1;
  }

  console.log(
    `[cleanup] ${WRITE ? 'complete' : 'dry-run'} org=${org.name} total=${drafts.length} unique=${groups.size} removed=${duplicatesRemoved} backfilled=${keysBackfilled}`
  );
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
