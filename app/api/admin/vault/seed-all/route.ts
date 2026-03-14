/**
 * Admin API: Bulk Vault Seeder
 *
 * POST /api/admin/vault/seed-all
 *
 * Seeds platform-level AI provider keys from server environment variables
 * into the vault for ALL organisations that don't already have them.
 *
 * This enables immediate AI capability for every business without manual setup.
 *
 * OWNER-ONLY. Non-destructive — existing slugs are never overwritten.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isOwnerEmail } from '@/lib/auth/jwt-utils';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { encryptField } from '@/lib/security/field-encryption';
import { maskApiKey } from '@/lib/encryption/api-key-encryption';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';
import { logger } from '@/lib/logger';
import { VaultService, slugify } from '@/lib/vault';
import type { VaultActor } from '@/lib/vault';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Platform-level AI keys to seed into every org's vault
const PLATFORM_SEEDS = [
  { envVar: 'OPENROUTER_API_KEY', name: 'OpenRouter API Key', provider: 'openrouter', secretType: 'api_key' },
  { envVar: 'OPENAI_API_KEY', name: 'OpenAI API Key', provider: 'openai', secretType: 'api_key' },
  { envVar: 'ANTHROPIC_API_KEY', name: 'Anthropic API Key', provider: 'anthropic', secretType: 'api_key' },
  { envVar: 'GOOGLE_AI_API_KEY', name: 'Google AI API Key', provider: 'google', secretType: 'api_key' },
  { envVar: 'GOOGLE_GENERATIVE_AI_API_KEY', name: 'Google Generative AI Key', provider: 'google', secretType: 'api_key' },
];

// Build the list of env seeds that are actually available in this environment
function getAvailableSeeds() {
  return PLATFORM_SEEDS.filter((s) => !!process.env[s.envVar]);
}

export async function POST(request: NextRequest) {
  // Auth: owner only
  const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_WRITE);
  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      security.error === 'Authentication required' ? 401 : 403
    );
  }

  const userRecord = await prisma.user.findUnique({
    where: { id: security.context.userId },
    select: { email: true },
  });

  if (!userRecord?.email || !isOwnerEmail(userRecord.email)) {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
  }

  const actor: VaultActor = { id: security.context.userId ?? '', type: 'user' };
  const availableSeeds = getAvailableSeeds();

  if (availableSeeds.length === 0) {
    return NextResponse.json({ error: 'No platform API keys found in server environment' }, { status: 400 });
  }

  // Fetch all active organisations
  const organisations = await prisma.organization.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });

  const results: Array<{
    orgId: string;
    orgName: string;
    seeded: number;
    skipped: number;
    errors: number;
    details: string[];
  }> = [];

  for (const org of organisations) {
    const orgResult = { orgId: org.id, orgName: org.name, seeded: 0, skipped: 0, errors: 0, details: [] as string[] };

    for (const seed of availableSeeds) {
      const rawValue = process.env[seed.envVar]!;
      const slug = slugify(seed.name);

      try {
        // Idempotent: check if slug already exists for this org
        const existing = await prisma.vaultSecret.findUnique({
          where: { organizationId_slug: { organizationId: org.id, slug } },
          select: { id: true },
        });

        if (existing) {
          orgResult.skipped++;
          orgResult.details.push(`⏭ ${seed.name} (already exists)`);
          continue;
        }

        const encrypted = encryptField(rawValue);
        if (!encrypted) throw new Error('Encryption returned null');
        const masked = maskApiKey(rawValue);

        await VaultService.createSecret(
          {
            organizationId: org.id,
            name: seed.name,
            slug,
            secretType: seed.secretType,
            provider: seed.provider,
            encryptedValue: encrypted,
            maskedValue: masked,
            isRotatable: true,
            source: 'onboarding',
            createdBy: actor.id,
          },
          actor
        );

        orgResult.seeded++;
        orgResult.details.push(`✓ ${seed.name}`);
      } catch (err) {
        orgResult.errors++;
        const msg = err instanceof Error ? err.message : String(err);
        orgResult.details.push(`✗ ${seed.name}: ${msg}`);
        logger.error('[VaultSeedAll] Failed to seed key', {
          org: org.name,
          key: seed.envVar,
          error: msg,
        });
      }
    }

    results.push(orgResult);
  }

  const totalSeeded = results.reduce((sum, r) => sum + r.seeded, 0);
  const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

  logger.info('[VaultSeedAll] Bulk seed complete', {
    orgs: organisations.length,
    totalSeeded,
    totalSkipped,
    totalErrors,
  });

  return NextResponse.json({
    success: true,
    summary: {
      organisations: organisations.length,
      keysAvailable: availableSeeds.length,
      totalSeeded,
      totalSkipped,
      totalErrors,
    },
    results,
  });
}

// GET: Preview what would be seeded (dry-run)
export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_READ);
  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      security.error === 'Authentication required' ? 401 : 403
    );
  }

  const userRecord = await prisma.user.findUnique({
    where: { id: security.context.userId },
    select: { email: true },
  });

  if (!userRecord?.email || !isOwnerEmail(userRecord.email)) {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
  }

  const availableSeeds = getAvailableSeeds();
  const orgCount = await prisma.organization.count();
  const existingSecrets = await prisma.vaultSecret.count({ where: { isActive: true } });

  return NextResponse.json({
    availableKeys: availableSeeds.map((s) => ({ name: s.name, provider: s.provider, envVar: s.envVar })),
    organisations: orgCount,
    estimatedNewSecrets: availableSeeds.length * orgCount,
    existingVaultSecrets: existingSecrets,
  });
}
