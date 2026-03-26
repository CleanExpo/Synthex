/**
 * User Profile API Route
 * GET /api/user/profile    - Get current user profile
 * PUT /api/user/profile    - Update user profile (full update)
 * PATCH /api/user/profile  - Rectify user profile data (GDPR Art.16 — right to rectification, SYN-445)
 * DELETE /api/user/profile - Delete user account
 *
 * AUTH: Uses `getUserIdFromRequestOrCookies()` which reads the httpOnly
 * `auth-token` JWT cookie. Works for both email and OAuth users.
 *
 * DB: Uses Prisma for all database operations (migrated from Supabase
 * `profiles` table to fix FK constraint violations for OAuth users — UNI-839).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { writeDefault } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// Validation schemas
const profileUpdateSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name too long')
      .optional(),
    company: z
      .string()
      .max(100, 'Company name too long')
      .optional()
      .or(z.literal('')),
    role: z.string().max(50, 'Role too long').optional().or(z.literal('')),
    bio: z.string().max(500, 'Bio too long').optional().or(z.literal('')),
    phone: z
      .string()
      .max(20, 'Phone number too long')
      .regex(/^[+]?[\d\s\-()]*$/, 'Invalid phone format')
      .optional()
      .or(z.literal('')),
    website: z
      .string()
      .url('Invalid website URL')
      .max(200)
      .optional()
      .or(z.literal('')),
    socialLinks: z
      .object({
        twitter: z.string().max(100).optional(),
        linkedin: z.string().max(100).optional(),
        github: z.string().max(100).optional(),
      })
      .passthrough()
      .optional(),
    // Accept legacy snake_case field name for backward compatibility
    social_links: z
      .object({
        twitter: z.string().max(100).optional(),
        linkedin: z.string().max(100).optional(),
        github: z.string().max(100).optional(),
      })
      .passthrough()
      .optional(),
    // AI model preference (stored in user.settings JSON)
    openrouterModel: z.string().max(100).optional(),
  })
  .strip();

const deleteAccountSchema = z.object({
  confirmation: z.literal('DELETE_MY_ACCOUNT'),
});

// GET current user profile
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile from Prisma
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        company: true,
        jobRole: true,
        bio: true,
        phone: true,
        website: true,
        socialLinks: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      // Return a default profile object so the UI can still render
      return NextResponse.json({
        profile: {
          id: userId,
          email: '',
          name: '',
          avatarUrl: '',
          company: '',
          role: '',
          bio: '',
          phone: '',
          website: '',
          socialLinks: {},
          // Legacy snake_case aliases for backward compatibility
          avatar_url: '',
          social_links: {},
        },
      });
    }

    // Map Prisma fields to the profile shape the frontend expects
    const avatarUrl = user.avatar || '';
    const socialLinks = (user.socialLinks as Record<string, string>) || {};
    const createdAt = user.createdAt.toISOString();
    const updatedAt = user.updatedAt.toISOString();

    return NextResponse.json({
      profile: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        avatarUrl,
        company: user.company || '',
        role: user.jobRole || '',
        bio: user.bio || '',
        phone: user.phone || '',
        website: user.website || '',
        socialLinks,
        createdAt,
        updatedAt,
        // Legacy snake_case aliases for backward compatibility
        avatar_url: avatarUrl,
        social_links: socialLinks,
        created_at: createdAt,
        updated_at: updatedAt,
      },
    });
  } catch (error: unknown) {
    logger.error('Profile fetch error:', error);
    // Return a minimal default profile instead of 500 error
    return NextResponse.json({
      profile: {
        id: null,
        email: '',
        name: '',
        avatarUrl: '',
        company: '',
        role: '',
        bio: '',
        // Legacy snake_case alias for backward compatibility
        avatar_url: '',
      },
    });
  }
}

// UPDATE user profile
export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate input
    const validationResult = profileUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      name,
      company,
      role,
      bio,
      phone,
      website,
      socialLinks,
      social_links,
      openrouterModel,
    } = validationResult.data;

    // Build update data — only include defined fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (company !== undefined) updateData.company = company;
    if (role !== undefined) updateData.jobRole = role;
    if (bio !== undefined) updateData.bio = bio;
    if (phone !== undefined) updateData.phone = phone;
    if (website !== undefined) updateData.website = website || null;
    // Accept both camelCase and legacy snake_case field names
    const resolvedSocialLinks = socialLinks ?? social_links;
    if (resolvedSocialLinks !== undefined)
      updateData.socialLinks = resolvedSocialLinks;

    // Merge openrouterModel into user.settings JSON
    if (openrouterModel !== undefined) {
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { settings: true },
      });
      const currentSettings =
        (existingUser?.settings as Record<string, unknown>) || {};
      updateData.settings = { ...currentSettings, openrouterModel };
    }

    // Update user in Prisma (user always exists — created at signup/OAuth)
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        company: true,
        jobRole: true,
        bio: true,
        phone: true,
        website: true,
        socialLinks: true,
        updatedAt: true,
      },
    });

    const updatedAvatarUrl = updatedUser.avatar || '';
    const updatedSocialLinks =
      (updatedUser.socialLinks as Record<string, string>) || {};
    const updatedAtStr = updatedUser.updatedAt.toISOString();

    return NextResponse.json({
      success: true,
      profile: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name || '',
        avatarUrl: updatedAvatarUrl,
        company: updatedUser.company || '',
        role: updatedUser.jobRole || '',
        bio: updatedUser.bio || '',
        phone: updatedUser.phone || '',
        website: updatedUser.website || '',
        socialLinks: updatedSocialLinks,
        updatedAt: updatedAtStr,
        // Legacy snake_case aliases for backward compatibility
        avatar_url: updatedAvatarUrl,
        social_links: updatedSocialLinks,
        updated_at: updatedAtStr,
      },
      message: 'Profile updated successfully',
    });
  } catch (error: unknown) {
    logger.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

// PATCH — GDPR Art.16 Right to Rectification (SYN-445)
// Accepts a partial subset of profile fields and updates only those provided.
// Semantically equivalent to PUT for this resource but explicitly signals
// a partial / rectification intent per HTTP spec (RFC 5789).
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return writeDefault(request, async () => {
    try {
      const userId = await getUserIdFromRequestOrCookies(request);
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON body' },
          { status: 400 }
        );
      }

      // Reuse the existing update schema — all fields are already optional
      const validationResult = profileUpdateSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: validationResult.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const {
        name,
        company,
        role,
        bio,
        phone,
        website,
        socialLinks,
        social_links,
        openrouterModel,
      } = validationResult.data;

      // Require at least one field to be present
      const hasFields =
        name !== undefined ||
        company !== undefined ||
        role !== undefined ||
        bio !== undefined ||
        phone !== undefined ||
        website !== undefined ||
        socialLinks !== undefined ||
        social_links !== undefined ||
        openrouterModel !== undefined;

      if (!hasFields) {
        return NextResponse.json(
          { error: 'At least one field must be provided for rectification' },
          { status: 400 }
        );
      }

      // Build update data — only include defined fields (partial update)
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (company !== undefined) updateData.company = company;
      if (role !== undefined) updateData.jobRole = role;
      if (bio !== undefined) updateData.bio = bio;
      if (phone !== undefined) updateData.phone = phone;
      if (website !== undefined) updateData.website = website || null;
      const resolvedSocialLinks = socialLinks ?? social_links;
      if (resolvedSocialLinks !== undefined)
        updateData.socialLinks = resolvedSocialLinks;

      // Merge openrouterModel into user.settings JSON without overwriting other settings
      if (openrouterModel !== undefined) {
        const existingUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { settings: true },
        });
        const currentSettings =
          (existingUser?.settings as Record<string, unknown>) || {};
        updateData.settings = { ...currentSettings, openrouterModel };
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          company: true,
          jobRole: true,
          bio: true,
          phone: true,
          website: true,
          socialLinks: true,
          updatedAt: true,
        },
      });

      const updatedAvatarUrl = updatedUser.avatar || '';
      const updatedSocialLinks =
        (updatedUser.socialLinks as Record<string, string>) || {};
      const updatedAtStr = updatedUser.updatedAt.toISOString();

      return NextResponse.json({
        success: true,
        profile: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name || '',
          avatarUrl: updatedAvatarUrl,
          company: updatedUser.company || '',
          role: updatedUser.jobRole || '',
          bio: updatedUser.bio || '',
          phone: updatedUser.phone || '',
          website: updatedUser.website || '',
          socialLinks: updatedSocialLinks,
          updatedAt: updatedAtStr,
          // Legacy snake_case aliases for backward compatibility
          avatar_url: updatedAvatarUrl,
          social_links: updatedSocialLinks,
          updated_at: updatedAtStr,
        },
        message: 'Profile rectified successfully',
      });
    } catch (error: unknown) {
      logger.error('Profile rectification error:', error);
      return NextResponse.json(
        { error: 'Failed to rectify profile' },
        { status: 500 }
      );
    }
  });
}

// DELETE user account
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require explicit confirmation body before hard-delete (no soft-delete available
    // until status/deletedAt fields are added to the User model — see TODO above)
    const rawBody = await request.json().catch(() => ({}));
    const validationResult = deleteAccountSchema.safeParse(rawBody);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Account deletion requires confirmation',
          details:
            'Send { confirmation: "DELETE_MY_ACCOUNT" } to delete account',
        },
        { status: 400 }
      );
    }

    // Delete user from Prisma (cascade deletes related records)
    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error: unknown) {
    logger.error('Account deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}
