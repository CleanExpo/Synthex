#!/usr/bin/env tsx
/**
 * SYN-847 — Seed the Unite-Group workspace + brand-tenant orgs.
 *
 * IDEMPOTENT: re-running this script is safe. Existing orgs (matched by slug)
 * are updated to point at the Unite-Group parent if they don't already.
 *
 * USAGE:
 *   npx tsx scripts/seed-unite-group-workspace.ts
 *
 * REQUIRES:
 *   - DATABASE_URL pointing at the Synthex Supabase
 *   - The seeding user must already exist (we attach them as admin of every brand)
 *   - Schema migration `20260501_workspace_parent_org` must have been applied
 *
 * BRANDS (per ceo-foundation.md):
 *   1. Disaster Recovery (DR) — established consumer brand
 *   2. NRPG (National Restoration Professionals Group) — DR add-on / contractor network
 *   3. RestoreAssist (RA) — launch-stage B2B SaaS, App Store launch 4 May 2026
 *   4. CARSI — IICRC CEC training platform
 *
 * Re-open SYN-847 if scope changes.
 */

// Use the project's configured Prisma singleton — Prisma 7 requires explicit
// adapter config (PrismaPg via Supavisor pooler) which lib/prisma.ts handles.
import { prisma } from '../lib/prisma';

// ─── Owner email — must match an existing User row ──────────────────────────
// Falls back to env override; otherwise uses the canonical owner email.
const OWNER_EMAIL =
  process.env.UNITE_GROUP_OWNER_EMAIL ?? 'phill.mcgurk@gmail.com';

// ─── Workspace + brand definitions ──────────────────────────────────────────

interface BrandSpec {
  slug: string;
  name: string;
  description: string;
  website?: string;
  industry?: string;
  /** Q2.5.5 voice tag from ceo-foundation.md */
  voiceTag: string;
  /** Plan defaults to 'enterprise' for internal portfolio brands */
  plan?: 'free' | 'starter' | 'pro' | 'enterprise';
}

const UNITE_GROUP_PARENT: BrandSpec = {
  slug: 'unite-group',
  name: 'Unite-Group',
  description:
    'Australian-owned tech holding company. Umbrella workspace for Unite-Group Nexus brand portfolio.',
  website: 'https://unite-group.com.au',
  industry: 'technology',
  voiceTag: 'workspace-parent',
  plan: 'enterprise',
};

const BRAND_CHILDREN: BrandSpec[] = [
  {
    slug: 'disaster-recovery',
    name: 'Disaster Recovery',
    description:
      'Australian disaster recovery and emergency restoration brand. National service-area pipeline (DR + NRPG add-on).',
    website: 'https://disasterrecovery.com.au',
    industry: 'professional-services',
    voiceTag: 'brand_anonymous',
    plan: 'enterprise',
  },
  {
    slug: 'nrpg',
    name: 'NRPG (National Restoration Professionals Group)',
    description:
      'Australian restoration contractor network. Add-on to Disaster Recovery — peer-to-peer trust + contractor recruitment surfaces use founder voice.',
    website: 'https://nrpg.com.au',
    industry: 'professional-services',
    voiceTag: 'hybrid_phill_strategic',
    plan: 'enterprise',
  },
  {
    slug: 'restoreassist',
    name: 'RestoreAssist',
    description:
      "Australia's first Australian-designed full CRM — Office and Field Management System designed specifically for the Australian Restoration Industry. Apple Store launch 4 May 2026.",
    website: 'https://restoreassist.app',
    industry: 'technology',
    voiceTag: 'hybrid_phill_strategic_brand_routine',
    plan: 'enterprise',
  },
  {
    slug: 'carsi',
    name: 'CARSI',
    description:
      'IICRC CEC-approved provider of online restoration and cleaning training for Australian techs. $20 entry / $795/yr all-access.',
    website: 'https://carsi.com.au',
    industry: 'education',
    voiceTag: 'brand_anonymous',
    plan: 'enterprise',
  },
];

// ─── Settings JSON helper ───────────────────────────────────────────────────

function buildSettings(brand: BrandSpec, isParent: boolean) {
  return {
    voiceTag: brand.voiceTag,
    workspaceRole: isParent ? 'parent' : 'child',
    seededBy: 'scripts/seed-unite-group-workspace.ts',
    seededAt: new Date().toISOString(),
    seedSource: 'SYN-847',
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[seed] Looking up owner user (${OWNER_EMAIL})…`);
  const owner = await prisma.user.findUnique({
    where: { email: OWNER_EMAIL },
    select: { id: true, email: true, name: true },
  });

  if (!owner) {
    console.error(
      `[seed] FATAL: User ${OWNER_EMAIL} not found. Sign in at synthex.social once to create the user, then re-run this script.`
    );
    process.exit(1);
  }
  console.log(`[seed] Owner found: ${owner.id} (${owner.name ?? owner.email})`);

  // 1. Upsert the Unite-Group parent workspace org
  console.log(`[seed] Upserting parent workspace: ${UNITE_GROUP_PARENT.slug}`);
  const parent = await prisma.organization.upsert({
    where: { slug: UNITE_GROUP_PARENT.slug },
    create: {
      name: UNITE_GROUP_PARENT.name,
      slug: UNITE_GROUP_PARENT.slug,
      description: UNITE_GROUP_PARENT.description,
      website: UNITE_GROUP_PARENT.website,
      industry: UNITE_GROUP_PARENT.industry,
      plan: UNITE_GROUP_PARENT.plan ?? 'enterprise',
      status: 'active',
      domain: `${UNITE_GROUP_PARENT.slug}.synthex.social`,
      settings: buildSettings(UNITE_GROUP_PARENT, true),
      maxUsers: 999_999,
      maxPosts: 999_999,
      maxCampaigns: 999_999,
      // No parentOrgId — this IS the parent
      users: { connect: { id: owner.id } },
    },
    update: {
      // Don't overwrite settings if they already exist; just ensure the owner
      // is connected and key fields are sane.
      users: { connect: { id: owner.id } },
      website: UNITE_GROUP_PARENT.website,
      industry: UNITE_GROUP_PARENT.industry,
    },
    select: { id: true, slug: true, name: true },
  });
  console.log(`[seed] ✓ Parent ${parent.slug} → ${parent.id}`);

  // 2. Upsert each brand child + link to parent
  for (const brand of BRAND_CHILDREN) {
    console.log(`[seed] Upserting brand child: ${brand.slug}`);
    const child = await prisma.organization.upsert({
      where: { slug: brand.slug },
      create: {
        name: brand.name,
        slug: brand.slug,
        description: brand.description,
        website: brand.website,
        industry: brand.industry,
        plan: brand.plan ?? 'enterprise',
        status: 'active',
        domain: `${brand.slug}.synthex.social`,
        settings: buildSettings(brand, false),
        maxUsers: 999_999,
        maxPosts: 999_999,
        maxCampaigns: 999_999,
        parentOrgId: parent.id,
        users: { connect: { id: owner.id } },
      },
      update: {
        // Link to parent if not already; don't overwrite settings.
        parentOrgId: parent.id,
        users: { connect: { id: owner.id } },
        website: brand.website,
        industry: brand.industry,
      },
      select: { id: true, slug: true, parentOrgId: true },
    });
    console.log(
      `[seed]   ✓ ${child.slug} → ${child.id} (parent ${child.parentOrgId})`
    );
  }

  // 3. Verify (explicit select — avoids pre-existing prod schema drift on first_win_detected)
  const workspace = await prisma.organization.findUnique({
    where: { slug: UNITE_GROUP_PARENT.slug },
    select: {
      id: true,
      slug: true,
      name: true,
      children: {
        select: { slug: true, name: true, status: true },
        orderBy: { slug: 'asc' },
      },
      users: { select: { email: true } },
    },
  });

  if (!workspace) {
    console.error(
      '[seed] FATAL: post-seed verification failed — parent missing'
    );
    process.exit(1);
  }

  console.log(`\n[seed] ─── Workspace verification ─────────────────────────`);
  console.log(`[seed] Parent:   ${workspace.slug} (${workspace.name})`);
  console.log(
    `[seed] Owner:    ${workspace.users.map(u => u.email).join(', ')}`
  );
  console.log(`[seed] Children: ${workspace.children.length}`);
  for (const c of workspace.children) {
    console.log(`[seed]   - ${c.slug.padEnd(20)} (${c.status})`);
  }
  console.log(
    `[seed] ────────────────────────────────────────────────────────\n`
  );
  console.log(
    '[seed] ✅ Seed complete. Visit https://synthex.social/unite-group'
  );
}

main()
  .catch(err => {
    console.error('[seed] FATAL:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
