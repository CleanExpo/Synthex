/**
 * Idempotent portfolio brand seed — SYN-973
 * Run: npx tsx prisma/seed-brand.ts
 *
 * Creates Unite workspace parent + DR, NRPG, RestoreAssist, CARSI orgs with BrandDNA.
 * CCW carve-out: not seeded (see portfolio-brand-configs.ts).
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  PORTFOLIO_BRANDS,
  UNITE_WORKSPACE_SLUG,
  type PortfolioBrandConfig,
} from '../lib/agency/portfolio-brand-configs';

const prisma = new PrismaClient();

const PORTFOLIO_PASSWORD =
  process.env.PORTFOLIO_SEED_PASSWORD ?? 'PortfolioSeed2026!';

async function upsertWorkspace() {
  return prisma.organization.upsert({
    where: { slug: UNITE_WORKSPACE_SLUG },
    update: { name: 'Unite Group' },
    create: {
      slug: UNITE_WORKSPACE_SLUG,
      name: 'Unite Group',
      description: 'In-house portfolio workspace (SYN-973)',
      plan: 'enterprise',
      status: 'active',
      settings: { type: 'workspace', inHouse: true },
    },
  });
}

async function upsertBrandOrg(
  workspaceId: string,
  brand: PortfolioBrandConfig
) {
  const org = await prisma.organization.upsert({
    where: { slug: brand.slug },
    update: {
      name: brand.name,
      website: brand.website,
      industry: brand.industry,
      parentOrgId: workspaceId,
      settings: {
        voiceTag: brand.voiceTag,
        flywheel: brand.flywheel,
        inHouse: true,
      },
    },
    create: {
      slug: brand.slug,
      name: brand.name,
      website: brand.website,
      industry: brand.industry,
      parentOrgId: workspaceId,
      plan: 'enterprise',
      status: 'active',
      settings: {
        voiceTag: brand.voiceTag,
        flywheel: brand.flywheel,
        inHouse: true,
      },
    },
  });

  const passwordHash = await bcrypt.hash(PORTFOLIO_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: brand.adminEmail },
    update: {
      organizationId: org.id,
      name: `${brand.name} Admin`,
    },
    create: {
      email: brand.adminEmail,
      password: passwordHash,
      name: `${brand.name} Admin`,
      emailVerified: true,
      authProvider: 'local',
      organizationId: org.id,
      preferences: {
        onboardingCompleted: true,
        userType: 'admin',
        portfolioBrand: brand.slug,
      },
    },
  });

  await prisma.brandDNA.upsert({
    where: { organizationId: org.id },
    update: {
      businessName: brand.name,
      vertical: brand.vertical,
      industry: brand.industry,
      brandVoice: brand.brandVoice,
      sourceUrl: brand.website,
      lastRefreshedAt: new Date(),
    },
    create: {
      organizationId: org.id,
      businessName: brand.name,
      vertical: brand.vertical,
      industry: brand.industry,
      brandVoice: brand.brandVoice,
      sourceUrl: brand.website,
    },
  });

  return { org, user };
}

async function main() {
  console.info('🌱 Portfolio brand seed (SYN-973)...');
  const workspace = await upsertWorkspace();
  console.info(`✅ Workspace: ${workspace.slug}`);

  for (const brand of PORTFOLIO_BRANDS) {
    const { org, user } = await upsertBrandOrg(workspace.id, brand);
    console.info(`✅ ${brand.slug} — org ${org.id} · user ${user.email}`);
  }

  console.info('Done. CCW carve-out not seeded — enable manually if required.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
