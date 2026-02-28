/**
 * User Avatar API Route
 * POST /api/user/avatar - Upload avatar image
 * DELETE /api/user/avatar - Remove avatar image
 *
 * AUTH: Uses `getUserIdFromRequestOrCookies()` for cookie-based JWT auth.
 * STORAGE: Uses Supabase Storage for file uploads (no FK issues).
 * DB: Uses Prisma `User.avatar` field (migrated from Supabase `profiles`
 * table to fix FK constraint violations for OAuth users — UNI-839).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

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
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
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

    // Create unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    // Convert File to ArrayBuffer then to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const supabase = createServerClient();

    // Upload to Supabase Storage (file storage is fine — no FK constraints)
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    // Update user avatar in Prisma (NOT Supabase profiles table)
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { avatar: publicUrl },
      });
    } catch (dbError) {
      console.error('DB update error:', dbError);
      // Clean up uploaded file if DB update fails
      await supabase.storage.from('avatars').remove([filePath]);
      throw dbError;
    }

    return NextResponse.json({
      success: true,
      avatarUrl: publicUrl,
      // Legacy snake_case alias for backward compatibility
      avatar_url: publicUrl,
      message: 'Avatar uploaded successfully'
    });
  } catch (error: unknown) {
    console.error('Avatar upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload avatar', details: error instanceof Error ? error.message : String(error) },
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

    if (user?.avatar) {
      // Extract file path from URL and delete from storage
      const urlParts = user.avatar.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `avatars/${fileName}`;

      const supabase = createServerClient();
      await supabase.storage.from('avatars').remove([filePath]);
    }

    // Clear avatar in Prisma
    await prisma.user.update({
      where: { id: userId },
      data: { avatar: null },
    });

    return NextResponse.json({
      success: true,
      message: 'Avatar removed successfully'
    });
  } catch (error: unknown) {
    console.error('Avatar deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete avatar', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
