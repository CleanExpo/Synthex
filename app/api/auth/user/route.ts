/**
 * Get Current User API Route
 * GET /api/auth/user
 * PUT /api/auth/user
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies, unauthorizedResponse } from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schema for user update
const userUpdateSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').max(100, 'Name too long').optional(),
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    emailNotifications: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
    language: z.string().max(10).optional(),
    timezone: z.string().max(50).optional(),
  }).passthrough().optional(),
}).strict();

export async function GET(request: NextRequest) {
  try {
    // Authenticate via centralised auth (JWT verification)
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    try {
      // Get user data
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          emailVerified: true,
          createdAt: true,
          lastLogin: true,
          preferences: true,
          organizationId: true,
          isMultiBusinessOwner: true,
          activeOrganizationId: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              plan: true
            }
          },
          // Include counts for related data
          _count: {
            select: {
              campaigns: true,
              projects: true,
              ownedBusinesses: true,
              notifications: {
                where: { read: false }
              }
            }
          }
        }
      });

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // Return user data
      return NextResponse.json({
        success: true,
        user: {
          ...user,
          unreadNotifications: user._count.notifications,
          totalCampaigns: user._count.campaigns,
          totalProjects: user._count.projects,
          ownedBusinessCount: user._count.ownedBusinesses
        }
      });
    } catch (dbError) {
      console.error('Database unavailable:', dbError);
      return NextResponse.json(
        { error: 'Database temporarily unavailable' },
        { status: 503 }
      );
    }

  } catch (error: unknown) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 }
    );
  }
}

/**
 * Update Current User API Route
 * PUT /api/auth/user
 */
export async function PUT(request: NextRequest) {
  try {
    // Authenticate via centralised auth
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    // Parse and validate request body
    const body = await request.json();
    const validationResult = userUpdateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const { name, preferences } = validationResult.data;

    // Update user with validated data
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined && { name }),
        ...(preferences !== undefined && { preferences: preferences as object })
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        emailVerified: true,
        preferences: true
      }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: userId,
        action: 'user_profile_update',
        resource: 'user',
        resourceId: userId,
        category: 'data',
        outcome: 'success',
        details: {
          updatedFields: Object.keys(body)
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });

  } catch (error: unknown) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Failed to update user data' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
