/**
 * A/B Testing API - Individual Test Endpoint
 *
 * Supports GET, PUT, DELETE for individual tests
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getUserIdFromCookies } from '@/lib/auth/jwt-utils';

const UpdateTestSchema = z.object({
  name: z.string().optional(),
  hypothesis: z.string().optional(),
  status: z.enum(['draft', 'running', 'paused', 'completed']).optional(),
  duration: z.number().min(1).max(90).optional(),
  winner: z.enum(['A', 'B', 'inconclusive']).optional(),
});

// Helper to get user ID from auth (uses centralized JWT verification)
async function getUserId(_request: NextRequest): Promise<string | null> {
  return getUserIdFromCookies();
}

interface RouteParams {
  params: Promise<{ testId: string }>;
}

/**
 * GET /api/ab-testing/tests/[testId]
 * Get a specific A/B test
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

    const test = await prisma.aBTest.findFirst({
      where: {
        id: testId,
        userId,
      },
      include: {
        variants: true,
        results: {
          orderBy: { timestamp: 'desc' },
          take: 100,
        },
      },
    });

    if (!test) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    // Calculate additional metrics
    const variants = test.variants.map((variant) => ({
      ...variant,
      conversionRate: variant.impressions > 0
        ? (variant.conversions / variant.impressions) * 100
        : 0,
      engagementRate: variant.impressions > 0
        ? (variant.engagement / variant.impressions) * 100
        : 0,
      clickRate: variant.impressions > 0
        ? (variant.clicks / variant.impressions) * 100
        : 0,
    }));

    const totalImpressions = variants.reduce((sum, v) => sum + v.impressions, 0);
    const latestResult = test.results[0];

    return NextResponse.json({
      data: {
        ...test,
        variants,
        metrics: {
          sampleSize: totalImpressions,
          statisticalSignificance: latestResult?.pValue
            ? (1 - latestResult.pValue) * 100
            : 0,
          uplift: latestResult?.uplift || 0,
          timeToSignificance: test.startDate && latestResult?.pValue && latestResult.pValue < 0.05
            ? Math.ceil((new Date().getTime() - test.startDate.getTime()) / (1000 * 60 * 60 * 24))
            : null,
        },
      },
    });
  } catch (error) {
    console.error('A/B Testing GET [testId] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch test' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/ab-testing/tests/[testId]
 * Update a specific A/B test
 */
export async function PUT(
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
    const validation = UpdateTestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingTest = await prisma.aBTest.findFirst({
      where: { id: testId, userId },
    });

    if (!existingTest) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    // Handle status changes
    const updateData: Record<string, unknown> = { ...validation.data };

    if (validation.data.status === 'running' && existingTest.status !== 'running') {
      updateData.startDate = new Date();
    }

    if (validation.data.status === 'completed' && existingTest.status !== 'completed') {
      updateData.endDate = new Date();
    }

    const test = await prisma.aBTest.update({
      where: { id: testId },
      data: updateData,
      include: {
        variants: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: test,
    });
  } catch (error) {
    console.error('A/B Testing PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update test' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ab-testing/tests/[testId]
 * Delete a specific A/B test
 */
export async function DELETE(
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

    // Verify ownership
    const existingTest = await prisma.aBTest.findFirst({
      where: { id: testId, userId },
    });

    if (!existingTest) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    // Delete test (cascades to variants and results)
    await prisma.aBTest.delete({
      where: { id: testId },
    });

    return NextResponse.json({
      success: true,
      message: 'Test deleted successfully',
    });
  } catch (error) {
    console.error('A/B Testing DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete test' },
      { status: 500 }
    );
  }
}
