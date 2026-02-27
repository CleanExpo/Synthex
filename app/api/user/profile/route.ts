/**
 * User Profile API Route
 * GET /api/user/profile - Get current user profile
 * PUT /api/user/profile - Update user profile
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

export const runtime = 'nodejs';

// Validation schemas
const profileUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  company: z.string().max(100, 'Company name too long').optional().or(z.literal('')),
  role: z.string().max(50, 'Role too long').optional().or(z.literal('')),
  bio: z.string().max(500, 'Bio too long').optional().or(z.literal('')),
  phone: z.string().max(20, 'Phone number too long').regex(/^[+]?[\d\s\-()]*$/, 'Invalid phone format').optional().or(z.literal('')),
  website: z.string().url('Invalid website URL').max(200).optional().or(z.literal('')),
  social_links: z.object({
    twitter: z.string().max(100).optional(),
    linkedin: z.string().max(100).optional(),
    github: z.string().max(100).optional(),
  }).passthrough().optional(),
  // AI model preference (stored in user.settings JSON)
  openrouterModel: z.string().max(100).optional(),
}).strip();

const deleteAccountSchema = z.object({
  confirmation: z.literal('DELETE_MY_ACCOUNT', {
    errorMap: () => ({ message: 'Must confirm with "DELETE_MY_ACCOUNT"' })
  }).optional(),
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
          avatar_url: '',
          company: '',
          role: '',
          bio: '',
          phone: '',
          website: '',
          social_links: {},
        }
      });
    }

    // Map Prisma fields to the profile shape the frontend expects
    return NextResponse.json({
      profile: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        avatar_url: user.avatar || '',
        company: user.company || '',
        role: user.jobRole || '',
        bio: user.bio || '',
        phone: user.phone || '',
        website: user.website || '',
        social_links: (user.socialLinks as Record<string, string>) || {},
        created_at: user.createdAt.toISOString(),
        updated_at: user.updatedAt.toISOString(),
      }
    });
  } catch (error: unknown) {
    console.error('Profile fetch error:', error);
    // Return a minimal default profile instead of 500 error
    return NextResponse.json({
      profile: {
        id: null,
        email: '',
        name: '',
        avatar_url: '',
        company: '',
        role: '',
        bio: '',
      }
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
          details: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const { name, company, role, bio, phone, website, social_links, openrouterModel } = validationResult.data;

    // Build update data — only include defined fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (company !== undefined) updateData.company = company;
    if (role !== undefined) updateData.jobRole = role;
    if (bio !== undefined) updateData.bio = bio;
    if (phone !== undefined) updateData.phone = phone;
    if (website !== undefined) updateData.website = website || null;
    if (social_links !== undefined) updateData.socialLinks = social_links;

    // Merge openrouterModel into user.settings JSON
    if (openrouterModel !== undefined) {
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { settings: true },
      });
      const currentSettings = (existingUser?.settings as Record<string, unknown>) || {};
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

    return NextResponse.json({
      success: true,
      profile: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name || '',
        avatar_url: updatedUser.avatar || '',
        company: updatedUser.company || '',
        role: updatedUser.jobRole || '',
        bio: updatedUser.bio || '',
        phone: updatedUser.phone || '',
        website: updatedUser.website || '',
        social_links: (updatedUser.socialLinks as Record<string, string>) || {},
        updated_at: updatedUser.updatedAt.toISOString(),
      },
      message: 'Profile updated successfully'
    });
  } catch (error: unknown) {
    console.error('Profile update error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to update profile', details: message },
      { status: 500 }
    );
  }
}

// DELETE user account
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require confirmation for account deletion (safety measure)
    try {
      const body = await request.json();
      const validationResult = deleteAccountSchema.safeParse(body);
      if (!validationResult.success || !validationResult.data.confirmation) {
        return NextResponse.json(
          {
            error: 'Account deletion requires confirmation',
            message: 'Send { "confirmation": "DELETE_MY_ACCOUNT" } to confirm'
          },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        {
          error: 'Account deletion requires confirmation',
          message: 'Send { "confirmation": "DELETE_MY_ACCOUNT" } to confirm'
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
      message: 'Account deleted successfully'
    });
  } catch (error: unknown) {
    console.error('Account deletion error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to delete account', details: message },
      { status: 500 }
    );
  }
}
