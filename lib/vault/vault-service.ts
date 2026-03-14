/**
 * Vault Service — Centralised Secrets Management
 *
 * Core service for storing, retrieving, rotating, and auditing encrypted
 * secrets scoped to organisations. Uses AES-256-GCM via field-encryption.ts.
 *
 * DESIGN PRINCIPLES:
 *   - Every operation is audit-logged to VaultAccessLog
 *   - Decrypted values are NEVER returned in logs or error messages
 *   - 5-minute in-memory cache for metadata (not decrypted values)
 *   - Org-scoped — every query filters by organisationId
 *   - Fail-secure — errors deny access, never leak
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { encryptField, decryptField } from '@/lib/security/field-encryption';
import { maskApiKey } from '@/lib/encryption/api-key-encryption';
import { logger } from '@/lib/logger';
import {
  type VaultSecretOutput,
  type VaultAccessLogEntry,
  type VaultActor,
  type VaultCreateParams,
  type VaultAction,
  type Outcome,
  slugify,
} from './types';

// =============================================================================
// In-Memory Cache (5-minute TTL)
// =============================================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const metadataCache = new Map<string, CacheEntry<any>>();

function getCacheKey(orgId: string, extra?: string): string {
  return extra ? `${orgId}:${extra}` : orgId;
}

function getCached<T>(key: string): T | null {
  const entry = metadataCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    metadataCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  metadataCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function invalidateOrgCache(orgId: string): void {
  for (const key of metadataCache.keys()) {
    if (key.startsWith(orgId)) {
      metadataCache.delete(key);
    }
  }
}

// =============================================================================
// Audit Logger
// =============================================================================

async function logAccess(params: {
  vaultSecretId?: string | null;
  organizationId: string;
  action: VaultAction;
  actor: VaultActor;
  outcome: Outcome;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.vaultAccessLog.create({
      data: {
        vaultSecretId: params.vaultSecretId ?? null,
        organizationId: params.organizationId,
        action: params.action,
        actor: params.actor.id,
        actorType: params.actor.type,
        outcome: params.outcome,
        ipAddress: params.actor.ipAddress ?? null,
        userAgent: params.actor.userAgent ?? null,
        details: params.details ? (params.details as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  } catch (err) {
    // Audit logging must never block the main operation
    logger.error('[Vault] Failed to write access log', {
      action: params.action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// =============================================================================
// Prisma → Output mapper
// =============================================================================

function toOutput(row: {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  secretType: string;
  provider: string | null;
  maskedValue: string;
  isActive: boolean;
  isRotatable: boolean;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  usageCount: number;
  lastRotatedAt: Date | null;
  source: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}): VaultSecretOutput {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    secretType: row.secretType,
    provider: row.provider,
    maskedValue: row.maskedValue,
    isActive: row.isActive,
    isRotatable: row.isRotatable,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    usageCount: row.usageCount,
    lastRotatedAt: row.lastRotatedAt?.toISOString() ?? null,
    source: row.source,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// =============================================================================
// Vault Service
// =============================================================================

export const VaultService = {
  // ---------------------------------------------------------------------------
  // createSecret — store a new encrypted secret
  // ---------------------------------------------------------------------------
  async createSecret(
    input: VaultCreateParams,
    actor: VaultActor
  ): Promise<VaultSecretOutput> {
    const row = await prisma.vaultSecret.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        secretType: input.secretType,
        provider: input.provider ?? null,
        encryptedValue: input.encryptedValue,
        encryptionKeyVersion: 1,
        maskedValue: input.maskedValue,
        isRotatable: input.isRotatable,
        expiresAt: input.expiresAt ?? null,
        source: input.source,
        createdBy: input.createdBy ?? actor.id,
      },
    });

    await logAccess({
      vaultSecretId: row.id,
      organizationId: input.organizationId,
      action: 'create',
      actor,
      outcome: 'success',
      details: { slug: input.slug, secretType: input.secretType, provider: input.provider },
    });

    invalidateOrgCache(input.organizationId);
    return toOutput(row);
  },

  // ---------------------------------------------------------------------------
  // getSecret — decrypt and return a secret value (audit-logged)
  // ---------------------------------------------------------------------------
  async getSecret(
    organizationId: string,
    slug: string,
    actor: VaultActor
  ): Promise<string | null> {
    const row = await prisma.vaultSecret.findUnique({
      where: { organizationId_slug: { organizationId, slug } },
    });

    if (!row || !row.isActive) {
      await logAccess({
        vaultSecretId: row?.id ?? null,
        organizationId,
        action: 'decrypt',
        actor,
        outcome: 'failure',
        details: { slug, reason: row ? 'inactive' : 'not_found' },
      });
      return null;
    }

    let decrypted: string | null;
    try {
      decrypted = decryptField(row.encryptedValue);
    } catch (err) {
      logger.error('[Vault] Decryption failed', { slug, orgId: organizationId });
      await logAccess({
        vaultSecretId: row.id,
        organizationId,
        action: 'decrypt',
        actor,
        outcome: 'failure',
        details: { slug, reason: 'decryption_error' },
      });
      return null;
    }

    // Update usage stats (fire-and-forget)
    prisma.vaultSecret
      .update({
        where: { id: row.id },
        data: { lastUsedAt: new Date(), usageCount: { increment: 1 } },
      })
      .catch((updateErr: unknown) => {
        logger.error('[Vault] Failed to update usage stats', { error: String(updateErr) });
      });

    await logAccess({
      vaultSecretId: row.id,
      organizationId,
      action: 'decrypt',
      actor,
      outcome: 'success',
      details: { slug },
    });

    return decrypted;
  },

  // ---------------------------------------------------------------------------
  // getSecretMetadata — return metadata without decrypting
  // ---------------------------------------------------------------------------
  async getSecretMetadata(
    organizationId: string,
    slug: string
  ): Promise<VaultSecretOutput | null> {
    const row = await prisma.vaultSecret.findUnique({
      where: { organizationId_slug: { organizationId, slug } },
    });
    return row ? toOutput(row) : null;
  },

  // ---------------------------------------------------------------------------
  // listSecrets — return all secrets for an org (metadata only, masked)
  // ---------------------------------------------------------------------------
  async listSecrets(
    organizationId: string,
    options?: {
      secretType?: string;
      provider?: string;
      includeInactive?: boolean;
    }
  ): Promise<VaultSecretOutput[]> {
    const cacheKey = getCacheKey(
      organizationId,
      `list:${options?.secretType ?? ''}:${options?.provider ?? ''}:${options?.includeInactive ?? false}`
    );
    const cached = getCached<VaultSecretOutput[]>(cacheKey);
    if (cached) return cached;

    const where: Record<string, unknown> = { organizationId };
    if (!options?.includeInactive) where.isActive = true;
    if (options?.secretType) where.secretType = options.secretType;
    if (options?.provider) where.provider = options.provider;

    const rows = await prisma.vaultSecret.findMany({
      where,
      orderBy: [{ provider: 'asc' }, { name: 'asc' }],
    });

    const output = rows.map(toOutput);
    setCache(cacheKey, output);
    return output;
  },

  // ---------------------------------------------------------------------------
  // rotateSecret — replace encrypted value, update rotation timestamp
  // ---------------------------------------------------------------------------
  async rotateSecret(
    organizationId: string,
    slug: string,
    newValue: string,
    actor: VaultActor
  ): Promise<VaultSecretOutput | null> {
    const existing = await prisma.vaultSecret.findUnique({
      where: { organizationId_slug: { organizationId, slug } },
    });

    if (!existing || !existing.isActive) {
      await logAccess({
        vaultSecretId: existing?.id ?? null,
        organizationId,
        action: 'rotate',
        actor,
        outcome: 'failure',
        details: { slug, reason: existing ? 'inactive' : 'not_found' },
      });
      return null;
    }

    const encrypted = encryptField(newValue);
    if (!encrypted) {
      await logAccess({
        vaultSecretId: existing.id,
        organizationId,
        action: 'rotate',
        actor,
        outcome: 'failure',
        details: { slug, reason: 'encryption_failed' },
      });
      return null;
    }

    const masked = maskApiKey(newValue);

    const updated = await prisma.vaultSecret.update({
      where: { id: existing.id },
      data: {
        encryptedValue: encrypted,
        maskedValue: masked,
        lastRotatedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await logAccess({
      vaultSecretId: existing.id,
      organizationId,
      action: 'rotate',
      actor,
      outcome: 'success',
      details: { slug },
    });

    invalidateOrgCache(organizationId);
    return toOutput(updated);
  },

  // ---------------------------------------------------------------------------
  // deleteSecret — soft-delete (isActive = false)
  // ---------------------------------------------------------------------------
  async deleteSecret(
    organizationId: string,
    slug: string,
    actor: VaultActor
  ): Promise<boolean> {
    const existing = await prisma.vaultSecret.findUnique({
      where: { organizationId_slug: { organizationId, slug } },
    });

    if (!existing) {
      await logAccess({
        vaultSecretId: null,
        organizationId,
        action: 'delete',
        actor,
        outcome: 'failure',
        details: { slug, reason: 'not_found' },
      });
      return false;
    }

    await prisma.vaultSecret.update({
      where: { id: existing.id },
      data: { isActive: false, updatedAt: new Date() },
    });

    await logAccess({
      vaultSecretId: existing.id,
      organizationId,
      action: 'delete',
      actor,
      outcome: 'success',
      details: { slug },
    });

    invalidateOrgCache(organizationId);
    return true;
  },

  // ---------------------------------------------------------------------------
  // getSecretsByProvider — fetch all active secrets for a given provider
  // ---------------------------------------------------------------------------
  async getSecretsByProvider(
    organizationId: string,
    provider: string
  ): Promise<VaultSecretOutput[]> {
    return this.listSecrets(organizationId, { provider });
  },

  // ---------------------------------------------------------------------------
  // getExpiringSecrets — secrets expiring within N days
  // ---------------------------------------------------------------------------
  async getExpiringSecrets(
    organizationId: string,
    withinDays: number = 7
  ): Promise<VaultSecretOutput[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);

    const rows = await prisma.vaultSecret.findMany({
      where: {
        organizationId,
        isActive: true,
        expiresAt: { not: null, lte: cutoff },
      },
      orderBy: { expiresAt: 'asc' },
    });

    return rows.map(toOutput);
  },

  // ---------------------------------------------------------------------------
  // getAccessLogs — paginated audit trail
  // ---------------------------------------------------------------------------
  async getAccessLogs(
    organizationId: string,
    options?: {
      vaultSecretId?: string;
      action?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ logs: VaultAccessLogEntry[]; total: number }> {
    const where: Record<string, unknown> = { organizationId };
    if (options?.vaultSecretId) where.vaultSecretId = options.vaultSecretId;
    if (options?.action) where.action = options.action;

    const [rows, total] = await Promise.all([
      prisma.vaultAccessLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
      }),
      prisma.vaultAccessLog.count({ where }),
    ]);

    const logs: VaultAccessLogEntry[] = rows.map((row) => ({
      id: row.id,
      vaultSecretId: row.vaultSecretId,
      organizationId: row.organizationId,
      action: row.action,
      actor: row.actor,
      actorType: row.actorType,
      outcome: row.outcome,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      details: row.details as Record<string, unknown> | null,
      createdAt: row.createdAt.toISOString(),
    }));

    return { logs, total };
  },

  // ---------------------------------------------------------------------------
  // Helpers for external callers (encrypt + mask before calling createSecret)
  // ---------------------------------------------------------------------------

  /**
   * Encrypt a raw value and generate its masked display form.
   * Returns null if encryption fails.
   */
  prepareSecret(rawValue: string): { encrypted: string; masked: string } | null {
    const encrypted = encryptField(rawValue);
    if (!encrypted) return null;
    const masked = maskApiKey(rawValue);
    return { encrypted, masked };
  },

  /**
   * Generate a slug from a human-readable name.
   */
  generateSlug: slugify,

  /**
   * Clear the in-memory metadata cache (useful for testing).
   */
  clearCache(): void {
    metadataCache.clear();
  },
};
