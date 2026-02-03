/**
 * OAuth Account Migration Script
 *
 * Migrates existing users with googleId to the new Account model.
 * This script should be run once after deploying the Account model.
 *
 * Usage:
 *   npx tsx scripts/migrate-oauth-accounts.ts
 *   npx tsx scripts/migrate-oauth-accounts.ts --dry-run
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 *
 * SAFETY:
 * - Run with --dry-run first to preview changes
 * - Creates Account records without deleting googleId (safe)
 * - Idempotent: can be run multiple times safely
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MigrationResult {
  totalUsers: number;
  usersWithGoogleId: number;
  alreadyMigrated: number;
  migrated: number;
  errors: Array<{ userId: string; email: string; error: string }>;
}

async function migrateOAuthAccounts(dryRun: boolean): Promise<MigrationResult> {
  console.log('\n========================================');
  console.log('OAuth Account Migration Script');
  console.log('========================================\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  const result: MigrationResult = {
    totalUsers: 0,
    usersWithGoogleId: 0,
    alreadyMigrated: 0,
    migrated: 0,
    errors: [],
  };

  try {
    // Count total users
    result.totalUsers = await prisma.user.count();
    console.log(`📊 Total users in database: ${result.totalUsers}`);

    // Find users with googleId
    const usersWithGoogle = await prisma.user.findMany({
      where: {
        googleId: { not: null },
      },
      select: {
        id: true,
        email: true,
        googleId: true,
        createdAt: true,
      },
    });

    result.usersWithGoogleId = usersWithGoogle.length;
    console.log(`🔑 Users with Google ID: ${result.usersWithGoogleId}`);

    if (usersWithGoogle.length === 0) {
      console.log('\n✅ No users to migrate. All done!\n');
      return result;
    }

    console.log('\n📋 Processing users...\n');

    for (const user of usersWithGoogle) {
      try {
        // Check if Account already exists
        const existingAccount = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: 'google',
              providerAccountId: user.googleId!,
            },
          },
        });

        if (existingAccount) {
          console.log(`  ⏭️  ${user.email} - Already migrated`);
          result.alreadyMigrated++;
          continue;
        }

        if (dryRun) {
          console.log(`  📝 ${user.email} - Would create Account record`);
          result.migrated++;
          continue;
        }

        // Create Account record
        await prisma.account.create({
          data: {
            userId: user.id,
            type: 'oauth',
            provider: 'google',
            providerAccountId: user.googleId!,
            createdAt: user.createdAt, // Preserve original link date
          },
        });

        console.log(`  ✅ ${user.email} - Migrated successfully`);
        result.migrated++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`  ❌ ${user.email} - Error: ${errorMessage}`);
        result.errors.push({
          userId: user.id,
          email: user.email,
          error: errorMessage,
        });
      }
    }

    // Also create email Account records for users with passwords
    console.log('\n📋 Creating email Account records for users with passwords...\n');

    const usersWithPasswords = await prisma.user.findMany({
      where: {
        password: { not: null },
        NOT: { password: '' },
        NOT: { password: '!' }, // Skip placeholder passwords
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    console.log(`🔐 Users with passwords: ${usersWithPasswords.length}`);

    for (const user of usersWithPasswords) {
      try {
        // Check if email Account already exists
        const existingAccount = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: 'email',
              providerAccountId: user.email,
            },
          },
        });

        if (existingAccount) {
          continue; // Already has email account record
        }

        if (dryRun) {
          console.log(`  📝 ${user.email} - Would create email Account record`);
          continue;
        }

        await prisma.account.create({
          data: {
            userId: user.id,
            type: 'credentials',
            provider: 'email',
            providerAccountId: user.email,
            createdAt: user.createdAt,
          },
        });

        console.log(`  ✅ ${user.email} - Email Account created`);
      } catch (error) {
        // Ignore errors for email accounts (non-critical)
        console.log(`  ⚠️  ${user.email} - Skipped email account (non-critical)`);
      }
    }

    return result;
  } finally {
    await prisma.$disconnect();
  }
}

function printSummary(result: MigrationResult, dryRun: boolean) {
  console.log('\n========================================');
  console.log('Migration Summary');
  console.log('========================================\n');

  console.log(`Total users:        ${result.totalUsers}`);
  console.log(`With Google ID:     ${result.usersWithGoogleId}`);
  console.log(`Already migrated:   ${result.alreadyMigrated}`);
  console.log(`${dryRun ? 'Would migrate' : 'Migrated'}:       ${result.migrated}`);
  console.log(`Errors:             ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.log('\n⚠️  Errors:');
    for (const error of result.errors) {
      console.log(`  - ${error.email}: ${error.error}`);
    }
  }

  console.log('\n');

  if (dryRun && result.migrated > 0) {
    console.log('💡 Run without --dry-run to perform the migration\n');
  }
}

// Main execution
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-d');

migrateOAuthAccounts(dryRun)
  .then((result) => {
    printSummary(result, dryRun);
    process.exit(result.errors.length > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
