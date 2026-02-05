/**
 * A/B Testing API - Tests Endpoint
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 *
 * Supports creating, listing, and managing A/B tests
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schemas
const CreateTestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  hypothesis: z.string().optional(),
  duration: z.number().min(1).max(90).default(7),
  platform: z.string().optional(),
  targetAudience: z.string().optional(),
  variants: z.array(z.object({
    name: z.string(),
    content: z.string(),
    image: z.string().optional(),
    cta: z.string().optional(),
    hashtags: z.array(z.string()).optional(),
  })).min(2, 'At least 2 variants required'),
  campaignId: z.string().optional(),
});

const UpdateTestSchema = z.object({
  name: z.string().optional(),
  hypothesis: z.string().optional(),
  status: z.enum(['draft', 'running', 'paused', 'completed']).optional(),
  duration: z.number().min(1).max(90).optional(),
});

// Helper to get user ID from auth
async function getUserId(request: NextRequest): Promise<string | null> {
  // Check for auth token in cookies or header
  const authToken = request.cookies.get('auth-token')?.value;
  if (!authToken) return null;

  // In production, verify JWT and extract user ID
  // For now, return a demo user ID if token exists
  return 'demo-user-001';
}

/**
 * GET /api/ab-testing/tests
 * List all A/B tests for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = { userId };
    if (status) {
      where.status = status;
    }

    const [tests, total] = await Promise.all([
      prisma.aBTest.findMany({
        where,
        include: {
          variants: true,
          results: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.aBTest.count({ where }),
    ]);

    // Calculate metrics for each test
    const testsWithMetrics = tests.map((test) => {
      const variants = test.variants.map((variant) => ({
        ...variant,
        conversionRate: variant.impressions > 0
          ? (variant.conversions / variant.impressions) * 100
          : 0,
      }));

      // Calculate sample size and significance
      const totalImpressions = variants.reduce((sum, v) => sum + v.impressions, 0);
      const latestResult = test.results[0];

      return {
        ...test,
        variants,
        metrics: {
          sampleSize: totalImpressions,
          statisticalSignificance: latestResult?.pValue
            ? (1 - latestResult.pValue) * 100
            : 0,
          uplift: latestResult?.uplift || 0,
        },
      };
    });

    return NextResponse.json({
      data: testsWithMetrics,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + tests.length < total,
      },
    });
  } catch (error) {
    console.error('A/B Testing GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tests' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ab-testing/tests
 * Create a new A/B test
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = CreateTestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { variants, ...testData } = validation.data;

    // Create test with variants in a transaction
    const test = await prisma.aBTest.create({
      data: {
        ...testData,
        userId,
        variants: {
          create: variants.map((v, index) => ({
            name: v.name || String.fromCharCode(65 + index), // A, B, C...
            content: v.content,
            image: v.image,
            cta: v.cta,
            hashtags: v.hashtags || [],
          })),
        },
      },
      include: {
        variants: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: test,
    }, { status: 201 });
  } catch (error) {
    console.error('A/B Testing POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create test' },
      { status: 500 }
    );
  }
}
