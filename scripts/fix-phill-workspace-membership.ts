// SYN-847 hotfix: connect Phill to all workspace orgs via TeamMember
// (true multi-org membership) and set his primary org to unite-group.
//
// Run once: npx tsx --env-file=.env scripts/fix-phill-workspace-membership.ts

import { prisma } from '../lib/prisma';

const OWNER_EMAIL =
  process.env.UNITE_GROUP_OWNER_EMAIL ?? 'phill.mcgurk@gmail.com';

const WORKSPACE_SLUGS = [
  'unite-group', // parent (sets master admin)
  'disaster-recovery',
  'nrpg',
  'restoreassist',
  'carsi',
];

async function main() {
  const owner = await prisma.user.findUnique({
    where: { email: OWNER_EMAIL },
    select: { id: true, email: true, organizationId: true },
  });
  if (!owner) {
    console.error(`FATAL: User ${OWNER_EMAIL} not found.`);
    process.exit(1);
  }
  console.log(
    `Owner: ${owner.email} (id ${owner.id}, primary org ${owner.organizationId ?? 'NONE'})`
  );

  const orgs = await prisma.organization.findMany({
    where: { slug: { in: WORKSPACE_SLUGS } },
    select: { id: true, slug: true },
  });
  console.log(`Found ${orgs.length}/${WORKSPACE_SLUGS.length} workspace orgs`);

  const uniteGroup = orgs.find(o => o.slug === 'unite-group');
  if (!uniteGroup) {
    console.error('FATAL: unite-group parent org not found. Run seed first.');
    process.exit(1);
  }

  // 1. Create TeamMember rows for each org (idempotent via @@unique)
  for (const org of orgs) {
    const result = await prisma.teamMember.upsert({
      where: {
        team_member_user_org: { userId: owner.id, organizationId: org.id },
      },
      create: {
        userId: owner.id,
        organizationId: org.id,
        role: 'owner',
        acceptedAt: new Date(),
      },
      update: {
        role: 'owner',
        acceptedAt: new Date(),
      },
      select: { id: true, role: true },
    });
    console.log(`  ✓ TeamMember ${org.slug.padEnd(20)} role=${result.role}`);
  }

  // 2. Connect via the direct users[] relation too — required by the
  //    /api/workspaces/[parentSlug] route which checks `parent.users.some(u => u.id === userId)`
  //    User-Organization is 1:N so we can only set ONE primary org via User.organizationId,
  //    BUT the `users` relation on Organization side is the inverse — many users per org.
  //    So adding Phill to multiple orgs' users[] requires updating each org to include him.
  //    Since the FK lives on User, the only way to put a user "in" multiple orgs via that
  //    relation is impossible (User.organizationId is a single nullable FK).
  //    Workaround: set User.organizationId = unite-group.id (master admin via parent membership).
  console.log(
    `\nSetting User.organizationId = unite-group (${uniteGroup.id}) — primary org`
  );
  await prisma.user.update({
    where: { id: owner.id },
    data: {
      organizationId: uniteGroup.id,
      activeOrganizationId: uniteGroup.id,
    },
  });
  console.log('  ✓ Phill is now master admin of unite-group workspace');

  // 3. Verify
  console.log('\n─── Verification ────────────────────────────────');
  const memberOf = await prisma.teamMember.findMany({
    where: { userId: owner.id },
    select: { role: true, organization: { select: { slug: true } } },
    orderBy: { organization: { slug: 'asc' } },
  });
  console.log(`Phill's TeamMember rows: ${memberOf.length}`);
  for (const m of memberOf) {
    console.log(`  ${m.organization.slug.padEnd(20)} role=${m.role}`);
  }

  const refreshed = await prisma.user.findUnique({
    where: { id: owner.id },
    select: {
      organizationId: true,
      organization: { select: { slug: true } },
    },
  });
  console.log(
    `Primary org: ${refreshed?.organization?.slug ?? 'NONE'} (id ${refreshed?.organizationId ?? 'null'})`
  );

  console.log('\n✅ Done. Visit https://synthex.social/unite-group');
}

main()
  .catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
