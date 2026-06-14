/**
 * Post-metrics ingestion — lib/analytics/ingest-post-metrics.ts
 *
 * The analytics-sync cron used to write only `lastSync` on each platform
 * connection. Published posts therefore showed 0 engagement forever, and the
 * dashboard's "see results" surface (which reads `PlatformMetrics`) was dead.
 *
 * This module is the missing seam: for a single connected platform it fetches
 * real per-post engagement via the existing `lib/social` platform service
 * (`getPostMetrics`) and persists it into `PlatformMetrics`, which is exactly
 * the table the dashboard aggregates over.
 *
 * Design rules (see PR):
 *  - v1 ingestion only for the platforms that genuinely publish today:
 *    instagram, facebook, linkedin. Every other platform no-ops gracefully.
 *  - Per-post error isolation: one failing post never aborts the batch.
 *  - Bounded read: we never unboundedly `findMany` published posts.
 *  - Idempotent upsert: we keep a single "latest" metrics row per post
 *    (id convention `${postId}_latest`), matching the existing manual-sync
 *    route so the two paths converge rather than duplicate rows.
 *
 * @module lib/analytics/ingest-post-metrics
 */

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
 * Platforms that genuinely publish (and expose post-level insights) today.
 * Everything else is a deliberate, logged no-op for v1.
 */
export const ANALYTICS_INGEST_PLATFORMS: ReadonlySet<string> = new Set([
  'instagram',
  'facebook',
  'linkedin',
]);

/** Max published posts to refresh per connection in a single cron pass. */
export const MAX_POSTS_PER_CONNECTION = 50;

/** Minimal shape of a connection this module needs. */
export interface IngestConnection {
  id: string;
  platform: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  profileId?: string | null;
  profileName?: string | null;
}

export interface IngestResult {
  /** Whether this platform is in the v1 ingestion set. */
  ingested: boolean;
  /** Posts whose metrics were successfully persisted. */
  postsUpdated: number;
  /** Posts that errored individually (isolated — did not abort the batch). */
  postErrors: number;
  /** Reason this connection produced no ingestion (for logging/tests). */
  skippedReason?: 'unsupported-platform' | 'no-token' | 'no-published-posts';
}

/**
 * Normalise a platform `getPostMetrics` payload (which varies per platform)
 * onto the `PlatformMetrics` columns. Unknown fields default to 0 so the
 * upsert is always well-formed.
 */
function normaliseMetrics(raw: Record<string, unknown> | null | undefined): {
  likes: number;
  comments: number;
  shares: number;
  views: number;
  reach: number;
  impressions: number;
  clicks: number;
  saves: number;
} {
  const n = (v: unknown): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0;

  const m = (raw ?? {}) as Record<string, unknown>;
  return {
    likes: n(m.likes),
    comments: n(m.comments),
    shares: n(m.shares),
    views: n(m.views),
    reach: n(m.reach),
    impressions: n(m.impressions),
    clicks: n(m.clicks),
    // platforms name this `saved` (IG) or `saves`
    saves: n(m.saves ?? m.saved),
  };
}

function engagementRate(
  metrics: ReturnType<typeof normaliseMetrics>
): number | null {
  const denom = metrics.impressions || metrics.reach || metrics.views;
  if (!denom) return null;
  const interactions =
    metrics.likes + metrics.comments + metrics.shares + metrics.saves;
  return Number(((interactions / denom) * 100).toFixed(4));
}

/**
 * Ingest real post metrics for one connection's published posts.
 *
 * Self-contained and side-effect-isolated: it logs and swallows per-post
 * failures so a single bad post (or a transient platform 4xx/5xx) cannot
 * break the wider cron batch. Connection-level failures should be caught by
 * the caller.
 */
export async function ingestConnectionPostMetrics(
  conn: IngestConnection
): Promise<IngestResult> {
  const platform = conn.platform.toLowerCase();

  // v1: only the platforms that publish + expose insights today.
  if (!ANALYTICS_INGEST_PLATFORMS.has(platform) || !isPlatformSupported(platform)) {
    return {
      ingested: false,
      postsUpdated: 0,
      postErrors: 0,
      skippedReason: 'unsupported-platform',
    };
  }

  const accessToken = decryptFieldSafe(conn.accessToken);
  if (!accessToken) {
    logger.warn('analytics-ingest: missing/undecryptable access token', {
      connectionId: conn.id,
      platform,
    });
    return {
      ingested: true,
      postsUpdated: 0,
      postErrors: 0,
      skippedReason: 'no-token',
    };
  }

  // Bounded read — never unboundedly findMany. Newest published posts first.
  const posts = await prisma.platformPost.findMany({
    where: {
      connectionId: conn.id,
      status: 'published',
      deletedAt: null,
    },
    select: { id: true, platformId: true },
    orderBy: { publishedAt: 'desc' },
    take: MAX_POSTS_PER_CONNECTION,
  });

  if (posts.length === 0) {
    return {
      ingested: true,
      postsUpdated: 0,
      postErrors: 0,
      skippedReason: 'no-published-posts',
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
    credentials
  );
  if (!service) {
    return {
      ingested: false,
      postsUpdated: 0,
      postErrors: 0,
      skippedReason: 'unsupported-platform',
    };
  }

  let postsUpdated = 0;
  let postErrors = 0;

  for (const post of posts) {
    // Per-post isolation — a single failure never aborts the batch.
    try {
      const raw = await service.getPostMetrics(post.platformId);
      if (!raw) {
        // Platform returned nothing (e.g. metrics not yet available). Not an
        // error — just skip; we don't overwrite real data with zeros.
        continue;
      }

      const metrics = normaliseMetrics(raw as Record<string, unknown>);
      const rate = engagementRate(metrics);
      const metricsRowId = `${post.id}_latest`;

      // Idempotent upsert — one "latest" row per post, refreshed each pass.
      await prisma.platformMetrics.upsert({
        where: { id: metricsRowId },
        create: {
          id: metricsRowId,
          postId: post.id,
          ...metrics,
          engagementRate: rate,
          recordedAt: new Date(),
        },
        update: {
          ...metrics,
          engagementRate: rate,
          recordedAt: new Date(),
        },
      });

      postsUpdated++;
    } catch (err) {
      postErrors++;
      logger.error('analytics-ingest: post metrics failed (isolated)', {
        connectionId: conn.id,
        platform,
        postId: post.id,
        platformId: post.platformId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { ingested: true, postsUpdated, postErrors };
}
