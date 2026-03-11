/**
 * E-E-A-T Asset Generation API (Phase 90)
 *
 * POST /api/eeat/v2/assets — generate E-E-A-T asset plan for given content (no DB persistence)
 *
 * @module app/api/eeat/v2/assets/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { RateLimiter } from '@/lib/rate-limit';
import { scoreEEATContent } from '@/lib/eeat/content-scorer';
import { generateEEATAssets } from '@/lib/eeat/asset-generator';
import { logger } from '@/lib/logger';

// ─── Rate limiter — 20 req/min ────────────────────────────────────────────────

const rateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 20,
  identifier: (req: NextRequest) => {
    const ip =
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      'unknown';
    return `eeat-v2-assets:${ip}`;
  },
});

// ─── Validation schema ────────────────────────────────────────────────────────

const PostSchema = z.object({
  text: z.string().min(1, 'Content is required'),
});

// ─── POST — generate asset plan ───────────────────────────────────────────────

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

    const { text } = parsed.data;

    // 4. Score content then generate assets
    const audit = scoreEEATContent(text);
    const assets = generateEEATAssets(audit);

    return NextResponse.json(assets);
  } catch (error) {
    logger.error('E-E-A-T v2 assets error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to generate E-E-A-T assets' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
