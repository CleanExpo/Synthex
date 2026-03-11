/**
 * Slop Scan API — Detect AI Tell-Phrases in Content
 *
 * POST /api/voice/slop-scan
 * Body: { text: string }
 * Returns: SlopScanResult — no DB persistence
 *
 * Feature gating: slopScans — free tier gets 3/month (availability check only for MVP;
 * per-month usage counting is deferred to a follow-up task — see 88-02-SUMMARY.md).
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/voice/slop-scan/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { RateLimiter } from '@/lib/rate-limit';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import { isFeatureAvailable } from '@/lib/geo/feature-limits';
import { scanForSlop } from '@/lib/voice/slop-scanner';
import { logger } from '@/lib/logger';

// ─── Rate limiter — 60 req/min (lightweight operation) ───────────────────────

const rateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 60,
  identifier: (req: NextRequest) => {
    const ip =
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      'unknown';
    return `voice-slop-scan:${ip}`;
  },
});

// ─── Validation schema ────────────────────────────────────────────────────────

const slopScanSchema = z.object({
  text: z.string().min(1, 'Text is required'),
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

    const parsed = slopScanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { text } = parsed.data;

    // 4. Feature availability check — MVP: availability only, not per-month counting
    const subscription = await subscriptionService.getSubscription(userId);
    const plan = subscription?.plan ?? 'free';

    if (!isFeatureAvailable(plan, 'slopScans')) {
      return NextResponse.json(
        {
          error: 'Slop Scan is not available on your current plan',
          upgrade: true,
        },
        { status: 403 }
      );
    }

    // 5. Run slop scan
    const result = scanForSlop(text);

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Voice slop scan error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to run slop scan' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
