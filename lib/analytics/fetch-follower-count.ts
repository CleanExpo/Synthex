/**
 * fetch-follower-count — resolve a connection's CURRENT follower count live.
 *
 * The follower-snapshot cron was designed to read `PlatformConnection.metadata.followers`,
 * but nothing upstream populated that field, so the cron produced zero snapshots
 * ever despite active connections (SYN-1097). This helper closes the gap: it
 * fetches the live count via the same connection→service path that
 * `ingest-post-metrics` uses, reusing each platform service's `syncAnalytics`
 * (a pure fetch — verified no DB side effects).
 *
 * Contract: returns a non-negative integer, or `null` on ANY of
 * unsupported-platform / no-decryptable-token / service-error / zero-or-invalid.
 * It NEVER throws and NEVER fabricates — a null means "skip", so the caller
 * never writes a phantom count.
 */

import {
  createPlatformService,
  isPlatformSupported,
  type SupportedPlatform,
  type PlatformCredentials,
} from '@/lib/social';
import { decryptFieldSafe } from '@/lib/security/field-encryption';
import { logger } from '@/lib/logger';

export interface FollowerFetchConnection {
  id: string;
  platform: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
  profileId: string | null;
  profileName: string | null;
}

export async function fetchLiveFollowerCount(
  conn: FollowerFetchConnection
): Promise<number | null> {
  const platform = conn.platform.toLowerCase();
  if (!isPlatformSupported(platform)) return null;

  const accessToken = conn.accessToken
    ? decryptFieldSafe(conn.accessToken)
    : null;
  if (!accessToken) return null;

  const credentials: PlatformCredentials = {
    accessToken,
    refreshToken: conn.refreshToken
      ? (decryptFieldSafe(conn.refreshToken) ?? undefined)
      : undefined,
    expiresAt: conn.expiresAt ?? undefined,
    platformUserId: conn.profileId ?? undefined,
    platformUsername: conn.profileName ?? undefined,
  };

  try {
    const service = createPlatformService(
      platform as SupportedPlatform,
      credentials,
      { connectionId: conn.id }
    );
    if (!service) return null;

    const result = await service.syncAnalytics(1);
    if (!result?.success) return null;

    const followers = result.metrics?.followers;
    if (
      typeof followers !== 'number' ||
      !Number.isFinite(followers) ||
      followers <= 0
    ) {
      return null;
    }
    return Math.round(followers);
  } catch (err) {
    logger.warn('follower-fetch: syncAnalytics failed', {
      connectionId: conn.id,
      platform,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
