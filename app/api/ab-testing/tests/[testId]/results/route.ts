/**
 * A/B Testing API - Test Results Endpoint
 *
 * Supports fetching and recording test results
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const RecordResultSchema = z.object({
  variantId: z.string(),
  impressions: z.number().min(0).optional(),
  engagement: z.number().min(0).optional(),
  clicks: z.number().min(0).optional(),
  conversions: z.number().min(0).optional(),
});

// Helper to get user ID from auth
async function getUserId(request: NextRequest): Promise<string | null> {
  const authToken = request.cookies.get('auth-token')?.value;
  if (!authToken) return null;
  return 'demo-user-001';
}

// Statistical functions
function calculatePValue(controlConversions: number, controlTotal: number, treatmentConversions: number, treatmentTotal: number): number {
  if (controlTotal === 0 || treatmentTotal === 0) return 1;

  const p1 = controlConversions / controlTotal;
  const p2 = treatmentConversions / treatmentTotal;
  const pooledP = (controlConversions + treatmentConversions) / (controlTotal + treatmentTotal);

  const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / controlTotal + 1 / treatmentTotal));
  if (se === 0) return 1;

  const z = Math.abs(p2 - p1) / se;

  // Approximate p-value using normal distribution
  const pValue = 2 * (1 - normalCDF(z));
  return Math.max(0, Math.min(1, pValue));
}

function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

interface RouteParams {
  params: Promise<{ testId: string }>;
}

/**
 * GET /api/ab-testing/tests/[testId]/results
 * Get results for a specific A/B test
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { testId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');

    // Verify ownership
    const test = await prisma.aBTest.findFirst({
      where: { id: testId, userId },
      include: {
        variants: true,
      },
    });

    if (!test) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    // Get results history
    const results = await prisma.aBTestResult.findMany({
      where: { testId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    // Calculate current statistics
    const variants = test.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      impressions: variant.impressions,
      engagement: variant.engagement,
      clicks: variant.clicks,
      conversions: variant.conversions,
      conversionRate: variant.impressions > 0
        ? (variant.conversions / variant.impressions) * 100
        : 0,
    }));

    // Calculate statistical significance (A vs B comparison)
    let pValue = 1;
    let uplift = 0;
    let winner: string | null = null;

    if (variants.length >= 2) {
      const control = variants[0];
      const treatment = variants[1];

      pValue = calculatePValue(
        control.conversions,
        control.impressions,
        treatment.conversions,
        treatment.impressions
      );

      if (control.conversionRate > 0) {
        uplift = ((treatment.conversionRate - control.conversionRate) / control.conversionRate) * 100;
      }

      if (pValue < 0.05) {
        winner = treatment.conversionRate > control.conversionRate ? 'B' : 'A';
      }
    }

    // Generate time series data for charts
    const timeSeriesData = results.map((r) => ({
      timestamp: r.timestamp,
      conversionRate: r.conversionRate,
      impressions: r.impressions,
      conversions: r.conversions,
    })).reverse();

    return NextResponse.json({
      data: {
        variants,
        statistics: {
          pValue,
          confidence: (1 - pValue) * 100,
          uplift,
          winner,
          isSignificant: pValue < 0.05,
          sampleSize: variants.reduce((sum, v) => sum + v.impressions, 0),
        },
        timeSeries: timeSeriesData,
        recommendations: generateRecommendations(variants, pValue, uplift),
      },
    });
  } catch (error) {
    console.error('A/B Testing results GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch results' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ab-testing/tests/[testId]/results
 * Record new metrics for a test variant
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { testId } = await params;
    const body = await request.json();
    const validation = RecordResultSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    // Verify ownership and test is running
    const test = await prisma.aBTest.findFirst({
      where: { id: testId, userId },
      include: { variants: true },
    });

    if (!test) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    if (test.status !== 'running') {
      return NextResponse.json(
        { error: 'Test is not running' },
        { status: 400 }
      );
    }

    const { variantId, ...metrics } = validation.data;

    // Update variant metrics
    const variant = await prisma.aBTestVariant.update({
      where: { id: variantId },
      data: {
        impressions: { increment: metrics.impressions || 0 },
        engagement: { increment: metrics.engagement || 0 },
        clicks: { increment: metrics.clicks || 0 },
        conversions: { increment: metrics.conversions || 0 },
      },
    });

    // Calculate current stats for all variants
    const allVariants = await prisma.aBTestVariant.findMany({
      where: { testId },
    });

    // Calculate p-value
    let pValue = 1;
    let uplift = 0;

    if (allVariants.length >= 2) {
      const control = allVariants[0];
      const treatment = allVariants[1];

      pValue = calculatePValue(
        control.conversions,
        control.impressions,
        treatment.conversions,
        treatment.impressions
      );

      const controlRate = control.impressions > 0
        ? control.conversions / control.impressions
        : 0;
      const treatmentRate = treatment.impressions > 0
        ? treatment.conversions / treatment.impressions
        : 0;

      if (controlRate > 0) {
        uplift = ((treatmentRate - controlRate) / controlRate) * 100;
      }
    }

    // Record result snapshot
    const result = await prisma.aBTestResult.create({
      data: {
        testId,
        variantId,
        impressions: variant.impressions,
        engagement: variant.engagement,
        clicks: variant.clicks,
        conversions: variant.conversions,
        conversionRate: variant.impressions > 0
          ? (variant.conversions / variant.impressions) * 100
          : 0,
        uplift,
        pValue,
      },
    });

    // Auto-complete test if statistically significant
    if (pValue < 0.05) {
      const winner = allVariants[1].conversions / allVariants[1].impressions >
                     allVariants[0].conversions / allVariants[0].impressions ? 'B' : 'A';

      await prisma.aBTest.update({
        where: { id: testId },
        data: {
          confidence: (1 - pValue) * 100,
          recommendations: generateRecommendations(
            allVariants.map(v => ({
              ...v,
              conversionRate: v.impressions > 0 ? (v.conversions / v.impressions) * 100 : 0,
            })),
            pValue,
            uplift
          ),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        variant,
        result,
        statistics: {
          pValue,
          confidence: (1 - pValue) * 100,
          uplift,
          isSignificant: pValue < 0.05,
        },
      },
    });
  } catch (error) {
    console.error('A/B Testing results POST error:', error);
    return NextResponse.json(
      { error: 'Failed to record result' },
      { status: 500 }
    );
  }
}

function generateRecommendations(
  variants: Array<{ name: string; conversionRate: number; impressions: number }>,
  pValue: number,
  uplift: number
): string[] {
  const recommendations: string[] = [];

  if (variants.length < 2) {
    return ['Add more variants to compare performance'];
  }

  const totalImpressions = variants.reduce((sum, v) => sum + v.impressions, 0);

  if (totalImpressions < 100) {
    recommendations.push('Collect more data - minimum 100 impressions recommended per variant');
  }

  if (pValue >= 0.05) {
    recommendations.push('Results are not yet statistically significant - continue the test');

    if (totalImpressions > 1000) {
      recommendations.push('Consider larger content differences between variants');
    }
  } else {
    const winner = variants[0].conversionRate > variants[1].conversionRate ? 'A' : 'B';
    recommendations.push(`Variant ${winner} is the winner with ${Math.abs(uplift).toFixed(1)}% ${uplift > 0 ? 'improvement' : 'decrease'}`);
    recommendations.push('Consider implementing the winning variant');
  }

  if (Math.abs(uplift) < 5 && pValue < 0.05) {
    recommendations.push('Improvement is small - consider if the effort is worth the gain');
  }

  return recommendations;
}
