/**
 * Fetch Mentions Cron Job
 *
 * GET /api/cron/fetch-mentions
 * Runs every 30 minutes via Vercel Cron.
 * Fetches new mentions for all active tracked keywords.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - CRON_SECRET: Vercel cron secret for authorization (SECRET)
 * - TWITTER_BEARER_TOKEN: For Twitter search (optional)
 * - YOUTUBE_API_KEY: For YouTube search (optional)
 * - OPENROUTER_API_KEY: For sentiment analysis (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { fetchMentions } from '@/lib/social/mention-fetcher';
import { analyzeSentimentBatch } from '@/lib/social/sentiment-analyzer';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

const MAX_KEYWORDS_PER_RUN = 100;
const MENTIONS_PER_KEYWORD = 20;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    logger.info('[Fetch Mentions Cron] Starting...');
    const startTime = Date.now();

    // Get all active tracked keywords (limited)
    const keywords = await prisma.trackedKeyword.findMany({
      where: { isActive: true },
      include: {
        user: {
          select: { id: true },
        },
      },
      orderBy: { lastCheckedAt: 'asc' }, // Oldest first
      take: MAX_KEYWORDS_PER_RUN,
    });

    if (keywords.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active keywords to process',
        keywordsProcessed: 0,
        mentionsFetched: 0,
        mentionsSaved: 0,
        durationMs: Date.now() - startTime,
      });
    }

    // Get user access tokens for platforms, scoped by organization
    // Build unique (userId, organizationId) pairs from keywords
    const userOrgPairs = [...new Set(
      keywords.map(k => `${k.userId}|${k.organizationId ?? ''}`)
    )].map(pair => {
      const [userId, orgId] = pair.split('|');
      return { userId, organizationId: orgId || null };
    });

    // Fetch connections for each user+org pair
    const allConnections = await Promise.all(
      userOrgPairs.map(({ userId, organizationId }) =>
        prisma.platformConnection.findMany({
          where: {
            userId,
            organizationId,
            isActive: true,
          },
          select: {
            userId: true,
            platform: true,
            accessToken: true,
          },
        }).then(conns => conns.map(c => ({ ...c, organizationId })))
      )
    );

    // Build token map: "userId|orgId" -> platform -> token
    const tokenMap = new Map<string, Map<string, string>>();
    for (const conn of allConnections.flat()) {
      const key = `${conn.userId}|${conn.organizationId ?? ''}`;
      if (!tokenMap.has(key)) {
        tokenMap.set(key, new Map());
      }
      tokenMap.get(key)!.set(conn.platform, conn.accessToken);
    }

    let mentionsFetched = 0;
    let mentionsSaved = 0;
    let keywordsProcessed = 0;
    let errors = 0;

    // Process each keyword
    for (const keyword of keywords) {
      try {
        const tokenKey = `${keyword.userId}|${keyword.organizationId ?? ''}`;
        const userTokens = tokenMap.get(tokenKey) || new Map<string, string>();
        const allMentions: Array<{
          platform: string;
          platformPostId: string;
          platformUrl: string | null;
          authorHandle: string;
          authorName: string | null;
          authorAvatar: string | null;
          authorFollowers: number | null;
          content: string;
          mediaUrls: string[];
          likes: number;
          comments: number;
          shares: number;
          postedAt: Date;
        }> = [];

        // Fetch from each platform
        for (const platform of keyword.platforms) {
          const accessToken = userTokens.get(platform) || null;
          const result = await fetchMentions(
            keyword.keyword,
            platform,
            accessToken,
            keyword.lastCheckedAt || undefined
          );

          if (result.success && result.mentions.length > 0) {
            allMentions.push(...result.mentions.slice(0, MENTIONS_PER_KEYWORD));
            mentionsFetched += result.mentions.length;
          } else if (result.error) {
            logger.warn(`[Fetch Mentions] ${platform} failed for "${keyword.keyword}"`, {
              error: result.error,
            });
          }
        }

        // Analyze sentiment for all fetched mentions
        let sentimentResults: Map<number, { sentiment: string; score: number }> = new Map();
        if (allMentions.length > 0) {
          const texts = allMentions.map(m => m.content);
          const batchResult = await analyzeSentimentBatch(texts, 5);
          if (batchResult.success) {
            for (const result of batchResult.results) {
              sentimentResults.set(result.index, {
                sentiment: result.sentiment,
                score: result.score,
              });
            }
          }
        }

        // Save mentions to database (upsert to handle duplicates)
        for (let i = 0; i < allMentions.length; i++) {
          const mention = allMentions[i];
          const sentimentData = sentimentResults.get(i);

          try {
            await prisma.socialMention.upsert({
              where: {
                platform_platformPostId: {
                  platform: mention.platform,
                  platformPostId: mention.platformPostId,
                },
              },
              create: {
                keywordId: keyword.id,
                userId: keyword.userId,
                platform: mention.platform,
                platformPostId: mention.platformPostId,
                platformUrl: mention.platformUrl,
                authorHandle: mention.authorHandle,
                authorName: mention.authorName,
                authorAvatar: mention.authorAvatar,
                authorFollowers: mention.authorFollowers,
                content: mention.content,
                mediaUrls: mention.mediaUrls,
                likes: mention.likes,
                comments: mention.comments,
                shares: mention.shares,
                sentiment: sentimentData?.sentiment || null,
                sentimentScore: sentimentData?.score || null,
                isInfluencer: (mention.authorFollowers || 0) > 10000,
                postedAt: mention.postedAt,
              },
              update: {
                // Update metrics on existing mentions
                likes: mention.likes,
                comments: mention.comments,
                shares: mention.shares,
              },
            });
            mentionsSaved++;
          } catch (saveErr) {
            // Log but continue - might be constraint violation
            logger.warn(`[Fetch Mentions] Failed to save mention`, {
              platform: mention.platform,
              postId: mention.platformPostId,
              error: saveErr instanceof Error ? saveErr.message : String(saveErr),
            });
          }
        }

        // Update keyword stats
        const newTotalMentions = await prisma.socialMention.count({
          where: { keywordId: keyword.id },
        });

        await prisma.trackedKeyword.update({
          where: { id: keyword.id },
          data: {
            lastCheckedAt: new Date(),
            totalMentions: newTotalMentions,
          },
        });

        keywordsProcessed++;
      } catch (err) {
        logger.error(`[Fetch Mentions] Failed for keyword "${keyword.keyword}"`, {
          error: err instanceof Error ? err.message : String(err),
        });
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    logger.info(
      `[Fetch Mentions Cron] Complete: ${keywordsProcessed} keywords, ${mentionsFetched} fetched, ${mentionsSaved} saved, ${errors} errors in ${duration}ms`
    );

    return NextResponse.json({
      success: true,
      keywordsProcessed,
      mentionsFetched,
      mentionsSaved,
      errors,
      durationMs: duration,
    });
  } catch (error) {
    logger.error('[Fetch Mentions Cron] Fatal error:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Mention fetching failed' },
      { status: 500 }
    );
  }
}
