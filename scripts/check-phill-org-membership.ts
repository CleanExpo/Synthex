// One-off diagnostic: confirm Phill's user + org memberships in production.
// SAFE — read-only queries, no writes.
import { prisma } from '../lib/prisma';

async function main() {
  const u = await prisma.user.findUnique({
    where: { email: 'phill.mcgurk@gmail.com' },
    select: { id: true, email: true, name: true },
  });
  console.log('User lookup:', u);

  if (!u) {
    console.log(
      'No User row for phill.mcgurk@gmail.com — sign in once at synthex.social to create.'
    );
    return;
  }

  const orgs = await prisma.organization.findMany({
    where: { users: { some: { id: u.id } } },
    select: { slug: true, name: true, parentOrgId: true },
    orderBy: { slug: 'asc' },
  });
  console.log(`Orgs Phill is a member of: ${orgs.length}`);
  for (const o of orgs) {
    console.log(`  ${o.slug.padEnd(20)} parent=${o.parentOrgId ?? 'NONE'}`);
  }

  // Also list all the orgs we just seeded so we can compare
  const seeded = await prisma.organization.findMany({
    where: {
      slug: {
        in: [
          'unite-group',
          'disaster-recovery',
          'nrpg',
          'restoreassist',
          'carsi',
        ],
      },
    },
    select: {
      slug: true,
      _count: { select: { users: true } },
      parentOrgId: true,
    },
    orderBy: { slug: 'asc' },
  });
  console.log(`\nSeeded orgs (${seeded.length}/5):`);
  for (const s of seeded) {
    console.log(
      `  ${s.slug.padEnd(20)} users=${s._count.users}  parent=${s.parentOrgId ?? 'NONE'}`
    );
  }
}

main()
  .catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
