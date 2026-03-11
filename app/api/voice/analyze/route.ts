/**
 * Voice Analyze API — Extract Voice Fingerprint & Run Slop Scan
 *
 * POST /api/voice/analyze
 * Body: { text: string, name?: string, save?: boolean }
 * Returns: VoiceAnalysisResult + optional profileId if saved
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/voice/analyze/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { RateLimiter } from '@/lib/rate-limit';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import { isFeatureAvailable } from '@/lib/geo/feature-limits';
import { analyzeVoice } from '@/lib/voice/voice-analyzer';
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
    return `voice-analyze:${ip}`;
  },
});

// ─── Validation schema ────────────────────────────────────────────────────────

const analyzeSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  name: z.string().max(255).optional(),
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

    const parsed = analyzeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { text, name, save } = parsed.data;

    // 4. Word count validation — minimum 200 words for fingerprint
    const wordCount = countWords(text);
    if (wordCount < 200) {
      return NextResponse.json(
        { error: 'Minimum 200 words required for fingerprint analysis', wordCount },
        { status: 400 }
      );
    }

    // 5. Feature gate — voiceProfiles required if save=true
    let plan = 'free';
    if (save) {
      const subscription = await subscriptionService.getSubscription(userId);
      plan = subscription?.plan ?? 'free';

      if (!isFeatureAvailable(plan, 'voiceProfiles')) {
        return NextResponse.json(
          {
            error: 'Saving voice profiles requires a Pro plan or higher',
            upgrade: true,
          },
          { status: 403 }
        );
      }
    }

    // 6. Run analysis
    const result = await analyzeVoice(text, { buildContext: true });

    // 7. Optionally persist as VoiceProfile
    let profileId: string | undefined;
    if (save && result.fingerprint.valid && result.fingerprint.fingerprint) {
      // Get orgId from subscription record (may be null for solo users)
      const subscription = await subscriptionService.getSubscription(userId);
      const orgId = (subscription as unknown as { orgId?: string } | null)?.orgId ?? userId;

      const profile = await prisma.voiceProfile.create({
        data: {
          userId,
          orgId,
          name: name ?? `Voice Profile ${new Date().toLocaleDateString('en-AU')}`,
          sampleText: text,
          fingerprint: result.fingerprint.fingerprint as unknown as Prisma.InputJsonValue,
          wordCount,
        },
      });
      profileId = profile.id;
    }

    return NextResponse.json({
      fingerprint: result.fingerprint,
      slopScan: result.slopScan,
      writingContext: result.context,
      clarityScore: result.clarityScore,
      analysedAt: result.analysedAt,
      ...(profileId ? { profileId } : {}),
    });
  } catch (error) {
    logger.error('Voice analyze error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to analyse voice' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
