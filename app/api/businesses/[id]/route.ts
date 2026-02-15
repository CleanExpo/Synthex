/**
 * Multi-Business Owner - Individual Business Management API
 *
 * PATCH /api/businesses/[id] - Update child business settings
 * DELETE /api/businesses/[id] - Soft-delete child business
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 *
 * FAILURE MODE: Returns 500 if database connection fails
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { isMultiBusinessOwner } from '@/lib/multi-business';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

/**
 * PATCH /api/businesses/[id]
 *
 * Update settings for a specific child business.
 *
 * URL Parameters:
 * - id: string - BusinessOwnership ID
 *
 * Body:
 * - displayName: string (optional) - Custom display name
 * - isActive: boolean (optional) - Active status
 *
 * Returns:
 * - 200: { business: OwnedBusiness }
 * - 400: Invalid request body
 * - 401: Not authenticated
 * - 403: User is not a multi-business owner or doesn't own this business
 * - 404: Business not found
 * - 500: Server error
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Get dynamic route parameter (Next.js 15 async params)
    const { id } = await context.params;

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
    const updateBusinessSchema = z.object({
      displayName: z.string().optional(),
      isActive: z.boolean().optional()
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

    const validationResult = updateBusinessSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          message: validationResult.error.errors[0]?.message || 'Invalid request body'
        },
        { status: 400 }
      );
    }

    const updates = validationResult.data;

    // Verify ownership
    const ownership = await prisma.businessOwnership.findFirst({
      where: {
        id,
        ownerId: userId
      }
    });

    if (!ownership) {
      return NextResponse.json(
        {
          error: 'Not Found',
          message: 'Business not found or you do not have access'
        },
        { status: 404 }
      );
    }

    // Update business
    const updatedOwnership = await prisma.businessOwnership.update({
      where: { id },
      data: {
        ...updates,
        updatedAt: new Date()
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            status: true
          }
        }
      }
    });

    return NextResponse.json({
      business: {
        id: updatedOwnership.id,
        organizationId: updatedOwnership.organizationId,
        displayName: updatedOwnership.displayName,
        isActive: updatedOwnership.isActive,
        billingStatus: updatedOwnership.billingStatus,
        monthlyRate: updatedOwnership.monthlyRate,
        createdAt: updatedOwnership.createdAt.toISOString(),
        updatedAt: updatedOwnership.updatedAt.toISOString(),
        organization: updatedOwnership.organization
      }
    });

  } catch (error) {
    console.error('[PATCH /api/businesses/[id]] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to update business'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/businesses/[id]
 *
 * Soft-delete a child business (sets isActive=false, billingStatus='cancelled').
 * If this was the active business, clears the user's activeOrganizationId.
 *
 * URL Parameters:
 * - id: string - BusinessOwnership ID
 *
 * Returns:
 * - 200: { success: true }
 * - 401: Not authenticated
 * - 403: User is not a multi-business owner or doesn't own this business
 * - 404: Business not found
 * - 500: Server error
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Get dynamic route parameter (Next.js 15 async params)
    const { id } = await context.params;

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

    // Verify ownership
    const ownership = await prisma.businessOwnership.findFirst({
      where: {
        id,
        ownerId: userId
      }
    });

    if (!ownership) {
      return NextResponse.json(
        {
          error: 'Not Found',
          message: 'Business not found or you do not have access'
        },
        { status: 404 }
      );
    }

    // Soft-delete the business
    await prisma.businessOwnership.update({
      where: { id },
      data: {
        isActive: false,
        billingStatus: 'cancelled',
        updatedAt: new Date()
      }
    });

    // If this was the active business, clear activeOrganizationId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { activeOrganizationId: true }
    });

    if (user?.activeOrganizationId === ownership.organizationId) {
      await prisma.user.update({
        where: { id: userId },
        data: { activeOrganizationId: null }
      });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[DELETE /api/businesses/[id]] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to delete business'
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
