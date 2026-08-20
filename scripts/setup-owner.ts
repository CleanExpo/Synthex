/**
 * One-time script: Set up owner/admin account with full enterprise access
 *
 * Promotes phill.mcgurk@gmail.com to superadmin with custom (unlimited) plan,
 * multi-business ownership, and resets onboarding so the new AI flow triggers.
 *
 * Usage: npx tsx scripts/setup-owner.ts
 *
 * Requires: DATABASE_URL in .env
 */

import { prisma } from '@/lib/prisma';
import { config } from 'dotenv';

config({ path: '.env' });
config({ path: '.env.local', override: true });

const OWNER_EMAIL = 'phill.mcgurk@gmail.com';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ Missing DATABASE_URL');
    process.exit(1);
  }

  console.log(`\n🔧 Setting up owner account: ${OWNER_EMAIL}\n`);

  const user = await prisma.user.findUnique({
    where: { email: OWNER_EMAIL },
    select: { id: true, email: true, name: true, preferences: true },
  });

  if (!user) {
    console.error('❌ User not found: No user with that email');
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.name || user.email} (${user.id})`);

  const currentPrefs = (user.preferences as Record<string, unknown>) || {};
  await prisma.user.update({
    where: { id: user.id },
    data: {
      preferences: {
        ...currentPrefs,
        role: 'superadmin',
        status: 'active',
      },
      isMultiBusinessOwner: true,
    },
  });
  console.log('✅ Set role: superadmin');
  console.log('✅ Set isMultiBusinessOwner: true');

  const now = new Date();
  const tenYearsFromNow = new Date(now);
  tenYearsFromNow.setFullYear(tenYearsFromNow.getFullYear() + 10);

  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: {
      plan: 'scale',
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: tenYearsFromNow,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      maxSocialAccounts: -1,
      maxAiPosts: -1,
      maxPersonas: -1,
    },
    create: {
      userId: user.id,
      plan: 'scale',
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: tenYearsFromNow,
      cancelAtPeriodEnd: false,
      maxSocialAccounts: -1,
      maxAiPosts: -1,
      maxPersonas: -1,
    },
  });
  console.log('✅ Upserted subscription: custom (unlimited) — 10-year term');

  try {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'owner_setup',
        resource: 'user',
        resourceId: user.id,
        details: {
          promoted_to: 'superadmin',
          subscription_plan: 'scale',
          multi_business_owner: true,
        },
        severity: 'high',
        category: 'admin',
        outcome: 'success',
      },
    });
    console.log('✅ Created audit log');
  } catch (auditError) {
    console.warn(
      '⚠️  Could not create audit log:',
      auditError instanceof Error ? auditError.message : auditError
    );
  }

  console.log(`\n🎉 Setup complete!\n`);
  console.log(`   User: ${user.name || user.email}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Role: superadmin`);
  console.log(`   Multi-Business: enabled`);
  console.log(`   Subscription: custom (unlimited)\n`);
}

main()
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
