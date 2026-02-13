/**
 * Multi-Business Owner - Switch Active Business API
 *
 * PATCH /api/businesses/switch - Switch the active business context
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
  setActiveOrganization
} from '@/lib/multi-business';
import { z } from 'zod';

/**
 * PATCH /api/businesses/switch
 *
 * Switch the active business context for a multi-business owner.
 * Pass organizationId to switch to a specific business, or null for master overview.
 *
 * Body:
 * - organizationId: string | null - Target organization ID (null = master overview)
 *
 * Returns:
 * - 200: { activeOrganizationId: string | null, business: OwnedBusiness | null }
 * - 400: Invalid request body
 * - 401: Not authenticated
 * - 403: User is not a multi-business owner or doesn't own the organization
 * - 404: Organization not found
 * - 500: Server error
 */
export async function PATCH(request: NextRequest) {
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
    const switchBusinessSchema = z.object({
      organizationId: z.string().nullable()
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

    const validationResult = switchBusinessSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          message: 'organizationId must be a string or null'
        },
        { status: 400 }
      );
    }

    const { organizationId } = validationResult.data;

    // If switching to a specific organization, verify ownership
    if (organizationId) {
      const { prisma } = await import('@/lib/prisma');
      const ownership = await prisma.businessOwnership.findFirst({
        where: {
          ownerId: userId,
          organizationId: organizationId,
          isActive: true
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

      if (!ownership) {
        return NextResponse.json(
          {
            error: 'Forbidden',
            message: 'You do not own this organization or it is inactive'
          },
          { status: 403 }
        );
      }

      // Set active organization
      await setActiveOrganization(userId, organizationId);

      return NextResponse.json({
        activeOrganizationId: organizationId,
        business: {
          id: ownership.id,
          organizationId: ownership.organizationId,
          displayName: ownership.displayName,
          isActive: ownership.isActive,
          billingStatus: ownership.billingStatus,
          monthlyRate: ownership.monthlyRate,
          createdAt: ownership.createdAt.toISOString(),
          updatedAt: ownership.updatedAt.toISOString(),
          organization: ownership.organization
        }
      });
    } else {
      // Switch to master overview (null)
      await setActiveOrganization(userId, null);

      return NextResponse.json({
        activeOrganizationId: null,
        business: null
      });
    }

  } catch (error) {
    console.error('[PATCH /api/businesses/switch] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to switch business'
      },
      { status: 500 }
    );
  }
}
