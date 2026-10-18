/**
 * User Avatar API Route
 * POST /api/user/avatar - Upload avatar image
 * DELETE /api/user/avatar - Remove avatar image
 *
 * AUTH: Uses `getUserIdFromRequestOrCookies()` for cookie-based JWT auth.
 * STORAGE: Uses lib/storage/platform-storage (files under public/uploads/<userId>/).
 * DB: Uses Prisma `User.avatar` field (migrated from Supabase `profiles`
 * table to fix FK constraint violations for OAuth users — UNI-839).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  uploadToStorage,
  deleteFromStorage,
} from '@/lib/storage/platform-storage';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('avatar') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const validTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an image file.' },
        { status: 400 }
      );
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 2MB.' },
        { status: 400 }
      );
    }

    // Convert File to ArrayBuffer then to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Stored under public/uploads/<userId>/ — scoped to the caller
    const fileExt = file.name.split('.').pop();
    const uploaded = await uploadToStorage(
      userId,
      `avatar.${fileExt}`,
      buffer,
      file.type
    );
    const publicUrl = uploaded.url;

    // Update user avatar in Prisma (NOT Supabase profiles table)
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { avatar: publicUrl },
      });
    } catch (dbError) {
      logger.error('DB update error:', dbError);
      // Clean up uploaded file if DB update fails
      await deleteFromStorage(uploaded.path);
      throw dbError;
    }

    return NextResponse.json({
      success: true,
      avatarUrl: publicUrl,
      // Legacy snake_case alias for backward compatibility
      avatar_url: publicUrl,
      message: 'Avatar uploaded successfully',
    });
  } catch (error: unknown) {
    logger.error('Avatar upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload avatar' },
      { status: 500 }
    );
  }
}

// DELETE avatar
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current avatar URL from Prisma
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    // Only delete files inside the caller's own upload folder; legacy or
    // external avatar URLs are left untouched.
    const ownPrefix = `/uploads/${userId}/`;
    if (user?.avatar?.startsWith(ownPrefix) && !user.avatar.includes('..')) {
      await deleteFromStorage(user.avatar.slice(1));
    }

    // Clear avatar in Prisma
    await prisma.user.update({
      where: { id: userId },
      data: { avatar: null },
    });

    return NextResponse.json({
      success: true,
      message: 'Avatar removed successfully',
    });
  } catch (error: unknown) {
    logger.error('Avatar deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete avatar' },
      { status: 500 }
    );
  }
}
