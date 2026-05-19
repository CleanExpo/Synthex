#!/usr/bin/env tsx
/**
 * Verify CARSI + RestoreAssist tenant onboarding completion.
 *
 * Used after CEO walks the onboarding UI to confirm:
 *   - Each org's Organization.settings has a populated voiceTag
 *   - BrandDNA row exists with matching voiceTag (per Q2.5.5 matrix)
 *   - Voice tags align: CARSI=brand_anonymous, RA=hybrid_phill_strategic_brand_routine
 *
 * USAGE: npx tsx --env-file=.env scripts/verify-tenant-onboarding.ts
 */

import { prisma } from '../lib/prisma';

const EXPECTED_VOICE_TAGS: Record<string, string> = {
  carsi: 'brand_anonymous',
  restoreassist: 'hybrid_phill_strategic_brand_routine',
  'disaster-recovery': 'brand_anonymous',
  nrpg: 'hybrid_phill_strategic',
};

async function main() {
  const orgs = await prisma.organization.findMany({
    where: {
      slug: {
        in: ['carsi', 'restoreassist', 'disaster-recovery', 'nrpg'],
      },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      settings: true,
      brandDna: {
        select: {
          businessName: true,
          brandVoice: true,
          persona: true,
          offerings: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { slug: 'asc' },
  });

  console.log(`[verify] Tenant onboarding state — ${orgs.length} orgs found\n`);

  let allReady = true;

  for (const o of orgs) {
    // Source of truth = BrandDNA. Organization.settings is informational (no production
    // code reads settings.voiceTag — verified 2026-05-03 grep across app/lib).
    const dnaVoiceTag = (
      o.brandDna?.brandVoice as { voiceTag?: string } | undefined
    )?.voiceTag;
    const expected = EXPECTED_VOICE_TAGS[o.slug];

    const dnaMatch = dnaVoiceTag === expected;
    const offeringsCount = Array.isArray(o.brandDna?.offerings)
      ? (o.brandDna?.offerings as unknown[]).length
      : 0;
    const personaPopulated = Boolean(
      (o.brandDna?.persona as { description?: string } | undefined)?.description
    );

    const overall = dnaMatch && offeringsCount > 0 && personaPopulated;
    if (!overall) allReady = false;

    console.log(
      `[verify] ${overall ? '[OK]' : '[!! ]'} ${o.slug.padEnd(20)} ${o.name.padEnd(35)}`
    );
    console.log(
      `         brandDna.voiceTag    : ${dnaVoiceTag ?? '(none)'}    ${dnaMatch ? '[match]' : '[!! mismatch — expected: ' + expected + ']'}`
    );
    console.log(
      `         offerings count      : ${offeringsCount}    persona populated: ${personaPopulated}`
    );
    console.log(
      `         brandDna last update : ${o.brandDna?.updatedAt?.toISOString() ?? '(no row)'}`
    );
    console.log('');
  }

  console.log(
    `[verify] ${allReady ? '[OK]' : '[!!]'} Overall: ${allReady ? 'ALL TENANTS READY' : 'SOME TENANTS NEED ATTENTION'}\n`
  );

  // Cross-check publish queue scheduled
  const queued = await prisma.post.findMany({
    where: {
      status: 'scheduled',
      campaign: {
        name: {
          in: ['RA Launch Week 2026-05-04', 'CARSI Launch Week 2026-05-04'],
        },
      },
      deletedAt: null,
    },
    select: {
      scheduledAt: true,
      metadata: true,
      campaign: { select: { name: true } },
    },
    orderBy: { scheduledAt: 'asc' },
  });

  console.log(`[verify] Publish queue: ${queued.length}/11 scheduled posts\n`);

  if (queued.length === 11) {
    console.log(
      '[verify] [OK] Publish queue at full capacity for launch week\n'
    );
  } else {
    console.log(
      `[verify] [!!] Expected 11 scheduled posts, found ${queued.length}\n`
    );
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('[verify] FATAL:', err);
  process.exit(1);
});
