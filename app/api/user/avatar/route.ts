/**
 * User Avatar API Route
 * POST /api/user/avatar - Upload avatar image
 * DELETE /api/user/avatar - Remove avatar image
 *
 * AUTH: Uses `getUserIdFromRequestOrCookies()` for cookie-based JWT auth.
 * STORAGE: Supabase Storage bucket `avatars` via lib/storage/object-storage
 * (DECISIONS.md FD-7), at `${userId}/${Date.now()}.${ext}`. Without storage
 * credentials POST answers 503 FEATURE_NOT_PROVISIONED and saves nothing.
 * After a successful save POST removes the caller's previous bucket object
 * (non-fatal; never another user's).
 * DELETE removes the caller's own bucket object and legacy local file.
 * DB: Uses Prisma `User.avatar` field (migrated from Supabase `profiles`
 * table to fix FK constraint violations for OAuth users — UNI-839).
 */

import { NextRequest, NextResponse } from 'next/server';
import { deleteFromStorage } from '@/lib/storage/platform-storage';
import { notProvisionedResponse } from '@/lib/api/not-provisioned';
import {
  ObjectStorageNotProvisionedError,
  publicUrl,
  remove,
  upload,
} from '@/lib/storage/object-storage';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const BUCKET = 'avatars';

// Extension comes from the validated MIME type, never the client filename.
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/**
 * The image type the bytes actually are (magic numbers), or null. The upload
 * trusts this, never the client-declared file.type (CodeRabbit on #1024).
 */
export function sniffImageType(buf: Buffer): string | null {
  if (
    buf.length >= 8 &&
    buf
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return 'image/jpeg';
  const head6 = buf.subarray(0, 6).toString('latin1');
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'image/gif';
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buf.subarray(8, 12).toString('latin1') === 'WEBP'
  )
    return 'image/webp';
  return null;
}

/**
 * The caller's own object key inside the avatars bucket, or null when the
 * stored avatar URL is anything else (another user's, external, legacy).
 */
function ownAvatarKey(avatar: string, userId: string): string | null {
  const base = `${publicUrl(BUCKET, userId)}/`;
  if (!avatar.startsWith(base)) return null;
  const name = avatar.slice(base.length);
  if (!/^[A-Za-z0-9._-]+$/.test(name) || name.includes('..')) return null;
  return `${userId}/${name}`;
}

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
    const ext = EXT_BY_TYPE[file.type];
    if (!ext) {
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

    // The bytes decide the type: a file declared image/png must really be one.
    const bytes = Buffer.from(await file.arrayBuffer());
    const detected = sniffImageType(bytes);
    if (!detected || EXT_BY_TYPE[detected] !== EXT_BY_TYPE[file.type]) {
      return NextResponse.json(
        { error: 'File content is not the image type it claims to be.' },
        { status: 400 }
      );
    }

    // Read before the row is overwritten, so the old object can be removed.
    const previous = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    const path = `${userId}/${Date.now()}.${EXT_BY_TYPE[detected]}`;
    await upload(BUCKET, path, bytes, detected, { upsert: false });
    const avatarUrl = publicUrl(BUCKET, path);

    try {
      await prisma.user.update({
        where: { id: userId },
        data: { avatar: avatarUrl },
      });
    } catch (dbError: unknown) {
      logger.error('Avatar save failed; removing the uploaded object', {
        error: dbError,
      });
      await remove(BUCKET, [path]).catch(e =>
        logger.error('Avatar cleanup failed', { error: e, path })
      );
      return NextResponse.json(
        { error: 'Failed to save avatar' },
        { status: 500 }
      );
    }

    // Replaced: remove the caller's own previous bucket object. Never
    // another user's; a failure leaves an orphan, not a failed save.
    if (previous?.avatar) {
      try {
        const oldKey = ownAvatarKey(previous.avatar, userId);
        if (oldKey && oldKey !== path) await remove(BUCKET, [oldKey]);
      } catch (error: unknown) {
        logger.error('Previous avatar cleanup failed', {
          error,
          avatar: previous.avatar,
        });
      }
    }

    return NextResponse.json({
      success: true,
      avatarUrl,
      // Legacy snake_case alias read by hooks/use-settings-data.ts
      avatar_url: avatarUrl,
      message: 'Avatar uploaded successfully',
    });
  } catch (error: unknown) {
    if (error instanceof ObjectStorageNotProvisionedError) {
      return notProvisionedResponse(
        'Avatar upload is not available: durable file storage is not provisioned.'
      );
    }
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

    // Only delete the caller's own bucket object. Without storage
    // credentials there is no bucket to match against, as before P3.
    let key: string | null = null;
    if (user?.avatar) {
      try {
        key = ownAvatarKey(user.avatar, userId);
      } catch (error: unknown) {
        if (!(error instanceof ObjectStorageNotProvisionedError)) throw error;
      }
    }
    if (key) await remove(BUCKET, [key]);

    // Legacy local files: only inside the caller's own upload folder;
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
