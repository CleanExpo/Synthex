/**
 * Content Capsule API — Format Content as AI-Extractable Capsule
 *
 * POST /api/voice/capsule
 * Body: { text: string, save?: boolean }
 * Returns: ContentCapsuleResult + optional capsuleId if saved
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/voice/capsule/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { RateLimiter } from '@/lib/rate-limit';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import { isFeatureAvailable } from '@/lib/geo/feature-limits';
import { formatAsCapsule } from '@/lib/voice/capsule-formatter';
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
    return `voice-capsule:${ip}`;
  },
});

// ─── Validation schema ────────────────────────────────────────────────────────

const capsuleSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  save: z.boolean().optional().default(false),
});

function countWords(text: string): number {
  return (text.match(/\b\w+\b/g) ?? []).length;
}

// ─── POST Handler ─────────────────────────────────────────────────────────────

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

    const parsed = capsuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { text, save } = parsed.data;

    // 4. Feature gate — capsuleFormats required
    const subscription = await subscriptionService.getSubscription(userId);
    const plan = subscription?.plan ?? 'free';

    if (!isFeatureAvailable(plan, 'capsuleFormats')) {
      return NextResponse.json(
        {
          error: 'Content Capsule formatting requires a Pro plan or higher',
          upgrade: true,
        },
        { status: 403 }
      );
    }

    // 5. Format content as capsule
    const result = formatAsCapsule(text);

    // 6. Optionally persist as ContentCapsule
    let capsuleId: string | undefined;
    if (save) {
      const orgId = (subscription as unknown as { orgId?: string } | null)?.orgId ?? userId;
      const wordCount = countWords(text);

      const capsule = await prisma.contentCapsule.create({
        data: {
          userId,
          orgId,
          originalText: text,
          capsuleOutput: result as unknown as Prisma.InputJsonValue,
          wordCount,
          extractability: result.extractability,
        },
      });
      capsuleId = capsule.id;
    }

    return NextResponse.json({
      ...result,
      ...(capsuleId ? { capsuleId } : {}),
    });
  } catch (error) {
    logger.error('Voice capsule error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to format capsule' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
