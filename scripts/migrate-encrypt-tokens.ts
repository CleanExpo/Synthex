#!/usr/bin/env tsx
/**
 * Migration Script: Encrypt Existing Tokens
 *
 * Encrypts all existing plaintext OAuth tokens and API keys in the database.
 * Run this ONCE after deploying field-level encryption.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - FIELD_ENCRYPTION_KEY: 32-byte hex key (CRITICAL)
 *
 * Usage:
 *   npx tsx scripts/migrate-encrypt-tokens.ts
 *   # or with dry-run (no changes made):
 *   npx tsx scripts/migrate-encrypt-tokens.ts --dry-run
 *
 * IMPORTANT:
 * - Back up your database before running this script
 * - Run this script only ONCE
 * - This script is idempotent (already encrypted values are skipped)
 */

import { PrismaClient } from '@prisma/client';
import {
  encryptField,
  isEncrypted,
  validateEncryptionConfig,
} from '../lib/security/field-encryption';

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

interface MigrationStats {
  accounts: { total: number; encrypted: number; skipped: number; errors: number };
  platformConnections: { total: number; encrypted: number; skipped: number; errors: number };
  users: { total: number; encrypted: number; skipped: number; errors: number };
}

async function migrateAccounts(stats: MigrationStats): Promise<void> {
  console.log('\n📦 Migrating Account tokens...');

  const accounts = await prisma.account.findMany({
    select: {
      id: true,
      accessToken: true,
      refreshToken: true,
      idToken: true,
    },
  });

  stats.accounts.total = accounts.length;

  for (const account of accounts) {
    try {
      const updates: Record<string, string | null> = {};
      let needsUpdate = false;

      // Check and encrypt accessToken
      if (account.accessToken && !isEncrypted(account.accessToken)) {
        updates.accessToken = encryptField(account.accessToken);
        needsUpdate = true;
      }

      // Check and encrypt refreshToken
      if (account.refreshToken && !isEncrypted(account.refreshToken)) {
        updates.refreshToken = encryptField(account.refreshToken);
        needsUpdate = true;
      }

      // Check and encrypt idToken
      if (account.idToken && !isEncrypted(account.idToken)) {
        updates.idToken = encryptField(account.idToken);
        needsUpdate = true;
      }

      if (needsUpdate) {
        if (!isDryRun) {
          await prisma.account.update({
            where: { id: account.id },
            data: updates,
          });
        }
        stats.accounts.encrypted++;
        console.log(`  ✅ Encrypted Account ${account.id}`);
      } else {
        stats.accounts.skipped++;
      }
    } catch (error) {
      stats.accounts.errors++;
      console.error(`  ❌ Failed to encrypt Account ${account.id}:`, error);
    }
  }
}

async function migratePlatformConnections(stats: MigrationStats): Promise<void> {
  console.log('\n📦 Migrating PlatformConnection tokens...');

  const connections = await prisma.platformConnection.findMany({
    select: {
      id: true,
      accessToken: true,
      refreshToken: true,
    },
  });

  stats.platformConnections.total = connections.length;

  for (const connection of connections) {
    try {
      const updates: Record<string, string | null> = {};
      let needsUpdate = false;

      // Check and encrypt accessToken
      if (connection.accessToken && !isEncrypted(connection.accessToken)) {
        updates.accessToken = encryptField(connection.accessToken);
        needsUpdate = true;
      }

      // Check and encrypt refreshToken
      if (connection.refreshToken && !isEncrypted(connection.refreshToken)) {
        updates.refreshToken = encryptField(connection.refreshToken);
        needsUpdate = true;
      }

      if (needsUpdate) {
        if (!isDryRun) {
          await prisma.platformConnection.update({
            where: { id: connection.id },
            data: updates,
          });
        }
        stats.platformConnections.encrypted++;
        console.log(`  ✅ Encrypted PlatformConnection ${connection.id}`);
      } else {
        stats.platformConnections.skipped++;
      }
    } catch (error) {
      stats.platformConnections.errors++;
      console.error(`  ❌ Failed to encrypt PlatformConnection ${connection.id}:`, error);
    }
  }
}

async function migrateUserApiKeys(stats: MigrationStats): Promise<void> {
  console.log('\n📦 Migrating User API keys...');

  const users = await prisma.user.findMany({
    select: {
      id: true,
      openrouterApiKey: true,
      anthropicApiKey: true,
    },
  });

  stats.users.total = users.length;

  for (const user of users) {
    try {
      const updates: Record<string, string | null> = {};
      let needsUpdate = false;

      // Check and encrypt openrouterApiKey
      if (user.openrouterApiKey && !isEncrypted(user.openrouterApiKey)) {
        updates.openrouterApiKey = encryptField(user.openrouterApiKey);
        needsUpdate = true;
      }

      // Check and encrypt anthropicApiKey
      if (user.anthropicApiKey && !isEncrypted(user.anthropicApiKey)) {
        updates.anthropicApiKey = encryptField(user.anthropicApiKey);
        needsUpdate = true;
      }

      if (needsUpdate) {
        if (!isDryRun) {
          await prisma.user.update({
            where: { id: user.id },
            data: updates,
          });
        }
        stats.users.encrypted++;
        console.log(`  ✅ Encrypted User ${user.id} API keys`);
      } else {
        stats.users.skipped++;
      }
    } catch (error) {
      stats.users.errors++;
      console.error(`  ❌ Failed to encrypt User ${user.id} API keys:`, error);
    }
  }
}

async function main(): Promise<void> {
  console.log('🔐 Token Encryption Migration');
  console.log('=============================');

  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  // Validate encryption configuration
  console.log('Validating encryption configuration...');
  const validation = validateEncryptionConfig();

  if (!validation.valid) {
    console.error('❌ Encryption configuration invalid:', validation.error);
    console.error('\nPlease ensure FIELD_ENCRYPTION_KEY is set correctly.');
    console.error('Generate a key with: openssl rand -hex 32');
    process.exit(1);
  }

  console.log('✅ Encryption configuration valid\n');

  const stats: MigrationStats = {
    accounts: { total: 0, encrypted: 0, skipped: 0, errors: 0 },
    platformConnections: { total: 0, encrypted: 0, skipped: 0, errors: 0 },
    users: { total: 0, encrypted: 0, skipped: 0, errors: 0 },
  };

  try {
    // Migrate each model
    await migrateAccounts(stats);
    await migratePlatformConnections(stats);
    await migrateUserApiKeys(stats);

    // Print summary
    console.log('\n=============================');
    console.log('📊 Migration Summary');
    console.log('=============================\n');

    console.log('Accounts:');
    console.log(`  Total: ${stats.accounts.total}`);
    console.log(`  Encrypted: ${stats.accounts.encrypted}`);
    console.log(`  Skipped (already encrypted): ${stats.accounts.skipped}`);
    console.log(`  Errors: ${stats.accounts.errors}`);

    console.log('\nPlatformConnections:');
    console.log(`  Total: ${stats.platformConnections.total}`);
    console.log(`  Encrypted: ${stats.platformConnections.encrypted}`);
    console.log(`  Skipped (already encrypted): ${stats.platformConnections.skipped}`);
    console.log(`  Errors: ${stats.platformConnections.errors}`);

    console.log('\nUsers (API Keys):');
    console.log(`  Total: ${stats.users.total}`);
    console.log(`  Encrypted: ${stats.users.encrypted}`);
    console.log(`  Skipped (already encrypted/empty): ${stats.users.skipped}`);
    console.log(`  Errors: ${stats.users.errors}`);

    const totalEncrypted =
      stats.accounts.encrypted +
      stats.platformConnections.encrypted +
      stats.users.encrypted;

    const totalErrors =
      stats.accounts.errors +
      stats.platformConnections.errors +
      stats.users.errors;

    console.log('\n=============================');
    if (isDryRun) {
      console.log(`✨ Would encrypt ${totalEncrypted} records (dry run)`);
    } else if (totalErrors === 0) {
      console.log(`✅ Successfully encrypted ${totalEncrypted} records`);
    } else {
      console.log(`⚠️  Encrypted ${totalEncrypted} records with ${totalErrors} errors`);
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
