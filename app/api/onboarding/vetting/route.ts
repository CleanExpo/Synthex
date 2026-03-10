/**
 * POST /api/onboarding/vetting
 *
 * Performs comprehensive business vetting including:
 * - Business information validation
 * - SEO/AEO/GEO/Social health checks
 * - Recommendation generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { performBusinessVetting } from '@/lib/vetting/business-vetting';
import { getAuthUser } from '@/lib/supabase-server';
import { withRateLimit } from '@/lib/middleware/rate-limiter';
import { logger } from '@/lib/logger';

const VettingRequestSchema = z.object({
  businessName: z.string().min(1).max(255),
  website: z.string().url().optional(),
  abnNumber: z.string().max(11).optional(),
  businessLocation: z.string().max(255).optional(),
});

async function vettingHandler(request: NextRequest) {
  // Auth check
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse and validate request
  const body = await request.json();
  const validation = VettingRequestSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const { businessName, website, abnNumber, businessLocation } = validation.data;

  // Perform vetting
  const vettingResult = await performBusinessVetting({
    businessName,
    website,
    abnNumber,
    businessLocation,
  });

  // Return results (don't save to DB - that happens after user reviews)
  return NextResponse.json(vettingResult, { status: 200 });
}

export async function POST(request: NextRequest) {
  // Apply rate limiting: 5 vetting checks per hour per user
  return withRateLimit(request, async () => {
    try {
      return await vettingHandler(request);
    } catch (error) {
      logger.error('[Vetting API] Error:', error);
      return NextResponse.json(
        { error: 'Failed to perform vetting' },
        { status: 500 }
      );
    }
  });
}
