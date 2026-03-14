/**
 * Admin API: Vault Credential Importer — Confirm & Bulk Create
 *
 * POST /api/admin/vault/import-doc/confirm
 *
 * Receives user-reviewed credential entries and bulk-creates them as vault secrets.
 * Each credential pair is stored as a single 'custom' secret with category metadata.
 *
 * OWNER-ONLY. Called only after user reviews and approves the preview table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isOwnerEmail } from '@/lib/auth/jwt-utils';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';
import { logger } from '@/lib/logger';
import { VaultService, slugify } from '@/lib/vault';
import type { VaultActor } from '@/lib/vault';
import { z } from 'zod';
import type { CredentialCategory } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// Validation
// =============================================================================

const CredentialEntrySchema = z.object({
  service: z.string().min(1).max(200),
  url: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  password: z.string().min(1),
  category: z.enum([
    'social_media',
    'email',
    'hosting',
    'domain',
    'banking',
    'ecommerce',
    'crm',
    'analytics',
    'api_key',
    'vpn',
    'other',
  ]),
});

const ConfirmImportSchema = z.object({
  organizationId: z.string().min(1, 'Organisation ID required'),
  entries: z.array(CredentialEntrySchema).min(1).max(200),
});

// =============================================================================
// Owner Auth Helper
// =============================================================================

async function requireOwner(
  request: NextRequest
): Promise<{ userId: string; ipAddress: string; userAgent: string } | { error: NextResponse }> {
  const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_READ);
  if (!security.allowed) {
    return { error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) };
  }
  const userId = security.context.userId!;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user || !isOwnerEmail(user.email)) {
    return { error: NextResponse.json({ error: 'Owner access required' }, { status: 403 }) };
  }
  return {
    userId,
    ipAddress: request.headers.get('x-forwarded-for') ?? 'unknown',
    userAgent: request.headers.get('user-agent') ?? 'unknown',
  };
}

// =============================================================================
// Category → Provider mapping (best-effort)
// =============================================================================

const CATEGORY_PROVIDER_MAP: Record<CredentialCategory, string | undefined> = {
  social_media: 'custom',
  email: 'custom',
  hosting: 'custom',
  domain: 'custom',
  banking: 'custom',
  ecommerce: 'custom',
  crm: 'custom',
  analytics: 'custom',
  api_key: 'custom',
  vpn: 'custom',
  other: 'custom',
};

// Attempt to match known providers from service name
const SERVICE_PROVIDER_MAP: Array<{ pattern: RegExp; provider: string }> = [
  { pattern: /facebook/i, provider: 'facebook' },
  { pattern: /instagram/i, provider: 'instagram' },
  { pattern: /twitter|x\.com/i, provider: 'twitter' },
  { pattern: /linkedin/i, provider: 'linkedin' },
  { pattern: /tiktok/i, provider: 'tiktok' },
  { pattern: /youtube/i, provider: 'youtube' },
  { pattern: /pinterest/i, provider: 'pinterest' },
  { pattern: /reddit/i, provider: 'reddit' },
  { pattern: /threads/i, provider: 'threads' },
  { pattern: /google/i, provider: 'google' },
  { pattern: /stripe/i, provider: 'stripe' },
  { pattern: /openai/i, provider: 'openai' },
  { pattern: /anthropic/i, provider: 'anthropic' },
  { pattern: /openrouter/i, provider: 'openrouter' },
];

function resolveProvider(serviceName: string): string {
  for (const { pattern, provider } of SERVICE_PROVIDER_MAP) {
    if (pattern.test(serviceName)) return provider;
  }
  return 'custom';
}

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(request: NextRequest) {
  const auth = await requireOwner(request);
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validation = ConfirmImportSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: validation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { organizationId, entries } = validation.data;

  // Verify the org exists and the user owns it
  const ownership = await prisma.businessOwnership.findFirst({
    where: { ownerId: auth.userId, organizationId, isActive: true },
  });
  // Also allow if it's the user's own primary org
  const userOrg = await prisma.user.findFirst({
    where: { id: auth.userId, organizationId },
    select: { id: true },
  });

  if (!ownership && !userOrg) {
    return NextResponse.json({ error: 'Organisation not found or access denied' }, { status: 403 });
  }

  const actor: VaultActor = {
    id: auth.userId,
    type: 'user',
    ipAddress: auth.ipAddress,
    userAgent: auth.userAgent,
  };

  const results = { created: 0, skipped: 0, errors: [] as string[] };

  for (const entry of entries) {
    try {
      const provider = resolveProvider(entry.service);
      const baseSlug = slugify(`${entry.service}-credentials`);

      // Make slug unique by appending index if collision
      let slug = baseSlug;
      let attempt = 1;
      while (true) {
        const existing = await prisma.vaultSecret.findUnique({
          where: { organizationId_slug: { organizationId, slug } },
        });
        if (!existing || !existing.isActive) break;
        slug = `${baseSlug}-${attempt++}`;
        if (attempt > 99) {
          results.skipped++;
          results.errors.push(`Skipped "${entry.service}": too many duplicates`);
          break;
        }
      }
      if (attempt > 99) continue;

      // Store credentials as JSON value: { username, password, url }
      const secretValue = JSON.stringify({
        username: entry.username ?? '',
        password: entry.password,
        url: entry.url ?? '',
        importedAt: new Date().toISOString(),
      });

      const prepared = VaultService.prepareSecret(secretValue);
      if (!prepared) {
        results.errors.push(`Failed to encrypt "${entry.service}"`);
        results.skipped++;
        continue;
      }

      await VaultService.createSecret(
        {
          organizationId,
          name: `${entry.service} — Login Credentials`,
          slug,
          description: `Imported credentials${entry.url ? ` for ${entry.url}` : ''}${entry.username ? ` (${entry.username})` : ''}`,
          secretType: 'custom',
          provider: provider as string,
          encryptedValue: prepared.encrypted,
          maskedValue: prepared.masked,
          isRotatable: true,
          source: 'migration',
          createdBy: auth.userId,
        },
        actor
      );

      results.created++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[Vault Import Confirm] Entry failed', { service: entry.service, error: msg });
      results.errors.push(`"${entry.service}": ${msg.slice(0, 100)}`);
      results.skipped++;
    }
  }

  logger.info('[Vault Import] Bulk import complete', {
    userId: auth.userId,
    organizationId,
    created: results.created,
    skipped: results.skipped,
  });

  return NextResponse.json(results);
}
