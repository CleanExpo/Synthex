/**
 * Brand Builder — Mention Poll API (Phase 91)
 *
 * POST /api/brand/mentions/poll — Trigger mention polling and upsert new results
 *
 * @module app/api/brand/mentions/poll/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { RateLimiter } from '@/lib/rate-limit';
import { pollMentions } from '@/lib/brand/mention-poller';
import { urlHash } from '@/lib/brand/mention-deduplicator';
import { logger } from '@/lib/logger';

// ─── Rate limiter — 10/hour per user ──────────────────────────────────────────

const rateLimiter = new RateLimiter({
  windowMs: 60 * 60_000,  // 1 hour
  maxRequests: 10,
  identifier: (req: NextRequest) => {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    return `brand-mention-poll:${ip}`;
  },
});

// ─── Validation ────────────────────────────────────────────────────────────────

const PostSchema = z.object({
  brandId: z.string().min(1),
});

// ─── POST — trigger mention poll ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised', message: 'Authentication required' }, { status: 401 });
    }

    // 2. Rate limit
    const rateResult = await rateLimiter.check(request);
    if (!rateResult.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded. Mention polling is limited to 10 times per hour.' }, { status: 429 });
    }

    // 3. Validate body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }

    const { brandId } = parsed.data;

    // 4. Verify brand ownership + get canonical name
    const brand = await prisma.brandIdentity.findFirst({
      where: { id: brandId, userId },
      select: { id: true, canonicalName: true },
    });

    if (!brand) {
      return NextResponse.json({ error: 'Brand identity not found' }, { status: 404 });
    }

    // 5. Poll mention APIs
    const pollResult = await pollMentions(brand.canonicalName, {
      apiKeys: {
        newsdata: process.env.NEWSDATA_API_KEY,
        gnews:    process.env.GNEWS_API_KEY,
        guardian: process.env.GUARDIAN_API_KEY,
      },
    });

    // 6. Upsert each deduplicated mention
    let newCount = 0;
    for (const mention of pollResult.mentions) {
      const hash = urlHash(mention.url);
      try {
        await prisma.brandMention.upsert({
          where: {
            urlHash_brandId: { urlHash: hash, brandId },
          },
          update: {}, // no update needed — dedup means existing is fine
          create: {
            brandId,
            userId,
            url:         mention.url,
            urlHash:     hash,
            title:       mention.title,
            description: mention.description ?? null,
            publishedAt: mention.publishedAt ? new Date(mention.publishedAt) : null,
            source:      mention.source,
            apiSource:   mention.apiSource,
            sentiment:   'neutral',
          },
        });
        newCount++;
      } catch {
        // Skip duplicates — unique constraint handled by upsert, other errors skipped
      }
    }

    return NextResponse.json({
      newCount,
      totalFetched: pollResult.totalFetched,
      polledAt:     pollResult.polledAt,
    });
  } catch (error) {
    logger.error('Brand mention poll POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to poll brand mentions' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
