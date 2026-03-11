/**
 * ROI Report API
 *
 * @description Get ROI calculations and metrics.
 *
 * GET /api/roi - Get ROI report
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import { ROIService } from '@/lib/roi/roi-service';
import { prisma } from '@/lib/prisma';
import { isSurfaceAvailable } from '@/lib/bayesian/feature-limits';
import { getCampaignROIWeights } from '@/lib/bayesian/surfaces/campaign-roi';
import { registerObservationSilently } from '@/lib/bayesian/fallback';


// =============================================================================
// GET - ROI Report
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    const filters: {
      platform?: string;
      startDate?: Date;
      endDate?: Date;
    } = {};

    if (platform) {
      filters.platform = platform;
    }
    if (startDateStr) {
      filters.startDate = new Date(startDateStr);
    }
    if (endDateStr) {
      filters.endDate = new Date(endDateStr);
    }

    // Resolve plan for BO surface gating
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, plan: true },
    });
    const orgIdForBO = userRecord?.organizationId ?? userId;
    const plan       = (userRecord?.plan ?? 'free').toLowerCase();

    const roiWeightsResult = isSurfaceAvailable(plan, 'campaign_roi')
      ? await getCampaignROIWeights(orgIdForBO)
      : undefined;

    const roiService = new ROIService();
    const report = await roiService.calculateROI(userId, filters, roiWeightsResult?.weights);

    // Register BO observation (fire-and-forget)
    if (roiWeightsResult?.source === 'bo') {
      const rawTarget = report.overall.overallROI;
      const target = Math.max(0, Math.min(1, rawTarget / 100));
      void registerObservationSilently(
        'campaign_roi',
        orgIdForBO,
        {
          youtubeAllocation:   roiWeightsResult.weights.youtubeAllocation,
          instagramAllocation: roiWeightsResult.weights.instagramAllocation,
          tiktokAllocation:    roiWeightsResult.weights.tiktokAllocation,
          twitterAllocation:   roiWeightsResult.weights.twitterAllocation,
          facebookAllocation:  roiWeightsResult.weights.facebookAllocation,
          linkedinAllocation:  roiWeightsResult.weights.linkedinAllocation,
          pinterestAllocation: roiWeightsResult.weights.pinterestAllocation,
          redditAllocation:    roiWeightsResult.weights.redditAllocation,
        },
        target,
        { overallROI: report.overall.overallROI, netProfit: report.overall.netProfit },
      );
    }

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('ROI API GET error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to calculate ROI' },
      { status: 500 }
    );
  }
}
