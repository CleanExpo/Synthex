/**
 * GEO Tactic Score API — Princeton 9-Tactic Scoring Endpoint
 *
 * POST /api/geo/tactic-score
 * Body: { content: string }
 * Returns: { data: TacticScoreResult }
 *
 * Available to all authenticated users — scoring is cheap compute, not AI.
 * No Prisma persistence — stateless, <100ms target.
 *
 * @module app/api/geo/tactic-score/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { scoreTactics } from '@/lib/geo/tactic-scorer';
import { logger } from '@/lib/logger';

const tacticScoreSchema = z.object({
  content: z.string().min(1, 'Content is required').max(50000, 'Content must be under 50,000 characters'),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Auth — all authenticated users can score (free tier allowed)
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorised', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Validate body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const validation = tacticScoreSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { content } = validation.data;

    // 3. Score — now async to support BO-optimised weights (falls back to heuristics)
    const result = await scoreTactics(content);

    return NextResponse.json(
      { data: result },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store', // Content changes every call
        },
      }
    );
  } catch (error) {
    logger.error('GEO tactic scoring error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to score content' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
