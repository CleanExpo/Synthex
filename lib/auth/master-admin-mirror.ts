/**
 * Master Admin Mirror
 *
 * Keeps a configured pair of master-admin accounts identical: whenever either
 * account signs in or gains a business ownership, both accounts are reconciled
 * to the UNION of their access (multi-business flag, owner bypass flags, and
 * every BusinessOwnership row either of them holds). Reconciliation only ever
 * grants — it never revokes — so a partial failure can not strand an account
 * with less access than it had.
 *
 * Dark by default: the `MASTER_ADMIN_MIRROR` env var must contain exactly two
 * comma-separated emails (e.g. "a@x.com,b@y.com") or every call is a no-op.
 *
 * @module lib/auth/master-admin-mirror
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/** Parse the configured pair; empty array when unset or malformed. */
export function getMasterAdminMirrorPair(): string[] {
  const pair = (process.env.MASTER_ADMIN_MIRROR ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return pair.length === 2 && pair[0] !== pair[1] ? pair : [];
}

/**
 * Reconcile the master-admin pair to the union of their access.
 *
 * Safe to call fire-and-forget from any trigger point. When `triggerEmail` is
 * provided, the sync short-circuits unless that email is one of the pair.
 */
export async function syncMasterAdminPair(
  triggerEmail?: string | null
): Promise<void> {
  const pair = getMasterAdminMirrorPair();
  if (pair.length !== 2) return;
  if (triggerEmail && !pair.includes(triggerEmail.toLowerCase())) return;

  try {
    const users = await prisma.user.findMany({
      where: { email: { in: pair, mode: 'insensitive' } },
      select: { id: true, email: true },
    });
    if (users.length !== 2) {
      logger.warn('Master-admin mirror: pair incomplete, skipping sync', {
        configured: pair.length,
        found: users.length,
      });
      return;
    }

    const ids = users.map(u => u.id);

    // Union the account-level flags (grant-only).
    await prisma.user.updateMany({
      where: { id: { in: ids } },
      data: {
        isMultiBusinessOwner: true,
        onboardingComplete: true,
        apiKeyConfigured: true,
      },
    });

    // Union the business ownerships across the pair.
    const ownerships = await prisma.businessOwnership.findMany({
      where: { ownerId: { in: ids } },
      select: {
        ownerId: true,
        organizationId: true,
        displayName: true,
        isActive: true,
        billingStatus: true,
        monthlyRate: true,
      },
    });

    const missing: Array<{
      ownerId: string;
      organizationId: string;
      displayName: string | null;
      isActive: boolean;
      billingStatus: string;
      monthlyRate: number;
    }> = [];
    for (const userId of ids) {
      const mine = new Set(
        ownerships.filter(o => o.ownerId === userId).map(o => o.organizationId)
      );
      for (const o of ownerships) {
        if (o.ownerId !== userId && !mine.has(o.organizationId)) {
          missing.push({ ...o, ownerId: userId });
          mine.add(o.organizationId);
        }
      }
    }

    if (missing.length > 0) {
      await prisma.businessOwnership.createMany({
        data: missing,
        skipDuplicates: true,
      });
      logger.info('Master-admin mirror: ownerships reconciled', {
        granted: missing.length,
      });
    }
  } catch (error) {
    // Never let mirror maintenance break the triggering flow (login/create).
    logger.error('Master-admin mirror sync failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
