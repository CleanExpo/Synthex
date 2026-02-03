/**
 * Optimal Times API
 *
 * @description API endpoint for getting optimal posting times:
 * - GET: Get optimal posting times for a platform and date
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 *
 * FAILURE MODE: Returns default optimal times on failure
 */

import { NextRequest, NextResponse } from 'next/server';
import { ResponseOptimizer } from '@/lib/api/response-optimizer';
import { logger } from '@/lib/logger';
import { CalendarService } from '@/src/services/content/calendar-service';

// ============================================================================
// GET - Get Optimal Times
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const platform = searchParams.get('platform');
    const date = searchParams.get('date');
    const count = parseInt(searchParams.get('count') || '5', 10);

    // Validate required fields
    if (!organizationId) {
      return ResponseOptimizer.createErrorResponse('Organization ID is required', 400);
    }

    if (!platform) {
      return ResponseOptimizer.createErrorResponse('Platform is required', 400);
    }

    const targetDate = date ? new Date(date) : new Date();

    const calendar = new CalendarService(organizationId);
    const suggestions = await calendar.getOptimalTimes(platform, targetDate, count);

    return ResponseOptimizer.createResponse(
      {
        success: true,
        platform,
        date: targetDate.toISOString().split('T')[0],
        suggestions: suggestions.map(s => ({
          time: s.suggestedTime,
          score: s.score,
          reason: s.reason,
        })),
      },
      { cacheType: 'api', cacheDuration: 300 }
    );
  } catch (error) {
    logger.error('Failed to get optimal times', { error });
    return ResponseOptimizer.createErrorResponse('Failed to get optimal times', 500);
  }
}
