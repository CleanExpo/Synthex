/**
 * BrandPreset CRUD — sandbox integration proof (SYN-40).
 *
 * Proves against the LIVE Docker sandbox DB (:5499, schema materialised by
 * the integration profile's `prisma db push`):
 *
 *   - the new brand_presets table accepts real writes (model shape is sound),
 *   - many presets per org (non-unique organizationId FK),
 *   - the tenant-filtered read invariant the routes rely on: a lookup with
 *     the WRONG organizationId returns null (cross-org read = 404 upstream),
 *   - update + delete round-trip,
 *   - BrandDNA-seeded default (seedBrandPresetFromDna against the seeded
 *     itest-brand-dna row) persists and passes validation,
 *   - ON DELETE CASCADE from Organization.
 *
 * ZERO NETWORK beyond the sandbox Postgres (guarded by global-setup).
 * The route handlers themselves are unit-proven (brand-presets-routes.test.ts);
 * they use the Supabase-tuned prisma singleton which cannot connect to the
 * local sandbox, so this suite exercises the same queries via the sandbox
 * client — the repo's established integration idiom.
 */
import type { PrismaClient } from '@prisma/client';
import type { Pool } from 'pg';
import { createSandboxPrismaClient } from './setup/seed';
import {
  seedBrandPresetFromDna,
  validateBrandStyle,
} from '@/lib/marketing-agency/brand-style';

const ORG_A = 'itest-org'; // seeded by global-setup
const ORG_B = 'itest-org-brandpresets-b'; // scratch org for cross-org + cascade

describe('BrandPreset CRUD (sandbox)', () => {
  let prisma: PrismaClient;
  let pool: Pool;

  beforeAll(async () => {
    ({ prisma, pool } = createSandboxPrismaClient());
    await prisma.organization.upsert({
      where: { id: ORG_B },
      update: {},
      create: {
        id: ORG_B,
        name: 'Brand Presets Cross-Org',
        slug: ORG_B,
        plan: 'free',
        status: 'active',
      },
    });
    await prisma.brandPreset.deleteMany({
      where: { organizationId: { in: [ORG_A, ORG_B] } },
    });
  });

  afterAll(async () => {
    await prisma.brandPreset.deleteMany({
      where: { organizationId: { in: [ORG_A, ORG_B] } },
    });
    await prisma.organization.deleteMany({ where: { id: ORG_B } });
    await prisma.$disconnect();
    await pool.end();
  });

  test('create → read → update → delete round-trip; many presets per org', async () => {
    const first = await prisma.brandPreset.create({
      data: {
        organizationId: ORG_A,
        name: 'Integration preset 1',
        primaryColor: '#112233',
        font: 'inter',
        ctaText: 'Book now',
      },
    });
    const second = await prisma.brandPreset.create({
      data: {
        organizationId: ORG_A,
        name: 'Integration preset 2',
        primaryColor: '#445566',
        secondaryColor: '#ffffff',
        font: 'poppins',
      },
    });
    expect(first.id).not.toBe(second.id); // non-unique org FK: 2 rows, same org

    const listed = await prisma.brandPreset.findMany({
      where: { organizationId: ORG_A },
      orderBy: { createdAt: 'asc' },
    });
    expect(listed.map(p => p.name)).toEqual([
      'Integration preset 1',
      'Integration preset 2',
    ]);

    const updated = await prisma.brandPreset.update({
      where: { id: first.id },
      data: { primaryColor: '#654321' },
    });
    expect(updated.primaryColor).toBe('#654321');

    await prisma.brandPreset.delete({ where: { id: second.id } });
    const remaining = await prisma.brandPreset.findMany({
      where: { organizationId: ORG_A },
    });
    expect(remaining).toHaveLength(1);
  });

  test('tenant-filtered lookup: wrong organizationId → null (cross-org 404 invariant)', async () => {
    const own = await prisma.brandPreset.create({
      data: {
        organizationId: ORG_B,
        name: 'Org B preset',
        primaryColor: '#0a0b0c',
        font: 'lato',
      },
    });

    // The exact query shape the [id] route runs for org A against org B's row.
    const crossOrg = await prisma.brandPreset.findFirst({
      where: { id: own.id, organizationId: ORG_A },
    });
    expect(crossOrg).toBeNull();

    const sameOrg = await prisma.brandPreset.findFirst({
      where: { id: own.id, organizationId: ORG_B },
    });
    expect(sameOrg?.id).toBe(own.id);
  });

  test('BrandDNA-seeded default persists and passes validation (seeded itest-brand-dna)', async () => {
    const dna = await prisma.brandDNA.findUnique({
      where: { organizationId: ORG_A },
      select: {
        businessName: true,
        primaryColour: true,
        secondaryColour: true,
        neutralColour: true,
        logoUrl: true,
      },
    });
    expect(dna).not.toBeNull(); // fixture guaranteed by global-setup seed

    const seed = seedBrandPresetFromDna(dna);
    expect(validateBrandStyle(seed).ok).toBe(true);

    const created = await prisma.brandPreset.create({
      data: { organizationId: ORG_A, ...seed },
    });
    expect(created.isDefault).toBe(true);
    expect(created.font).toBe('inter');
  });

  test('ON DELETE CASCADE: deleting the org removes its presets', async () => {
    const before = await prisma.brandPreset.count({
      where: { organizationId: ORG_B },
    });
    expect(before).toBeGreaterThan(0);

    await prisma.organization.delete({ where: { id: ORG_B } });

    const after = await prisma.brandPreset.count({
      where: { organizationId: ORG_B },
    });
    expect(after).toBe(0);
  });
});
