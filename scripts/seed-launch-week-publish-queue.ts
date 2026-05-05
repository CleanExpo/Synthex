#!/usr/bin/env tsx
/**
 * Seed the launch-week publish queue (SYN-858).
 *
 * Creates 11 Post rows in the publish queue with scheduledAt populated
 * for the Mon 4 May → Fri 8 May 2026 launch cadence.
 *
 * SOURCE OF CONTENT:
 *   .claude/scratchpad/posts-launch-batch-2026-04-30.md (11/11 PASS through
 *   brand-voice-enforce 2026-05-01)
 *
 * IDEMPOTENT: Skips creation if a Post with matching title slug already
 * exists in the brand's launch campaign. Re-running is safe; updates
 * scheduledAt if the post already exists.
 *
 * USAGE:
 *   # Dry run (recommended first):
 *   npx tsx --env-file=.env scripts/seed-launch-week-publish-queue.ts --dry-run
 *
 *   # Real run (requires CEO cadence approval first):
 *   npx tsx --env-file=.env scripts/seed-launch-week-publish-queue.ts
 *
 * REQUIRES:
 *   - Workspace + brand orgs seeded (PR #144 done)
 *   - BrandDNA seeded (PR #147 done)
 *   - Owner user phill.mcgurk@gmail.com exists with admin permissions
 *
 * VERIFICATION (after run):
 *   SELECT p.id, p.platform, p.status, p.scheduled_at, c.name AS campaign,
 *          o.slug AS brand
 *   FROM posts p
 *   JOIN campaigns c ON c.id = p.campaign_id
 *   JOIN organizations o ON o.id = c.organization_id
 *   WHERE c.name LIKE 'RA Launch Week%' OR c.name LIKE 'CARSI Launch Week%'
 *   ORDER BY p.scheduled_at ASC;
 */

import { prisma } from '../lib/prisma';

const DRY_RUN = process.argv.includes('--dry-run');
const OWNER_EMAIL = process.env.LAUNCH_OWNER_EMAIL ?? 'phill.mcgurk@gmail.com';

// ─── Cadence (Australia/Sydney = AEST UTC+10) ───────────────────────────────
// Times in UTC. AEST 08:00 = 22:00 UTC the previous day.
// Mon 4 May 2026 08:00 AEST = Sun 3 May 2026 22:00 UTC.

interface ScheduledPost {
  postKey: string; // unique identifier — used as idempotency key
  brand: 'restoreassist' | 'carsi';
  title: string; // first 80 chars of post for display
  contentExcerpt: string; // full body — truncated for the Post.content field
  platform: 'linkedin';
  scheduledAtUtc: string; // ISO-8601 UTC
  metadata: {
    series: string;
    audience: string;
    voiceTag: string;
    hashtags: string[];
    cta: string;
    conversionHypothesis?: string;
    sourceFile: string;
    sourceLineRange: string;
  };
}

const CADENCE: ScheduledPost[] = [
  // ─── Monday 4 May 2026 ──────────────────────────────────────────────────
  {
    postKey: 'ra-02-founder-origin-2026-05-04',
    brand: 'restoreassist',
    title: 'RA POST 02 — Founder origin (Phill voice · hybrid)',
    contentExcerpt:
      'See full draft at .claude/scratchpad/posts-launch-batch-2026-04-30.md L186–233',
    platform: 'linkedin',
    scheduledAtUtc: '2026-05-03T22:00:00Z', // Mon 4 May 08:00 AEST — LAUNCH MOMENT
    metadata: {
      series: 'Founder Origin',
      audience:
        'Restoration Companies + Insurance Adjusters + Property Managers',
      voiceTag: 'hybrid_phill_strategic_brand_routine',
      hashtags: [
        '#RestorationIndustry',
        '#AustralianBusiness',
        '#RestoreAssist',
      ],
      cta: 'See the workflow at restoreassist.app',
      conversionHypothesis:
        'click-through to restoreassist.app ≥ 4.0% by 11 May 2026 (n ≥ 1000). Kill if ≤ 1.2% at 72h.',
      sourceFile: '.claude/scratchpad/posts-launch-batch-2026-04-30.md',
      sourceLineRange: 'L186-233',
    },
  },
  {
    postKey: 'carsi-01-pricing-anchor-2026-05-04',
    brand: 'carsi',
    title: 'CARSI POST 01 — Pricing-anchored value prop (brand_anonymous)',
    contentExcerpt:
      'See full draft at .claude/scratchpad/posts-launch-batch-2026-04-30.md L21–69',
    platform: 'linkedin',
    scheduledAtUtc: '2026-05-03T23:00:00Z', // Mon 4 May 09:00 AEST
    metadata: {
      series: 'Pricing-anchored',
      audience: 'IICRC-certified restoration techs needing CEC maintenance',
      voiceTag: 'brand_anonymous',
      hashtags: [
        '#IICRC',
        '#RestorationIndustry',
        '#CECCredits',
        '#AustralianRestoration',
      ],
      cta: 'Start a course at carsi.com.au',
      conversionHypothesis:
        'CARSI-trial signup CTR ≥ 2.5% by 11 May 2026 (n ≥ 800). Kill if ≤ 0.8% at 72h.',
      sourceFile: '.claude/scratchpad/posts-launch-batch-2026-04-30.md',
      sourceLineRange: 'L21-69',
    },
  },

  // ─── Tuesday 5 May 2026 ─────────────────────────────────────────────────
  {
    postKey: 'ra-03-category-creation-2026-05-05',
    brand: 'restoreassist',
    title: 'RA POST 03 — Category creation (brand voice)',
    contentExcerpt:
      'See full draft at .claude/scratchpad/posts-launch-batch-2026-04-30.md L235–270',
    platform: 'linkedin',
    scheduledAtUtc: '2026-05-04T22:00:00Z', // Tue 5 May 08:00 AEST
    metadata: {
      series: 'Category Creation',
      audience: 'Restoration Companies (primary buyer)',
      voiceTag: 'hybrid_phill_strategic_brand_routine',
      hashtags: ['#RestorationIndustry', '#AustralianBusiness', '#CRM'],
      cta: 'See the workflow at restoreassist.app',
      sourceFile: '.claude/scratchpad/posts-launch-batch-2026-04-30.md',
      sourceLineRange: 'L235-270',
    },
  },
  {
    postKey: 'carsi-02-geography-pain-2026-05-05',
    brand: 'carsi',
    title: 'CARSI POST 02 — Geography pain point (brand_anonymous)',
    contentExcerpt:
      'See full draft at .claude/scratchpad/posts-launch-batch-2026-04-30.md L71–102',
    platform: 'linkedin',
    scheduledAtUtc: '2026-05-04T23:00:00Z', // Tue 5 May 09:00 AEST
    metadata: {
      series: 'Geography pain',
      audience: 'Regional + remote IICRC techs (Cairns to Kalgoorlie)',
      voiceTag: 'brand_anonymous',
      hashtags: ['#RegionalAustralia', '#IICRC', '#CECCredits'],
      cta: 'Start a course at carsi.com.au',
      sourceFile: '.claude/scratchpad/posts-launch-batch-2026-04-30.md',
      sourceLineRange: 'L71-102',
    },
  },

  // ─── Wednesday 6 May 2026 ───────────────────────────────────────────────
  {
    postKey: 'ra-04-office-field-unification-2026-05-06',
    brand: 'restoreassist',
    title: 'RA POST 04 — Office + Field unification (brand voice)',
    contentExcerpt:
      'See full draft at .claude/scratchpad/posts-launch-batch-2026-04-30.md L272–308',
    platform: 'linkedin',
    scheduledAtUtc: '2026-05-05T22:00:00Z', // Wed 6 May 08:00 AEST
    metadata: {
      series: 'Office + Field unification',
      audience: 'Restoration Companies + Insurance Adjusters',
      voiceTag: 'hybrid_phill_strategic_brand_routine',
      hashtags: ['#RestorationIndustry', '#AustralianBusiness', '#FieldOps'],
      cta: 'See the workflow at restoreassist.app',
      sourceFile: '.claude/scratchpad/posts-launch-batch-2026-04-30.md',
      sourceLineRange: 'L272-308',
    },
  },
  {
    postKey: 'carsi-03-founder-origin-2026-05-06',
    brand: 'carsi',
    title: 'CARSI POST 03 — Founder voice · why CARSI exists (phill_fronted)',
    contentExcerpt:
      'See full draft at .claude/scratchpad/posts-launch-batch-2026-04-30.md L104–148',
    platform: 'linkedin',
    scheduledAtUtc: '2026-05-05T23:00:00Z', // Wed 6 May 09:00 AEST
    metadata: {
      series: 'Founder Origin',
      audience: 'IICRC techs + restoration business owners',
      voiceTag: 'phill_fronted',
      hashtags: ['#FounderStory', '#IICRC', '#AustralianRestoration'],
      cta: 'Start a course at carsi.com.au',
      sourceFile: '.claude/scratchpad/posts-launch-batch-2026-04-30.md',
      sourceLineRange: 'L104-148',
    },
  },

  // ─── Thursday 7 May 2026 ────────────────────────────────────────────────
  {
    postKey: 'ra-05-ai-as-assistant-2026-05-07',
    brand: 'restoreassist',
    title: 'RA POST 05 — AI as assistant (brand voice — anti-hype framing)',
    contentExcerpt:
      'See full draft at .claude/scratchpad/posts-launch-batch-2026-04-30.md L310–345',
    platform: 'linkedin',
    scheduledAtUtc: '2026-05-06T22:00:00Z', // Thu 7 May 08:00 AEST
    metadata: {
      series: 'AI as Assistant',
      audience: 'Restoration Companies + technicians',
      voiceTag: 'hybrid_phill_strategic_brand_routine',
      hashtags: ['#AI', '#RestorationIndustry', '#FieldOps'],
      cta: 'See the workflow at restoreassist.app',
      sourceFile: '.claude/scratchpad/posts-launch-batch-2026-04-30.md',
      sourceLineRange: 'L310-345',
    },
  },
  {
    postKey: 'carsi-04-verifiable-credential-2026-05-07',
    brand: 'carsi',
    title: 'CARSI POST 04 — Verifiable credential angle (brand_anonymous)',
    contentExcerpt:
      'See full draft at .claude/scratchpad/posts-launch-batch-2026-04-30.md L150–184',
    platform: 'linkedin',
    scheduledAtUtc: '2026-05-06T23:00:00Z', // Thu 7 May 09:00 AEST
    metadata: {
      series: 'Verifiable Credential',
      audience: 'IICRC-certified techs',
      voiceTag: 'brand_anonymous',
      hashtags: ['#IICRC', '#CECCredits', '#LinkedInLearning'],
      cta: 'Start a course at carsi.com.au',
      sourceFile: '.claude/scratchpad/posts-launch-batch-2026-04-30.md',
      sourceLineRange: 'L150-184',
    },
  },

  // ─── Friday 8 May 2026 ──────────────────────────────────────────────────
  {
    postKey: 'ra-06-mould-documentation-2026-05-08',
    brand: 'restoreassist',
    title:
      "RA POST 06 — Technical Shield · Mould doesn't argue with documentation",
    contentExcerpt:
      'See full draft at .claude/scratchpad/posts-launch-batch-2026-04-30.md L405–454',
    platform: 'linkedin',
    scheduledAtUtc: '2026-05-07T22:00:00Z', // Fri 8 May 08:00 AEST
    metadata: {
      series: 'Technical Shield',
      audience: 'Restoration Companies + CARSI specialists',
      voiceTag: 'hybrid_phill_strategic_brand_routine',
      hashtags: [
        '#MouldRemediation',
        '#IICRC',
        '#RestorationIndustry',
        '#S520',
      ],
      cta: 'See the workflow at restoreassist.app',
      sourceFile: '.claude/scratchpad/posts-launch-batch-2026-04-30.md',
      sourceLineRange: 'L405-454',
    },
  },
  {
    postKey: 'ra-07-sovereignty-2026-05-08',
    brand: 'restoreassist',
    title: 'RA POST 07 — Sovereignty · Why Australian-designed matters',
    contentExcerpt:
      'See full draft at .claude/scratchpad/posts-launch-batch-2026-04-30.md L456–493',
    platform: 'linkedin',
    scheduledAtUtc: '2026-05-08T01:00:00Z', // Fri 8 May 11:00 AEST (offset to not stack with RA06)
    metadata: {
      series: 'Sovereignty',
      audience: 'Restoration Companies + Insurance Adjusters',
      voiceTag: 'hybrid_phill_strategic_brand_routine',
      hashtags: [
        '#AustralianBusiness',
        '#RestorationIndustry',
        '#RestoreAssist',
        '#NewZealandBusiness',
      ],
      cta: 'See the workflow at restoreassist.app',
      conversionHypothesis:
        'Click-through ≥ 3.2% by 16 May 2026 (n ≥ 700). Kill if ≤ 1.0% at 72h.',
      sourceFile: '.claude/scratchpad/posts-launch-batch-2026-04-30.md',
      sourceLineRange: 'L456-493',
    },
  },
  {
    postKey: 'carsi-08-technical-shield-2026-05-08',
    brand: 'carsi',
    title: 'CARSI POST 08 — Technical Shield · Standards as defence',
    contentExcerpt:
      'See full draft at .claude/scratchpad/posts-launch-batch-2026-04-30.md L495–565',
    platform: 'linkedin',
    scheduledAtUtc: '2026-05-07T23:00:00Z', // Fri 8 May 09:00 AEST
    metadata: {
      series: 'Technical Shield',
      audience: 'IICRC techs + restoration business owners',
      voiceTag: 'brand_anonymous',
      hashtags: ['#IICRC', '#Compliance', '#RestorationIndustry'],
      cta: 'Start a course at carsi.com.au',
      sourceFile: '.claude/scratchpad/posts-launch-batch-2026-04-30.md',
      sourceLineRange: 'L495-565',
    },
  },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    `[seed] Launch-week publish queue · ${CADENCE.length} posts · DRY_RUN=${DRY_RUN}`
  );

  // 1. Look up owner
  const owner = await prisma.user.findUnique({
    where: { email: OWNER_EMAIL },
    select: { id: true, email: true },
  });
  if (!owner) {
    console.error(`[seed] FATAL: owner ${OWNER_EMAIL} not found`);
    process.exit(1);
  }

  // 2. Look up the two brand orgs
  const orgs = await prisma.organization.findMany({
    where: { slug: { in: ['restoreassist', 'carsi'] } },
    select: { id: true, slug: true },
  });
  const orgBySlug = Object.fromEntries(orgs.map(o => [o.slug, o.id]));
  if (!orgBySlug.restoreassist || !orgBySlug.carsi) {
    console.error(
      `[seed] FATAL: missing org(s). Found: ${orgs.map(o => o.slug).join(', ')}`
    );
    process.exit(1);
  }

  // 3. Ensure a launch campaign exists per brand
  const campaignBySlug: Record<string, string> = {};
  for (const slug of ['restoreassist', 'carsi'] as const) {
    const campaignName = `${slug === 'restoreassist' ? 'RA' : 'CARSI'} Launch Week 2026-05-04`;
    const existing = await prisma.campaign.findFirst({
      where: {
        organizationId: orgBySlug[slug],
        name: campaignName,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) {
      campaignBySlug[slug] = existing.id;
      console.log(`[seed]   campaign exists: ${campaignName} → ${existing.id}`);
    } else if (DRY_RUN) {
      console.log(`[seed]   WOULD create campaign: ${campaignName}`);
      campaignBySlug[slug] = '<dry-run-placeholder>';
    } else {
      const created = await prisma.campaign.create({
        data: {
          name: campaignName,
          description: `Launch-week publish queue for ${slug} · 4-8 May 2026 · sourced from .claude/scratchpad/posts-launch-batch-2026-04-30.md (11/11 PASS through brand-voice-enforce)`,
          platform: 'linkedin',
          status: 'active',
          userId: owner.id,
          organizationId: orgBySlug[slug],
          settings: { source: 'SYN-858 launch-week seeding' },
        },
        select: { id: true },
      });
      campaignBySlug[slug] = created.id;
      console.log(`[seed]   + campaign: ${campaignName} → ${created.id}`);
    }
  }

  // 4. Seed each post (idempotent on metadata.postKey)
  let created = 0;
  let updated = 0;

  for (const spec of CADENCE) {
    const campaignId = campaignBySlug[spec.brand];

    // Look up existing by metadata.postKey (within the campaign)
    const existing = await prisma.post.findFirst({
      where: {
        campaignId,
        deletedAt: null,
        metadata: { path: ['postKey'], equals: spec.postKey } as object,
      },
      select: { id: true, scheduledAt: true, status: true },
    });

    const data = {
      content: `${spec.title}\n\n${spec.contentExcerpt}\n\nCTA: ${spec.metadata.cta}\nHashtags: ${spec.metadata.hashtags.join(' ')}`,
      platform: spec.platform,
      status: 'scheduled',
      scheduledAt: new Date(spec.scheduledAtUtc),
      metadata: {
        ...spec.metadata,
        postKey: spec.postKey,
        title: spec.title,
        seededBy: 'scripts/seed-launch-week-publish-queue.ts',
        seededAt: new Date().toISOString(),
        ticket: 'SYN-858',
      } as object,
    };

    const aest = new Date(spec.scheduledAtUtc).toLocaleString('en-AU', {
      timeZone: 'Australia/Sydney',
      dateStyle: 'short',
      timeStyle: 'short',
    });

    if (existing) {
      if (DRY_RUN) {
        console.log(
          `[seed]   WOULD update: ${spec.postKey.padEnd(45)} → ${aest} AEST (was ${existing.scheduledAt?.toISOString()})`
        );
      } else {
        await prisma.post.update({
          where: { id: existing.id },
          data,
        });
        console.log(
          `[seed]   ✓ updated: ${spec.postKey.padEnd(45)} → ${aest} AEST`
        );
      }
      updated += 1;
    } else if (DRY_RUN) {
      console.log(
        `[seed]   WOULD create: ${spec.postKey.padEnd(45)} → ${aest} AEST`
      );
      created += 1;
    } else {
      await prisma.post.create({
        data: { ...data, campaignId },
      });
      console.log(
        `[seed]   + created: ${spec.postKey.padEnd(45)} → ${aest} AEST`
      );
      created += 1;
    }
  }

  console.log(
    `\n[seed] Complete. created=${created} updated=${updated} dry_run=${DRY_RUN}`
  );

  if (!DRY_RUN) {
    // Verify
    const queued = await prisma.post.findMany({
      where: {
        campaign: {
          name: {
            in: ['RA Launch Week 2026-05-04', 'CARSI Launch Week 2026-05-04'],
          },
        },
        deletedAt: null,
      },
      select: {
        scheduledAt: true,
        status: true,
        metadata: true,
        campaign: {
          select: {
            name: true,
            organization: { select: { slug: true } },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    console.log(
      `\n[seed] ─── Publish-queue verification ───────────────────────`
    );
    for (const p of queued) {
      const meta = p.metadata as { postKey?: string };
      const aest = p.scheduledAt?.toLocaleString('en-AU', {
        timeZone: 'Australia/Sydney',
        dateStyle: 'short',
        timeStyle: 'short',
      });
      console.log(
        `[seed]   ${p.status.padEnd(10)} ${aest?.padEnd(20) ?? 'unscheduled'} ${meta.postKey ?? '?'}`
      );
    }
    console.log(
      `[seed] ──────────────────────────────────────────────────────\n`
    );
  }
}

main()
  .catch(err => {
    console.error('[seed] FATAL:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
