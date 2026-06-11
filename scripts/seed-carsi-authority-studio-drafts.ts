#!/usr/bin/env tsx
/**
 * Seed CARSI authority campaign drafts into the Client Content Studio.
 *
 * Defaults to dry-run. Use --write only after confirming the pack and target org.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed-carsi-authority-studio-drafts.ts
 *   npx tsx --env-file=.env.local scripts/seed-carsi-authority-studio-drafts.ts --write
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

const CAMPAIGN_ID = 'carsi-restoration-training-authority-2026-06-11';
const CLIENT_SLUG = 'carsi';
const PACK_PATH = path.join(
  process.cwd(),
  'docs/marketing-agency/full-authority-campaigns',
  CAMPAIGN_ID,
  'campaign-pack.json'
);
const WRITE = process.argv.includes('--write');

interface CampaignDraft {
  slotId: string;
  channel: string;
  title: string;
  body: string;
  cta: string;
  evidenceRefs: string[];
  assetBrief: string;
  mediaPlan: unknown;
  peerBenchmark: unknown;
  publishInstruction: string;
}

interface CampaignPack {
  campaignId: string;
  objective: string;
  generatedAt: string;
  drafts: CampaignDraft[];
  externalPublishBlocks: unknown;
  qualityGate: { status: string; overallScore: number };
  ownedMediaGate: { allowed: boolean };
}

function loadPack(): CampaignPack {
  const parsed = JSON.parse(readFileSync(PACK_PATH, 'utf8')) as CampaignPack;
  if (parsed.campaignId !== CAMPAIGN_ID) {
    throw new Error(`Unexpected campaignId: ${parsed.campaignId}`);
  }
  if (!Array.isArray(parsed.drafts) || parsed.drafts.length === 0) {
    throw new Error('Campaign pack has no drafts to seed.');
  }
  return parsed;
}

function metadataForDraft(
  pack: CampaignPack,
  draft: CampaignDraft
): Prisma.InputJsonObject {
  return {
    authorityCampaignId: pack.campaignId,
    slotId: draft.slotId,
    sourcePack: path.relative(process.cwd(), PACK_PATH),
    generatedAt: pack.generatedAt,
    channel: draft.channel,
    cta: draft.cta,
    evidenceRefs: draft.evidenceRefs,
    assetBrief: draft.assetBrief,
    mediaPlan: draft.mediaPlan as Prisma.InputJsonValue,
    peerBenchmark: draft.peerBenchmark as Prisma.InputJsonValue,
    publishInstruction: draft.publishInstruction,
    qualityGate: pack.qualityGate,
    ownedMediaGate: pack.ownedMediaGate,
    externalPublishBlocks: pack.externalPublishBlocks as Prisma.InputJsonValue,
    externalPublishingAllowed: false,
  };
}

async function main() {
  const pack = loadPack();
  const org = await prisma.organization.findUnique({
    where: { slug: CLIENT_SLUG },
    select: { id: true, name: true, slug: true },
  });

  if (!org) {
    throw new Error(`Organisation not found for slug: ${CLIENT_SLUG}`);
  }

  console.log(
    `[seed] ${WRITE ? 'write' : 'dry-run'} CARSI studio drafts for ${org.name} (${org.id})`
  );
  console.log(
    `[seed] pack=${pack.campaignId} drafts=${pack.drafts.length} quality=${pack.qualityGate.status}:${pack.qualityGate.overallScore}`
  );

  let created = 0;
  let updated = 0;

  for (const draft of pack.drafts) {
    const existing = await prisma.studioContentDraft.findFirst({
      where: {
        organizationId: org.id,
        clientSlug: CLIENT_SLUG,
        metadata: {
          path: ['slotId'],
          equals: draft.slotId,
        },
      },
      select: { id: true },
    });

    const data = {
      organizationId: org.id,
      clientSlug: CLIENT_SLUG,
      topic: draft.title,
      script: `${draft.body}\n\nCTA: ${draft.cta}`,
      platforms: [draft.channel],
      videoProvider: 'owned_media',
      videoId: null,
      videoUrl: null,
      status: 'awaiting_approval',
      metadata: metadataForDraft(pack, draft),
    };

    if (!WRITE) {
      console.log(
        `[seed] ${existing ? 'would update' : 'would create'} ${draft.slotId} (${draft.channel})`
      );
      continue;
    }

    if (existing) {
      await prisma.studioContentDraft.update({
        where: { id: existing.id },
        data,
      });
      updated += 1;
    } else {
      await prisma.studioContentDraft.create({ data });
      created += 1;
    }
  }

  console.log(`[seed] complete created=${created} updated=${updated}`);
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
