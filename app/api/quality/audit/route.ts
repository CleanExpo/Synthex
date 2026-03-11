/**
 * Content Quality Audit API
 *
 * POST /api/quality/audit — run a full quality audit, optionally saving to DB
 * GET  /api/quality/audit — fetch the current user's saved audit history
 *
 * @module app/api/quality/audit/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { RateLimiter } from '@/lib/rate-limit';
import { scoreHumanness } from '@/lib/quality/humanness-scorer';
import { ContentScorer } from '@/lib/ai/content-scorer';
import { logger } from '@/lib/logger';

// ─── Rate limiter — 30 req/min ────────────────────────────────────────────────

const rateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
  identifier: (req: NextRequest) => {
    const ip =
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      'unknown';
    return `quality-audit:${ip}`;
  },
});

// ─── Validation schemas ───────────────────────────────────────────────────────

const PostSchema = z.object({
  text: z.string().min(1, 'Content is required'),
  save: z.boolean().optional().default(false),
});

// ─── POST — run audit ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorised', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Rate limit
    const rateLimitResult = await rateLimiter.check(request);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again shortly.' },
        { status: 429 }
      );
    }

    // 3. Validate body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { text, save } = parsed.data;

    // 4. Run quality audit
    const humanness = scoreHumanness(text);
    const scorer = new ContentScorer();
    const contentScore = scorer.score(text, 'general');

    // 5. Optionally persist
    let auditId: string | undefined;
    if (save) {
      const audit = await prisma.contentQualityAudit.create({
        data: {
          userId,
          orgId: userId, // fallback to userId for solo users
          contentText: text,
          humanessScore: humanness.score,
          slopDensity: humanness.slopScan.slopDensity,
          ttr: humanness.fingerprint?.ttr ?? null,
          fleschScore: humanness.fingerprint?.fleschReadingEase ?? null,
          passRate: humanness.passes,
          slopMatchCount: humanness.slopScan.totalMatches,
          auditResult: humanness as unknown as Prisma.InputJsonValue,
        },
      });
      auditId = audit.id;
    }

    return NextResponse.json({ humanness, contentScore, ...(auditId ? { auditId } : {}) });
  } catch (error) {
    logger.error('Quality audit error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to run quality audit' },
      { status: 500 }
    );
  }
}

// ─── GET — fetch saved audit history ─────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // 1. Auth
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorised', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Fetch audits for this user (most recent first, limit 50)
    const audits = await prisma.contentQualityAudit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        humanessScore: true,
        slopDensity: true,
        passRate: true,
        slopMatchCount: true,
        createdAt: true,
        contentText: true,
      },
    });

    return NextResponse.json({ audits });
  } catch (error) {
    logger.error('Quality audit history error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch audit history' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
