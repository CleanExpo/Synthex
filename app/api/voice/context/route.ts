/**
 * Voice Context API — Generate Writing Context from a Saved Voice Profile
 *
 * POST /api/voice/context
 * Body: { profileId: string, compact?: boolean }
 * Returns: WritingContextResult
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/voice/context/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { RateLimiter } from '@/lib/rate-limit';
import { buildWritingContext } from '@/lib/voice/context-builder';
import type { VoiceFingerprint } from '@/lib/voice/types';
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
    return `voice-context:${ip}`;
  },
});

// ─── Validation schema ────────────────────────────────────────────────────────

const contextSchema = z.object({
  profileId: z.string().min(1, 'profileId is required'),
  compact: z.boolean().optional().default(false),
});

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

    const parsed = contextSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { profileId, compact } = parsed.data;

    // 4. Fetch voice profile — user-scoped
    const profile = await prisma.voiceProfile.findFirst({
      where: {
        id: profileId,
        userId,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Voice profile not found' },
        { status: 404 }
      );
    }

    // 5. Build writing context from stored fingerprint
    const fingerprint = profile.fingerprint as unknown as VoiceFingerprint;
    const result = buildWritingContext(fingerprint, compact);

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Voice context error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to build writing context' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
