/**
 * Audience-demographics sync — lib/analytics/sync-audience-demographics.ts
 *
 * The platform services expose `syncAudience()` (real Graph-API audience
 * insights for Instagram) but nothing called it — the audience page therefore
 * showed empty `[]` scaffold forever. This module is the missing seam: for a
 * single connected platform it fetches real audience demographics via the
 * existing `lib/social` platform service and persists them into
 * `PlatformConnection.metadata.demographics` (the same Json column that already
 * holds `followers`), MERGING rather than clobbering.
 *
 * Mirrors `lib/analytics/ingest-post-metrics.ts`:
 *  - v1 fetch only for the platform whose audience-insight API we've actually
 *    implemented + can parse today: instagram. (facebook is deferred — the
 *    factory routes 'facebook' to InstagramService whose syncAudience reads
 *    Instagram-account `audience_gender_age`/`audience_country` metrics, which
 *    are NOT valid for a Facebook *Page* — a Page uses `page_fans_gender_age` /
 *    `page_fans_country`. Running a FB Page through this path would error and
 *    yield empty, so we skip it explicitly rather than imply support.) Every
 *    other platform (LinkedIn/Twitter/TikTok/…) is a deliberate, logged no-op.
 *  - Token decrypt via `decryptFieldSafe`, never logged.
 *  - Error-isolated: the caller (cron) wraps each connection; this module also
 *    swallows its own failures into an honest empty result so a bad fetch can't
 *    break the batch.
 *  - HONEST EMPTY: an account that doesn't expose demographics persists EMPTY
 *    arrays — we never fabricate.
 *
 * @module lib/analytics/sync-audience-demographics
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  createPlatformService,
  isPlatformSupported,
  type PlatformCredentials,
  type SupportedPlatform,
} from '@/lib/social';
import { decryptFieldSafe } from '@/lib/security/field-encryption';

/**
 * Platforms whose audience-demographics fetch is implemented + parseable today.
 * Everything else is a deliberate, logged no-op for v1.
 *
 * NOTE: 'facebook' is intentionally excluded — see module header.
 */
export const AUDIENCE_DEMOGRAPHICS_PLATFORMS: ReadonlySet<string> = new Set([
  'instagram',
]);

/** Minimal shape of a connection this module needs. */
export interface AudienceSyncConnection {
  id: string;
  platform: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  profileId?: string | null;
  profileName?: string | null;
}

export type AudienceSyncSkipReason =
  | 'unsupported-platform'
  | 'no-token'
  | 'no-data';

export interface AudienceSyncResult {
  /** Whether this platform is in the v1 audience-fetch set. */
  fetched: boolean;
  /** Whether the connection's metadata.demographics was written. */
  stored: boolean;
  /** Whether the platform returned any real demographic signal. */
  hasData: boolean;
  skippedReason?: AudienceSyncSkipReason;
}

/** Shape we persist under metadata.demographics. */
export interface StoredDemographics {
  ageRanges: Array<{ range: string; percentage: number; count?: number }>;
  genderSplit: Array<{ gender: string; percentage: number; count?: number }>;
  topLocations: Array<{
    location: string;
    country?: string;
    percentage: number;
    count?: number;
  }>;
  /** ISO timestamp of the fetch — lets the surface show freshness / honesty. */
  syncedAt: string;
}

/**
 * Fetch + persist real audience demographics for one connection.
 *
 * Self-contained and side-effect-isolated. Always resolves (never rejects);
 * a fetch failure is reported as an honest empty result, not an exception.
 */
export async function syncConnectionAudienceDemographics(
  conn: AudienceSyncConnection
): Promise<AudienceSyncResult> {
  const platform = conn.platform.toLowerCase();

  if (
    !AUDIENCE_DEMOGRAPHICS_PLATFORMS.has(platform) ||
    !isPlatformSupported(platform)
  ) {
    return {
      fetched: false,
      stored: false,
      hasData: false,
      skippedReason: 'unsupported-platform',
    };
  }

  const accessToken = decryptFieldSafe(conn.accessToken);
  if (!accessToken) {
    logger.warn('audience-demographics: missing/undecryptable access token', {
      connectionId: conn.id,
      platform,
    });
    return {
      fetched: true,
      stored: false,
      hasData: false,
      skippedReason: 'no-token',
    };
  }

  const credentials: PlatformCredentials = {
    accessToken,
    refreshToken: conn.refreshToken
      ? (decryptFieldSafe(conn.refreshToken) ?? undefined)
      : undefined,
    expiresAt: conn.expiresAt ?? undefined,
    platformUserId: conn.profileId ?? undefined,
    platformUsername: conn.profileName ?? undefined,
  };

  const service = createPlatformService(
    platform as SupportedPlatform,
    credentials,
    { connectionId: conn.id }
  );
  if (!service) {
    return {
      fetched: false,
      stored: false,
      hasData: false,
      skippedReason: 'unsupported-platform',
    };
  }

  let result;
  try {
    result = await service.syncAudience();
  } catch (err) {
    // syncAudience is designed not to throw, but stay defensive — treat any
    // throw as honest "no data" rather than poisoning the batch.
    logger.warn('audience-demographics: syncAudience threw (isolated)', {
      connectionId: conn.id,
      platform,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      fetched: true,
      stored: false,
      hasData: false,
      skippedReason: 'no-data',
    };
  }

  const demo = result.success ? result.data?.demographics : undefined;
  const hasData = !!(
    demo &&
    (demo.ageRanges.length > 0 ||
      demo.genderSplit.length > 0 ||
      demo.topLocations.length > 0)
  );

  // Build the stored payload. We always write (even when empty) so the surface
  // can distinguish "synced, account exposes nothing" from "never synced".
  const stored: StoredDemographics = {
    ageRanges: demo?.ageRanges ?? [],
    genderSplit: demo?.genderSplit ?? [],
    topLocations: demo?.topLocations ?? [],
    syncedAt: new Date().toISOString(),
  };

  // MERGE into metadata — never clobber existing keys (e.g. followers).
  const existing = await prisma.platformConnection.findUnique({
    where: { id: conn.id },
    select: { metadata: true },
  });
  const existingMetadata =
    (existing?.metadata as Record<string, unknown> | null) ?? {};

  await prisma.platformConnection.update({
    where: { id: conn.id },
    data: {
      metadata: {
        ...existingMetadata,
        demographics: stored,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    fetched: true,
    stored: true,
    hasData,
    skippedReason: hasData ? undefined : 'no-data',
  };
}
