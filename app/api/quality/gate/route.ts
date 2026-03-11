/**
 * Content Quality Gate API — lightweight pass/fail check
 *
 * POST /api/quality/gate
 * Body: { text: string, threshold?: number }
 *
 * Returns a quick pass/fail with score and blocking issues.
 * No DB persistence — designed for inline use before publishing.
 * Available on all plans (safety feature).
 *
 * @module app/api/quality/gate/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { RateLimiter } from '@/lib/rate-limit';
import { scoreHumanness } from '@/lib/quality/humanness-scorer';
import { logger } from '@/lib/logger';

// ─── Rate limiter — 60 req/min (lightweight, called before every publish) ─────

const rateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 60,
  identifier: (req: NextRequest) => {
    const ip =
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      'unknown';
    return `quality-gate:${ip}`;
  },
});

// ─── Validation schema ────────────────────────────────────────────────────────

const GateSchema = z.object({
  text: z.string().min(1, 'Content is required'),
  threshold: z.number().min(0).max(100).optional().default(60),
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

    const parsed = GateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { text, threshold } = parsed.data;

    // 4. Run gate check
    const result = scoreHumanness(text, threshold);

    // Build blocking issues from error-severity slop matches (top 5)
    const blockingIssues = result.slopScan.matches
      .filter((m) => m.severity === 'error')
      .slice(0, 5)
      .map((m) => `"${m.phrase}"${m.suggestion ? ` → ${m.suggestion}` : ''}`);

    return NextResponse.json({
      passes: result.passes,
      score: result.score,
      grade: result.grade,
      blockingIssues,
    });
  } catch (error) {
    logger.error('Quality gate error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to run quality gate check' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
