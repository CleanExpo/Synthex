/**
 * Get Current User API Route
 * GET /api/auth/user
 * PUT /api/auth/user
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserIdFromRequestOrCookies,
  isOwnerEmail,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// Validation schema for user update
const userUpdateSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Name cannot be empty')
      .max(100, 'Name too long')
      .optional(),
    // Strict allowlist of preference keys. Unknown keys (e.g. `role`) are
    // stripped by Zod's default strip behaviour — a profile update can NEVER
    // set a privileged key such as `role`, which the billing/admin gates trust
    // (see lib/billing/plan-access.ts isFullAccessUser). Do NOT add
    // `.passthrough()` here: it would re-open self-serve privilege escalation.
    preferences: z
      .object({
        theme: z.enum(['light', 'dark', 'system']).optional(),
        emailNotifications: z.boolean().optional(),
        pushNotifications: z.boolean().optional(),
        language: z.string().max(10).optional(),
        timezone: z.string().max(50).optional(),
      })
      .optional(),
  })
  .strict();

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
          // Onboarding flags (UNI-920)
          onboardingComplete: true,
          onboardingStep: true,
          businessProfileComplete: true,
          apiKeyConfigured: true,
          apiKeyValid: true,
          timezone: true,
          conversionCopyVariant: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              plan: true,
            },
          },
          // Include counts for related data
          _count: {
            select: {
              campaigns: true,
              projects: true,
              ownedBusinesses: true,
              notifications: {
                where: { read: false },
              },
            },
          },
        },
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const ownerBypass = isOwnerEmail(user.email);

      // Return user data. Owner accounts must not inherit stale setup flags from
      // historical rows because the owner email list is the access authority.
      return NextResponse.json({
        success: true,
        user: {
          ...user,
          onboardingComplete: ownerBypass ? true : user.onboardingComplete,
          businessProfileComplete: ownerBypass
            ? true
            : user.businessProfileComplete,
          apiKeyConfigured: ownerBypass ? true : user.apiKeyConfigured,
          apiKeyValid: ownerBypass ? true : user.apiKeyValid,
          unreadNotifications: user._count.notifications,
          totalCampaigns: user._count.campaigns,
          totalProjects: user._count.projects,
          ownedBusinessCount: user._count.ownedBusinesses,
          // Map camelCase Prisma field to the snake_case key the client reads (SYN-528)
          conversion_copy_variant: user.conversionCopyVariant ?? 'control',
        },
      });
    } catch (dbError) {
      logger.error('Database unavailable:', dbError);
      return NextResponse.json(
        { error: 'Database temporarily unavailable' },
        { status: 503 }
      );
    }
  } catch (error: unknown) {
    logger.error('Get user error:', error);
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
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, preferences } = validationResult.data;

    // Merge the validated (allowlisted) preference keys onto the stored
    // preferences server-side. Privileged keys such as `role` live only in the
    // existing stored object and are NEVER copied from the request — this
    // preserves any legitimately-set role while making self-serve escalation
    // impossible even if a raw key slipped past validation.
    let mergedPreferences: Record<string, unknown> | undefined;
    if (preferences !== undefined) {
      const existing = await prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
      });
      const storedPreferences =
        (existing?.preferences as Record<string, unknown> | null) ?? {};
      mergedPreferences = { ...storedPreferences, ...preferences };
    }

    // Update user with validated data
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined && { name }),
        ...(mergedPreferences !== undefined && {
          preferences: mergedPreferences as object,
        }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        emailVerified: true,
        preferences: true,
      },
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
          updatedFields: Object.keys(body),
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error: unknown) {
    logger.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Failed to update user data' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
