/**
 * Follower Snapshot Cron
 *
 * Runs daily. For each ACTIVE PlatformConnection, reads the current follower
 * count from `metadata.followers` and records a FollowerSnapshot row. This is
 * the daily history that backs the analytics growth chart + follower-growth KPI
 * (instead of today's proxy).
 *
 * Mirrors `rank-snapshot`: cron-authed, bounded query, per-connection error
 * isolation. Connections with no usable follower count are skipped (we never
 * write a phantom 0). One snapshot per connection per run.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** Safety cap so a single run stays bounded regardless of connection count. */
const MAX_CONNECTIONS = 5000;

/** Read a non-negative integer follower count from a connection's metadata. */
function readFollowerCount(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = (metadata as Record<string, unknown>).followers;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return null;
  return Math.round(raw);
}

export async function GET(request: NextRequest) {
  const auth = verifyCronRequest(request, 'FOLLOWER_SNAPSHOT');
  if (!auth.ok) return auth.response;

  let recorded = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const connections = await prisma.platformConnection.findMany({
      where: { isActive: true, deletedAt: null },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        platform: true,
        metadata: true,
      },
      take: MAX_CONNECTIONS,
    });

    for (const conn of connections) {
      const followers = readFollowerCount(conn.metadata);
      if (followers === null) {
        skipped++;
        continue;
      }

      try {
        await prisma.followerSnapshot.create({
          data: {
            connectionId: conn.id,
            userId: conn.userId,
            organizationId: conn.organizationId,
            platform: conn.platform,
            followers,
          },
        });
        recorded++;
      } catch (err) {
        errors++;
        logger.error('follower-snapshot:connection-failed', {
          connectionId: conn.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('follower-snapshot:complete', { recorded, skipped, errors });

    return NextResponse.json({ success: true, recorded, skipped, errors });
  } catch (error) {
    logger.error('follower-snapshot:fatal', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Follower snapshot cron failed' },
      { status: 500 }
    );
  }
}
