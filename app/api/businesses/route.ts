/**
 * Multi-Business Owner API Routes
 *
 * GET /api/businesses - List all owned businesses
 * POST /api/businesses - Create new child business
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 *
 * FAILURE MODE: Returns 500 if database connection fails
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import {
  isMultiBusinessOwner,
  getOwnedBusinesses,
  createChildBusiness
} from '@/lib/multi-business';
import { z } from 'zod';

/**
 * GET /api/businesses
 *
 * List all businesses owned by the authenticated multi-business owner.
 *
 * Query Parameters:
 * - stats: boolean - Include quick statistics for each business
 *
 * Returns:
 * - 200: { businesses: OwnedBusiness[], activeBusiness: string | null }
 * - 401: Not authenticated
 * - 403: User is not a multi-business owner
 * - 500: Server error
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify multi-business owner status
    const isMBO = await isMultiBusinessOwner(userId);
    if (!isMBO) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Multi-business owner access required' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get('stats') === 'true';

    // Get owned businesses
    const businesses = await getOwnedBusinesses(userId, includeStats);

    // Get active business from user record
    const { prisma } = await import('@/lib/prisma');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { activeOrganizationId: true }
    });

    return NextResponse.json({
      businesses,
      activeBusiness: user?.activeOrganizationId || null
    });

  } catch (error) {
    console.error('[GET /api/businesses] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to fetch businesses'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/businesses
 *
 * Create a new child business for the authenticated multi-business owner.
 *
 * Body:
 * - name: string (2-100 characters, required) - Business name
 * - displayName: string (optional) - Custom display name
 *
 * Returns:
 * - 201: { business: OwnedBusiness }
 * - 400: Invalid request body
 * - 401: Not authenticated
 * - 403: User is not a multi-business owner
 * - 500: Server error
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify multi-business owner status
    const isMBO = await isMultiBusinessOwner(userId);
    if (!isMBO) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Multi-business owner access required' },
        { status: 403 }
      );
    }

    // Validate request body
    const createBusinessSchema = z.object({
      name: z.string()
        .min(2, 'Business name must be at least 2 characters')
        .max(100, 'Business name must not exceed 100 characters'),
      displayName: z.string().optional()
    });

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const validationResult = createBusinessSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          message: validationResult.error.errors[0]?.message || 'Invalid request body'
        },
        { status: 400 }
      );
    }

    const { name, displayName } = validationResult.data;

    // Create child business
    const business = await createChildBusiness(userId, { name, displayName });

    return NextResponse.json(
      { business },
      { status: 201 }
    );

  } catch (error) {
    console.error('[POST /api/businesses] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to create business'
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
