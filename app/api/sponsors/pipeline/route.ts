/**
 * Pipeline Summary API
 *
 * @description Get sponsor pipeline summary with deal counts by stage.
 *
 * GET /api/sponsors/pipeline - Pipeline summary
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import { SponsorService } from '@/lib/sponsors/sponsor-service';

// =============================================================================
// Auth Helper
// =============================================================================

async function getUserFromRequest(request: NextRequest): Promise<{ id: string } | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    try {
      const token = authHeader.replace('Bearer ', '');
      const decoded = verifyToken(token);
      return { id: decoded.userId };
    } catch {
      // Fall through to cookie check
    }
  }

  const authToken = request.cookies.get('auth-token')?.value;
  if (authToken) {
    try {
      const decoded = verifyToken(authToken);
      return { id: decoded.userId };
    } catch {
      return null;
    }
  }

  return null;
}

// =============================================================================
// GET - Pipeline Summary
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const sponsorService = new SponsorService();
    const pipeline = await sponsorService.getPipelineSummary(user.id);

    return NextResponse.json({
      success: true,
      data: pipeline,
    });
  } catch (error) {
    logger.error('Pipeline GET error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pipeline summary' },
      { status: 500 }
    );
  }
}
