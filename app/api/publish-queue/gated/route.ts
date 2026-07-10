/**
 * Gated-cuts list API — app/api/publish-queue/gated/route.ts
 *
 * Read side of the human release gate (SYN-1075 WS4c). Returns every
 * `queued_human_gated` publish_queue row for the caller's organisation,
 * resolved against its derived video asset and grouped by hero, so the studio
 * Release tab can render per-cut previews + captions + (for YouTube cuts) the
 * read-only search package.
 *
 * Read-only. Org-scoped: only rows whose `organizationId` matches the caller's
 * resolved organisation are returned — a cut from another org is never visible.
 *
 * @task SYN-1075
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { readDefault } from '@/lib/rate-limit';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

export const dynamic = 'force-dynamic';

// ── Response types ──────────────────────────────────────────────────────────

export interface GatedCut {
  /** publish_queue row id — the handle the release route acts on. */
  itemId: string;
  /** Canonical platform id, or 'unassigned' if not yet targeted. */
  platform: string;
  /** Public URL of the rendered cut (playable preview). */
  videoUrl: string | null;
  /** Poster/thumbnail URL. */
  thumbnail: string | null;
  /** Aspect ratio label (e.g. '9:16'). */
  aspectRatio: string | null;
  /** Burned-in caption text. */
  caption: string | null;
  /** Read-only YouTube search package, present only for youtube cuts. */
  youtube: { title: string; description?: string; tags?: string[] } | null;
  /** When the cut was gated. */
  gatedAt: string;
}

export interface GatedHeroGroup {
  /** Hero asset id the cuts were derived from (or 'ungrouped'). */
  heroId: string;
  /** Hero title, best-effort. */
  heroTitle: string | null;
  cuts: GatedCut[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Parse the `social-cut:<assetId>` slotId convention → assetId. */
function parseSocialCutAssetId(slotId: string): string | null {
  const prefix = 'social-cut:';
  return slotId.startsWith(prefix) ? slotId.slice(prefix.length) : null;
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  return readDefault(request, async () => {
    try {
      const userId = await getUserIdFromRequestOrCookies(request);
      if (!userId) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Authentication required' },
          { status: 401 }
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true },
      });
      if (!user?.organizationId) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'No organisation found' },
          { status: 403 }
        );
      }
      const organizationId = user.organizationId;

      const rows = await prisma.publishQueueItem.findMany({
        where: { organizationId, status: 'queued_human_gated' },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          slotId: true,
          platform: true,
          createdAt: true,
        },
      });

      // Resolve each social-cut row's video asset (org membership already
      // guaranteed by the queue row's organizationId scope above).
      const assetIds = rows
        .map(r => parseSocialCutAssetId(r.slotId))
        .filter((v): v is string => v !== null);

      const assets = assetIds.length
        ? await prisma.videoAsset.findMany({
            where: { id: { in: assetIds } },
            select: {
              id: true,
              title: true,
              url: true,
              thumbnail: true,
              metadata: true,
            },
          })
        : [];
      const assetById = new Map(assets.map(a => [a.id, a]));

      const groups = new Map<string, GatedHeroGroup>();

      for (const row of rows) {
        const assetId = parseSocialCutAssetId(row.slotId);
        const asset = assetId ? assetById.get(assetId) : undefined;
        const meta = readRecord(asset?.metadata);
        const derivation = readRecord(meta?.derivation);
        const captionRec = readRecord(derivation?.caption);
        const youtubeRec = readRecord(meta?.youtube);

        const heroId =
          (typeof meta?.derivedFrom === 'string' && meta.derivedFrom) ||
          'ungrouped';

        const cut: GatedCut = {
          itemId: row.id,
          platform: row.platform,
          videoUrl: asset?.url ?? null,
          thumbnail: asset?.thumbnail ?? null,
          aspectRatio:
            typeof meta?.aspectRatio === 'string' ? meta.aspectRatio : null,
          caption:
            typeof captionRec?.text === 'string' ? captionRec.text : null,
          youtube:
            row.platform === 'youtube' && youtubeRec
              ? {
                  title:
                    typeof youtubeRec.title === 'string'
                      ? youtubeRec.title
                      : '',
                  description:
                    typeof youtubeRec.description === 'string'
                      ? youtubeRec.description
                      : undefined,
                  tags:
                    Array.isArray(youtubeRec.tags) &&
                    youtubeRec.tags.every(t => typeof t === 'string')
                      ? (youtubeRec.tags as string[])
                      : undefined,
                }
              : null,
          gatedAt: row.createdAt.toISOString(),
        };

        const existing = groups.get(heroId);
        if (existing) {
          existing.cuts.push(cut);
        } else {
          groups.set(heroId, {
            heroId,
            heroTitle: asset?.title ?? null,
            cuts: [cut],
          });
        }
      }

      return NextResponse.json({
        success: true,
        heroes: Array.from(groups.values()),
        totalCuts: rows.length,
      });
    } catch (error: unknown) {
      logger.error('publish-queue/gated: unexpected error', { error });
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
    }
  });
}
