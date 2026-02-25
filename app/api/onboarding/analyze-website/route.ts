/**
 * Website Analysis API Route
 *
 * Scrapes a business website and uses AI to extract structured business details
 * for the onboarding flow. Does NOT save to database — analysis only.
 *
 * POST /api/onboarding/analyze-website
 * Body: { url: string, businessName: string }
 * Returns: WebsiteAnalysisResult
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser } from '@/lib/supabase-server';
import { analyzeWebsite } from '@/lib/ai/website-analyzer';
import { logger } from '@/lib/logger';

// ============================================================================
// VALIDATION
// ============================================================================

const analyzeSchema = z.object({
  url: z.string().url('Please enter a valid URL'),
  businessName: z.string().min(1, 'Business name is required').max(200),
});

// ============================================================================
// RATE LIMITING (simple in-memory for now)
// ============================================================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

// ============================================================================
// POST — Analyze Website
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Parse and validate input
    const rawBody = await request.json();
    const validation = analyzeSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { url, businessName } = validation.data;

    // Normalize URL — ensure it has a protocol
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;

    logger.info('Website analysis requested', {
      userId: user.id,
      url: normalizedUrl,
      businessName,
    });

    // Run analysis
    const result = await analyzeWebsite({
      url: normalizedUrl,
      businessName,
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Analysis failed. Please try again or enter details manually.' },
        { status: 502 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Website analysis error', { error: String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
