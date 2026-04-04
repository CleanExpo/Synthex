/**
 * Video Episodes API
 *
 * GET /api/video/episodes — Returns VideoEpisode records with series info,
 * quality scores, and social post status for the episode monitoring dashboard.
 *
 * Also returns:
 *  - Series list with pending topic queue counts
 *  - Episode counts per status
 *
 * Auth: APISecurityChecker — authenticated read, org-scoped.
 *
 * @task SYN-572
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      security.error === 'Authentication required' ? 401 : 403
    );
  }

  try {
    // Autonomous video series are global (organisationId = null).
    // All authenticated users can view the episode monitor.
    const series = await prisma.videoSeries.findMany({
      orderBy: { createdAt: 'asc' },
    });

    // Fetch recent episodes (last 30) across all series
    const seriesIds = series.map(s => s.id);

    const episodes = await prisma.videoEpisode.findMany({
      where: seriesIds.length > 0 ? { seriesId: { in: seriesIds } } : {},
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        seriesId: true,
        episodeNumber: true,
        title: true,
        slug: true,
        status: true,
        humannessScore: true,
        geoTacticScore: true,
        slopScanPassed: true,
        youtubeVideoId: true,
        youtubeUrl: true,
        blogPostUrl: true,
        errorMessage: true,
        scriptedAt: true,
        capturedAt: true,
        publishedAt: true,
        createdAt: true,
        socialPosts: true,
      },
    });

    // Fetch pending topic counts per series
    const queueCounts =
      seriesIds.length > 0
        ? await prisma.videoTopicQueue.groupBy({
            by: ['seriesId', 'status'],
            where: { seriesId: { in: seriesIds } },
            _count: { id: true },
          })
        : [];

    const queueBySeriesId: Record<string, { pending: number; total: number }> =
      {};
    for (const row of queueCounts) {
      const sid = row.seriesId;
      if (!queueBySeriesId[sid]) {
        queueBySeriesId[sid] = { pending: 0, total: 0 };
      }
      queueBySeriesId[sid].total += row._count.id;
      if (row.status === 'pending') {
        queueBySeriesId[sid].pending += row._count.id;
      }
    }

    // Episode status summary
    const statusSummary: Record<string, number> = {};
    for (const ep of episodes) {
      statusSummary[ep.status] = (statusSummary[ep.status] ?? 0) + 1;
    }

    const heldCount = statusSummary['held'] ?? 0;

    const payload = {
      series: series.map(s => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        seriesType: s.seriesType,
        status: s.status,
        nextEpisodeNum: s.nextEpisodeNum,
        youtubePlaylistId: s.youtubePlaylistId,
        queueDepth: queueBySeriesId[s.id]?.pending ?? 0,
        totalTopics: queueBySeriesId[s.id]?.total ?? 0,
      })),
      episodes: episodes.map(ep => ({
        id: ep.id,
        seriesId: ep.seriesId,
        episodeNumber: ep.episodeNumber,
        title: ep.title,
        slug: ep.slug,
        status: ep.status,
        humannessScore: ep.humannessScore,
        geoTacticScore: ep.geoTacticScore,
        slopScanPassed: ep.slopScanPassed,
        youtubeVideoId: ep.youtubeVideoId,
        youtubeUrl: ep.youtubeUrl,
        blogPostUrl: ep.blogPostUrl,
        errorMessage: ep.errorMessage,
        scriptedAt: ep.scriptedAt,
        capturedAt: ep.capturedAt,
        publishedAt: ep.publishedAt,
        createdAt: ep.createdAt,
        // Summarise social posts count without leaking full content
        socialPostsCount:
          ep.socialPosts && typeof ep.socialPosts === 'object'
            ? Object.keys(ep.socialPosts as Record<string, unknown>).length
            : 0,
      })),
      summary: {
        ...statusSummary,
        heldCount,
        total: episodes.length,
      },
    };

    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('GET /api/video/episodes failed', { error: message });
    return NextResponse.json(
      { error: 'Failed to load episodes', details: message },
      { status: 500 }
    );
  }
}
