/**
 * Vault Onboarding Seeder
 *
 * Runs after onboarding completion to auto-populate the vault with
 * credentials that enable immediate AI capability.
 *
 * THREE MODES:
 *   1. Owner key injection — seed vault from server env vars (owner-only)
 *   2. API credential mirror — copy from APICredential table into vault
 *   3. Platform connection migration — copy OAuth tokens into vault
 *
 * All operations are IDEMPOTENT — existing slugs are skipped.
 * Failures are logged but NEVER block onboarding completion.
 */

import { prisma } from '@/lib/prisma';
import { encryptField } from '@/lib/security/field-encryption';
import { maskApiKey } from '@/lib/encryption/api-key-encryption';
import { decryptApiKey } from '@/lib/encryption/api-key-encryption';
import { isOwnerEmail } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import { VaultService } from './vault-service';
import { slugify, type SecretSource } from './types';
import type { VaultActor } from './types';

// =============================================================================
// Owner Env Var Seeds — platform-level API keys from server environment
// =============================================================================

const OWNER_ENV_SEEDS: Array<{
  envVar: string;
  name: string;
  provider: string;
  secretType: string;
}> = [
  {
    envVar: 'OPENROUTER_API_KEY',
    name: 'OpenRouter API Key',
    provider: 'openrouter',
    secretType: 'api_key',
  },
  {
    envVar: 'OPENAI_API_KEY',
    name: 'OpenAI API Key',
    provider: 'openai',
    secretType: 'api_key',
  },
  {
    envVar: 'ANTHROPIC_API_KEY',
    name: 'Anthropic API Key',
    provider: 'anthropic',
    secretType: 'api_key',
  },
  {
    envVar: 'GOOGLE_AI_API_KEY',
    name: 'Google AI API Key',
    provider: 'google',
    secretType: 'api_key',
  },
];

// =============================================================================
// seedVaultFromOnboarding — main entry point
// =============================================================================

export async function seedVaultFromOnboarding(
  userId: string,
  organizationId: string
): Promise<{ seeded: number; skipped: number; errors: number }> {
  const stats = { seeded: 0, skipped: 0, errors: 0 };

  const actor: VaultActor = { id: userId, type: 'user' };

  // 1. Owner env var injection
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (user?.email && isOwnerEmail(user.email)) {
      for (const seed of OWNER_ENV_SEEDS) {
        const value = process.env[seed.envVar];
        if (!value) continue;

        try {
          const result = await seedIfMissing({
            organizationId,
            name: seed.name,
            slug: slugify(seed.name),
            secretType: seed.secretType,
            provider: seed.provider,
            rawValue: value,
            source: 'onboarding',
            actor,
          });
          if (result === 'created') stats.seeded++;
          else stats.skipped++;
        } catch (err) {
          logger.error('[Vault Seeder] Failed to seed env var', {
            envVar: seed.envVar,
            error: err instanceof Error ? err.message : String(err),
          });
          stats.errors++;
        }
      }
    }
  } catch (err) {
    logger.error('[Vault Seeder] Owner check failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 2. Mirror existing APICredential records
  try {
    const apiCreds = await prisma.aPICredential.findMany({
      where: { userId, organizationId, isActive: true },
      select: { provider: true, encryptedKey: true, maskedKey: true },
    });

    for (const cred of apiCreds) {
      try {
        // Decrypt the APICredential key to re-encrypt with field encryption
        let rawKey: string;
        try {
          rawKey = decryptApiKey(cred.encryptedKey);
        } catch {
          // If decryption fails, skip this credential
          stats.skipped++;
          continue;
        }

        const result = await seedIfMissing({
          organizationId,
          name: `${capitalise(cred.provider)} API Key`,
          slug: `${cred.provider}-api-key`,
          secretType: 'api_key',
          provider: cred.provider,
          rawValue: rawKey,
          source: 'migration',
          actor,
        });
        if (result === 'created') stats.seeded++;
        else stats.skipped++;
      } catch (err) {
        logger.error('[Vault Seeder] Failed to mirror APICredential', {
          provider: cred.provider,
          error: err instanceof Error ? err.message : String(err),
        });
        stats.errors++;
      }
    }
  } catch (err) {
    logger.error('[Vault Seeder] APICredential mirror failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  logger.info('[Vault Seeder] Complete', {
    userId,
    organizationId,
    seeded: stats.seeded,
    skipped: stats.skipped,
    errors: stats.errors,
  });

  return stats;
}

// =============================================================================
// seedSingleCredential — called from api-credentials route after saving
// =============================================================================

export async function seedSingleCredential(params: {
  userId: string;
  organizationId: string;
  provider: string;
  rawApiKey: string;
}): Promise<void> {
  try {
    const actor: VaultActor = { id: params.userId, type: 'user' };

    await seedIfMissing({
      organizationId: params.organizationId,
      name: `${capitalise(params.provider)} API Key`,
      slug: `${params.provider}-api-key`,
      secretType: 'api_key',
      provider: params.provider,
      rawValue: params.rawApiKey,
      source: 'onboarding',
      actor,
    });
  } catch (err) {
    // Non-fatal — the APICredential was already saved
    logger.error('[Vault Seeder] Single credential seed failed', {
      provider: params.provider,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// =============================================================================
// Internal helpers
// =============================================================================

async function seedIfMissing(params: {
  organizationId: string;
  name: string;
  slug: string;
  secretType: string;
  provider: string;
  rawValue: string;
  source: SecretSource;
  actor: VaultActor;
}): Promise<'created' | 'exists'> {
  // Check if slug already exists
  const existing = await prisma.vaultSecret.findUnique({
    where: {
      organizationId_slug: {
        organizationId: params.organizationId,
        slug: params.slug,
      },
    },
    select: { id: true },
  });

  if (existing) return 'exists';

  // Encrypt + mask
  const encrypted = encryptField(params.rawValue);
  if (!encrypted) throw new Error('Encryption failed');
  const masked = maskApiKey(params.rawValue);

  await VaultService.createSecret(
    {
      organizationId: params.organizationId,
      name: params.name,
      slug: params.slug,
      secretType: params.secretType,
      provider: params.provider,
      encryptedValue: encrypted,
      maskedValue: masked,
      isRotatable: true,
      source: params.source,
      createdBy: params.actor.id,
    },
    params.actor
  );

  return 'created';
}

function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
