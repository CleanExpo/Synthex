/**
 * Cross-invocation OAuth2 refresh lock
 *
 * @description
 * Serialises "refresh-and-persist" for a single PlatformConnection across
 * separate serverless invocations (cron vs inline publish vs sync) so that a
 * single-use rotating refresh token (X/Twitter, and the other rotating
 * providers) is rotated by exactly ONE actor at a time. Every other caller
 * re-reads the freshly persisted token and uses it instead of replaying the
 * just-rotated (now-revoked) token.
 *
 * Why a Postgres advisory lock and not an in-process single-flight:
 * an instance field only serialises callers inside ONE serverless function.
 * Cron and an inline publish run in separate Vercel invocations with their own
 * process memory, so they cannot see each other's in-flight refresh. The only
 * thing they share is the database, so the mutual-exclusion primitive has to
 * live there.
 *
 * Why TRANSACTION-scoped (pg_advisory_xact_lock) inside prisma.$transaction and
 * NOT a session-scoped pg_advisory_lock/unlock pair:
 * the serverless DATABASE_URL points at a transaction pooler (pgbouncer /
 * Supavisor). Under transaction pooling the backend is reassigned between
 * transactions, so a session lock taken on one backend can never be unlocked on
 * the same backend — it leaks, or the next pooled renter inherits a lock it
 * never asked for. A transaction-scoped lock is taken and released (at
 * COMMIT/ROLLBACK) on the one backend the interactive transaction holds for its
 * whole body, which is the only correct variant under a transaction pooler.
 *
 * hashtext(text) yields int4 which widens to the bigint pg_advisory_xact_lock
 * overload, so Postgres does the string→bigint hashing — no JS-side hashing.
 * The key is bound as a query parameter via the tagged template, not string
 * concatenated.
 *
 * The critical section is deliberately: LOCK -> RE-READ the persisted token ->
 * refresh only if it is still stale -> persist atomically -> COMMIT (releases
 * the lock). The re-read after acquiring the lock is the whole point: by the
 * time this holds the lock a sibling invocation may already have rotated the
 * token, in which case this returns the fresh persisted token and skips the
 * refresh entirely.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  decryptFieldSafe,
  encryptField,
} from '@/lib/security/field-encryption';
import {
  PlatformError,
  type PlatformCredentials,
} from '@/lib/social/base-platform-service';
import { logger } from '@/lib/logger';

/** Default proactive-refresh skew (matches BasePlatformService default). */
const DEFAULT_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Consecutive failed refreshes tolerated before a connection is flagged
 * requires_reauth. A single failure is never disabling — a rotation-race loser
 * or a transient blip must not disable a healthy connection. Only a genuinely
 * dead token fails N times in a row.
 */
export const MAX_CONSECUTIVE_REFRESH_FAILURES = 3;

/** How long the locked transaction may run (X caps its refresh POST at 10s). */
const LOCK_TX_TIMEOUT_MS = 15_000;
/** How long to wait to check out a pooled connection for the transaction. */
const LOCK_TX_MAX_WAIT_MS = 5_000;

export interface RunLockedRefreshParams {
  /** Stable PlatformConnection id — the lock + persistence key. */
  connectionId: string;
  /** Platform slug, for error/log context and notifications. */
  platform: string;
  /**
   * Performs the actual upstream token refresh (the platform service's bound
   * refreshToken()). Called ONLY when the re-read shows the persisted token is
   * still stale — i.e. no sibling has rotated it — so it always presents the
   * current, unused refresh token.
   */
  doRefresh: () => Promise<PlatformCredentials>;
  /** Proactive-refresh skew; must match the caller's needs-refresh threshold. */
  thresholdMs?: number;
}

/**
 * Server/config failures (missing client credentials, service not configured)
 * are a SERVER problem, not a per-connection auth failure. They must never
 * count toward the consecutive-failure counter and never disable a user
 * connection — the same misconfiguration would otherwise mass-disable every
 * connection on the platform.
 */
function isServerConfigError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('not configured') ||
    lower.includes('client credentials') ||
    lower.includes('client_id') ||
    lower.includes('client secret')
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

type LockOutcome =
  | { kind: 'refreshed'; credentials: PlatformCredentials }
  | { kind: 'fresh'; credentials: PlatformCredentials }
  | { kind: 'error'; message: string };

/**
 * Refresh (or re-read) a connection's OAuth token under a cross-invocation
 * advisory lock, persisting the rotated token atomically inside the same
 * transaction. Returns the valid credentials (freshly rotated, or the token a
 * sibling already rotated). Throws PlatformError when the refresh genuinely
 * failed; after {@link MAX_CONSECUTIVE_REFRESH_FAILURES} consecutive genuine
 * failures the connection is disabled and the user is notified to reconnect.
 */
export async function runLockedRefresh(
  params: RunLockedRefreshParams
): Promise<PlatformCredentials> {
  const { connectionId, platform, doRefresh } = params;
  const thresholdMs = params.thresholdMs ?? DEFAULT_THRESHOLD_MS;
  const lockKey = `platform-refresh:${connectionId}`;

  const outcome = await prisma.$transaction(
    async tx => {
      // Transaction-scoped advisory lock: released automatically at
      // COMMIT/ROLLBACK, on the one backend this interactive transaction holds.
      // hashtext() returns int4 which widens to the bigint overload.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      // RE-READ the persisted token now that we hold the lock — a sibling may
      // already have rotated it while we waited.
      const row = await tx.platformConnection.findUnique({
        where: { id: connectionId },
        select: {
          id: true,
          userId: true,
          accessToken: true,
          refreshToken: true,
          expiresAt: true,
          metadata: true,
          profileName: true,
        },
      });

      if (!row) {
        return {
          kind: 'error',
          message: `Platform connection ${connectionId} not found`,
        } satisfies LockOutcome;
      }

      const persistedCredentials: PlatformCredentials = {
        accessToken: decryptFieldSafe(row.accessToken) ?? row.accessToken,
        refreshToken: row.refreshToken
          ? (decryptFieldSafe(row.refreshToken) ?? undefined)
          : undefined,
        expiresAt: row.expiresAt ?? undefined,
      };

      // Sibling already refreshed? A just-rotated token carries a full lifetime
      // (X ≈ 2h), so an expiry comfortably beyond the proactive window means a
      // sibling won the race — use its token, do NOT replay our stale one.
      if (row.expiresAt && row.expiresAt.getTime() > Date.now() + thresholdMs) {
        logger.info('[refresh-lock] Sibling already refreshed — re-using', {
          connectionId,
          platform,
        });
        return {
          kind: 'fresh',
          credentials: persistedCredentials,
        } satisfies LockOutcome;
      }

      // Still stale under the lock: we are the sole refresher. doRefresh() uses
      // the current (unused) refresh token — network IO is intentionally inside
      // the transaction so the lock is held for the whole rotate+persist.
      let newCredentials: PlatformCredentials;
      try {
        newCredentials = await doRefresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        // Server/config failure — not the user's fault. Roll back (releasing
        // the lock), persist nothing, surface as transient.
        if (isServerConfigError(message)) {
          throw error;
        }

        // Genuine refresh failure — increment the per-connection consecutive
        // counter and disable only after N in a row.
        const meta = asRecord(row.metadata);
        const prevCount =
          typeof meta.refreshFailureCount === 'number'
            ? meta.refreshFailureCount
            : 0;
        const nextCount = prevCount + 1;
        const disable = nextCount >= MAX_CONSECUTIVE_REFRESH_FAILURES;
        const nowIso = new Date().toISOString();

        const failureMeta: Record<string, unknown> = {
          ...meta,
          refreshFailureCount: nextCount,
          lastRefreshError: message,
          lastRefreshFailedAt: nowIso,
        };
        if (disable) {
          failureMeta.authStatus = 'requires_reauth';
          failureMeta.authFailedAt = nowIso;
          failureMeta.authFailureReason = message;
        }

        await tx.platformConnection.update({
          where: { id: connectionId },
          data: {
            ...(disable ? { isActive: false } : {}),
            metadata: failureMeta as Prisma.InputJsonObject,
          },
        });

        if (disable) {
          logger.warn(
            '[refresh-lock] Connection disabled after consecutive refresh failures',
            { connectionId, platform, failures: nextCount }
          );
          const platformLabel =
            platform.charAt(0).toUpperCase() + platform.slice(1);
          const accountLabel = row.profileName ? ` (${row.profileName})` : '';
          try {
            await tx.notification.create({
              data: {
                userId: row.userId,
                type: 'platform_reauth_required',
                title: `Reconnect your ${platformLabel} account`,
                message: `Your ${platformLabel}${accountLabel} connection could not be refreshed and needs to be reconnected. Go to Platforms → ${platformLabel} and click Reconnect to restore posting.`,
                data: {
                  connectionId,
                  platform,
                  profileName: row.profileName ?? null,
                },
                read: false,
              },
            });
          } catch (notifyError) {
            logger.error(
              '[refresh-lock] Failed to create reauth notification',
              {
                connectionId,
                platform,
                error: notifyError,
              }
            );
          }
        }

        return { kind: 'error', message } satisfies LockOutcome;
      }

      // Persist the rotated token atomically (encrypted) and reset the failure
      // counter. Rotation-merge is handled upstream (the service keeps the old
      // refresh token when the provider omits a new one); here we only persist a
      // refresh token when the refresh returned one.
      const meta = asRecord(row.metadata);
      const encryptedAccess =
        encryptField(newCredentials.accessToken) ?? newCredentials.accessToken;
      const data: Prisma.PlatformConnectionUpdateInput = {
        accessToken: encryptedAccess,
        expiresAt: newCredentials.expiresAt ?? null,
        updatedAt: new Date(),
        metadata: {
          ...meta,
          refreshFailureCount: 0,
          lastRefreshError: null,
          tokenRefresh: {
            source: 'refresh-lock',
            refreshedAt: new Date().toISOString(),
            expiresAt: newCredentials.expiresAt?.toISOString() ?? null,
          },
        } as Prisma.InputJsonObject,
      };
      if (newCredentials.refreshToken !== undefined) {
        data.refreshToken = newCredentials.refreshToken
          ? (encryptField(newCredentials.refreshToken) ??
            newCredentials.refreshToken)
          : null;
      }

      await tx.platformConnection.update({
        where: { id: connectionId },
        data,
      });

      return {
        kind: 'refreshed',
        credentials: newCredentials,
      } satisfies LockOutcome;
    },
    { timeout: LOCK_TX_TIMEOUT_MS, maxWait: LOCK_TX_MAX_WAIT_MS }
  );

  if (outcome.kind === 'error') {
    throw new PlatformError(platform, outcome.message);
  }
  return outcome.credentials;
}
