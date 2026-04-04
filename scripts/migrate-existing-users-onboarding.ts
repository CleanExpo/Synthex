/**
 * Data Migration: Set existing users as onboarding complete
 *
 * This ensures existing users are NOT redirected to the onboarding wizard.
 * Only new users (created after this migration) will go through onboarding.
 *
 * Run with: npx tsx scripts/migrate-existing-users-onboarding.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Migrating existing users: setting onboardingComplete = true...\n');

  // Count users first
  const totalUsers = await prisma.user.count();
  const alreadyComplete = await prisma.user.count({
    where: { onboardingComplete: true },
  });
  const needsUpdate = totalUsers - alreadyComplete;

  console.log(`  Total users:      ${totalUsers}`);
  console.log(`  Already complete:  ${alreadyComplete}`);
  console.log(`  Needs update:      ${needsUpdate}\n`);

  if (needsUpdate === 0) {
    console.log('✅ No users need updating. All done!');
    return;
  }

  // Update all users who haven't completed onboarding
  const result = await prisma.user.updateMany({
    where: { onboardingComplete: false },
    data: {
      onboardingComplete: true,
      onboardingStep: 4, // All steps done
      businessProfileComplete: true,
    },
  });

  console.log(`✅ Updated ${result.count} users to onboardingComplete = true`);

  // Also set apiKeyConfigured = true for users who have active credentials
  const usersWithKeys = await prisma.$queryRaw<{ user_id: string }[]>`
    SELECT DISTINCT "user_id" FROM "api_credentials"
    WHERE "is_active" = true AND "is_valid" = true AND "revoked_at" IS NULL
  `.catch(() => {
    console.log('  ℹ️  api_credentials table not found — skipping apiKeyConfigured update');
    return [] as { user_id: string }[];
  });

  if (usersWithKeys.length > 0) {
    const userIds = usersWithKeys.map((r) => r.user_id);
    const keyResult = await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { apiKeyConfigured: true },
    });
    console.log(`✅ Set apiKeyConfigured = true for ${keyResult.count} users with valid keys`);
  }

  console.log('\n🎉 Migration complete!');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
