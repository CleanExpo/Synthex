/**
 * Deterministic sandbox seed (SYN-MCP-000).
 *
 * Idempotent — every row is upserted on a FIXED id so tests can reference
 * fixtures directly (e.g. 'itest-org') and the seed can re-run safely.
 *
 * Fixtures:
 *   Organization             itest-org
 *   User                     itest-user        (member of itest-org)
 *   BrandOperatingSystem     itest-bos         (1:1 with itest-org)
 *   ClientProfile            itest-client-profile
 *   BrandDNA                 itest-brand-dna
 *   MarketingAgencyCampaign  itest-campaign
 *   MarketingAgencySourceRef itest-source-ref
 *   MarketingAgencyClaim     itest-claim       (evidenceStatus 'blocked')
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { assertSandboxDatabaseUrl } from './sandbox-guard';

/**
 * PrismaClient wired for the LOCAL sandbox.
 *
 * Deliberately does NOT reuse lib/prisma.ts: that client is Supabase-tuned
 * (SCRAM patch, ssl.rejectUnauthorized) and forces SSL, which the local
 * sandbox Postgres rejects. Plain pg Pool, no SSL, guard-checked URL.
 */
export function createSandboxPrismaClient(): {
  prisma: PrismaClient;
  pool: Pool;
} {
  const url = assertSandboxDatabaseUrl(process.env.DATABASE_URL);
  const pool = new Pool({ connectionString: url, max: 2 });
  // Cast mirrors lib/prisma.ts: @prisma/adapter-pg bundles its own @types/pg,
  // which structurally conflicts with the project-level pg types.
  const adapter: any = new PrismaPg(pool as any);
  const prisma = new PrismaClient({ adapter });
  return { prisma, pool };
}

export async function seedSandbox(): Promise<void> {
  const { prisma } = createSandboxPrismaClient();
  try {
    // --- Organization + User -------------------------------------------------
    await prisma.organization.upsert({
      where: { id: 'itest-org' },
      update: {},
      create: {
        id: 'itest-org',
        name: 'Integration Test Org',
        slug: 'itest-org',
        plan: 'free',
        status: 'active',
      },
    });

    await prisma.user.upsert({
      where: { id: 'itest-user' },
      update: { organizationId: 'itest-org' },
      create: {
        id: 'itest-user',
        email: 'itest-user@synthex.test',
        name: 'Integration Test User',
        organizationId: 'itest-org',
      },
    });

    // --- Brand layer (1:1 with the org) --------------------------------------
    await prisma.brandOperatingSystem.upsert({
      where: { id: 'itest-bos' },
      update: {},
      create: {
        id: 'itest-bos',
        organizationId: 'itest-org',
        method: 'itest-method',
        qualityThreshold: 80,
      },
    });

    await prisma.clientProfile.upsert({
      where: { id: 'itest-client-profile' },
      update: {},
      create: {
        id: 'itest-client-profile',
        organizationId: 'itest-org',
        budgetTier: 'mid',
        intakeStatus: 'complete',
      },
    });

    await prisma.brandDNA.upsert({
      where: { id: 'itest-brand-dna' },
      update: {},
      create: {
        id: 'itest-brand-dna',
        organizationId: 'itest-org',
        businessName: 'Integration Test Co',
        vertical: 'other',
        industry: 'testing',
        sourceUrl: 'https://sandbox.invalid/itest',
      },
    });

    // --- Marketing agency graph ----------------------------------------------
    await prisma.marketingAgencyCampaign.upsert({
      where: { id: 'itest-campaign' },
      update: {},
      create: {
        id: 'itest-campaign',
        organizationId: 'itest-org',
        createdById: 'itest-user',
        name: 'Integration Test Campaign',
        slug: 'itest-campaign',
        status: 'draft',
        providerMode: 'mock',
        productName: 'Integration Test Product',
        primaryOffer: 'Integration Test Offer',
      },
    });

    await prisma.marketingAgencySourceRef.upsert({
      where: { id: 'itest-source-ref' },
      update: {},
      create: {
        id: 'itest-source-ref',
        organizationId: 'itest-org',
        createdById: 'itest-user',
        campaignId: 'itest-campaign',
        label: 'Integration Test Source',
        url: 'https://sandbox.invalid/itest-source',
        sourceType: 'document',
        requiredForClaims: true,
      },
    });

    await prisma.marketingAgencyClaim.upsert({
      where: { id: 'itest-claim' },
      update: { evidenceStatus: 'blocked' },
      create: {
        id: 'itest-claim',
        organizationId: 'itest-org',
        createdById: 'itest-user',
        campaignId: 'itest-campaign',
        sourceRefId: 'itest-source-ref',
        statement: 'Integration test claim — evidence pending.',
        claimType: 'capability',
        evidenceStatus: 'blocked',
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}
