// SYN-847 follow-up: register the 5 brand orgs as BusinessOwnership rows
// for Phill, so they appear in the existing BusinessSwitcher + AllBusinessesDashboard.
//
// Synthex's canonical multi-tenant pattern is BusinessOwnership (join table),
// not the parentOrgId I added in PR #144. Both can coexist: parentOrgId is
// the architectural "in this workspace" relationship; BusinessOwnership is
// the operational "this user owns this business" relationship that the
// existing UI reads.
//
// Run once: npx tsx --env-file=.env scripts/register-brand-ownerships.ts

import { prisma } from '../lib/prisma';

const OWNER_EMAIL =
  process.env.UNITE_GROUP_OWNER_EMAIL ?? 'phill.mcgurk@gmail.com';

const BRAND_SLUGS = [
  'unite-group', // parent — registered as ownable too so it's switchable
  'disaster-recovery',
  'nrpg',
  'restoreassist',
  'carsi',
];

async function main() {
  const owner = await prisma.user.findUnique({
    where: { email: OWNER_EMAIL },
    select: {
      id: true,
      email: true,
      isMultiBusinessOwner: true,
    },
  });
  if (!owner) {
    console.error(`FATAL: User ${OWNER_EMAIL} not found.`);
    process.exit(1);
  }
  console.log(
    `Owner: ${owner.email}  isMultiBusinessOwner=${owner.isMultiBusinessOwner}`
  );

  // Defensively ensure flag is true (defaults true per schema, but doesn't hurt)
  if (!owner.isMultiBusinessOwner) {
    await prisma.user.update({
      where: { id: owner.id },
      data: { isMultiBusinessOwner: true },
    });
    console.log('  ✓ Flipped isMultiBusinessOwner = true');
  }

  const orgs = await prisma.organization.findMany({
    where: { slug: { in: BRAND_SLUGS } },
    select: { id: true, slug: true, name: true },
  });
  console.log(`Found ${orgs.length}/${BRAND_SLUGS.length} brand orgs`);

  for (const org of orgs) {
    const result = await prisma.businessOwnership.upsert({
      where: {
        ownerId_organizationId: {
          ownerId: owner.id,
          organizationId: org.id,
        },
      },
      create: {
        ownerId: owner.id,
        organizationId: org.id,
        displayName: org.name,
        isActive: true,
        billingStatus: 'active',
        monthlyRate: 0, // internal portfolio — no billing
      },
      update: {
        displayName: org.name,
        isActive: true,
        // Don't touch billingStatus / monthlyRate on update — owner may have
        // configured them differently for existing pre-seed data
      },
      select: { id: true, displayName: true, isActive: true },
    });
    console.log(
      `  ✓ ${org.slug.padEnd(20)} ownership=${result.id}  active=${result.isActive}`
    );
  }

  // Verify
  console.log('\n─── Verification ──────────────────────────────────────');
  const ownerships = await prisma.businessOwnership.findMany({
    where: { ownerId: owner.id, isActive: true },
    select: {
      organization: { select: { slug: true, name: true } },
      displayName: true,
      monthlyRate: true,
    },
    orderBy: { organization: { slug: 'asc' } },
  });
  console.log(`Phill's active BusinessOwnerships: ${ownerships.length}`);
  for (const o of ownerships) {
    console.log(
      `  ${o.organization.slug.padEnd(20)} ${o.displayName ?? o.organization.name}  rate=$${o.monthlyRate}/mo`
    );
  }

  console.log(
    '\n✅ Done. Sign in to https://synthex.social/dashboard — BusinessSwitcher will show all 6 entries.'
  );
}

main()
  .catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
