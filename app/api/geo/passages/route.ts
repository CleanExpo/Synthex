/**
 * GEO Passage Extractor API — Extract citable passages from content
 *
 * POST /api/geo/passages
 * Body: { contentText: string }
 * Returns: { passages: CitablePassage[], metadata: { ... } }
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET (CRITICAL)
 *
 * FAILURE MODE: Service will not start if missing
 *
 * @module app/api/geo/passages/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { extractCitablePassages } from '@/lib/geo/passage-extractor';
import { logger } from '@/lib/logger';

const passageSchema = z.object({
  contentText: z.string().min(50, 'Content must be at least 50 characters'),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = passageSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const passages = extractCitablePassages(validation.data.contentText);
    const optimalCount = passages.filter(p => p.isOptimalLength).length;

    return NextResponse.json({
      passages,
      metadata: {
        totalPassages: passages.length,
        optimalPassages: optimalCount,
        optimalRatio: passages.length > 0 ? Math.round((optimalCount / passages.length) * 100) : 0,
        avgScore: passages.length > 0 ? Math.round(passages.reduce((s, p) => s + p.score, 0) / passages.length) : 0,
      },
    });
  } catch (error) {
    logger.error('Passage extraction error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to extract passages' },
      { status: 500 }
    );
  }
}
