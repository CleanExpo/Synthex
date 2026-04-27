/**
 * Weekly Autopilot Performance Learning Cron
 *
 * GET /api/cron/autopilot-learn
 * Runs Mondays at 8 AM UTC via Vercel Cron.
 *
 * For each org with autopilot enabled:
 *   1. Analyses last week's published autopilot posts
 *   2. Identifies high/low performing themes
 *   3. Adjusts content mix weights
 *   4. Identifies top posts for repurposing
 *
 * @module app/api/cron/autopilot-learn/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { learnFromPerformance } from '@/lib/autopilot/performance-learner';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
  const auth = verifyCronRequest(request, 'AUTOPILOT_LEARN');
  if (!auth.ok) return auth.response;

  const startTime = Date.now();
  logger.info('cron:autopilot-learn:start', {
    timestamp: new Date().toISOString(),
  });

  try {
    // Find all orgs with autopilot enabled
    const configs = await prisma.autopilotConfig.findMany({
      where: { enabled: true },
      select: { organizationId: true },
    });

    let processed = 0;
    let adjusted = 0;

    for (const config of configs) {
      try {
        const summary = await learnFromPerformance(config.organizationId);
        processed++;
        if (summary) adjusted++;
      } catch (err) {
        logger.warn('cron:autopilot-learn:org-error', {
          orgId: config.organizationId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const duration = Date.now() - startTime;
    logger.info('cron:autopilot-learn:end', {
      processed,
      adjusted,
      durationMs: duration,
    });

    return NextResponse.json({
      success: true,
      orgsProcessed: processed,
      mixesAdjusted: adjusted,
      durationMs: duration,
    });
  } catch (error) {
    logger.error('cron:autopilot-learn:fatal', { error });
    return NextResponse.json(
      { error: 'Autopilot learning cron failed' },
      { status: 500 }
    );
  }
}
