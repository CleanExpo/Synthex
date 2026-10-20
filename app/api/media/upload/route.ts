/**
 * Media Upload API
 *
 * POST /api/media/upload
 * Accepts multipart/form-data with a `file` field.
 * Validates file type and size, stores the file in the private Supabase
 * Storage bucket `media-uploads` (DECISIONS.md FD-7) via
 * lib/storage/object-storage at `${userId}/${Date.now()}-${name}`, and returns
 * a signed URL for it plus its storage path.
 *
 * The bucket is private, so `url` is a signed URL valid for
 * SIGNED_URL_TTL_SECONDS (`expiresAt`); `path` is the durable key.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (SECRET). Without them the route
 *   answers 503 FEATURE_NOT_PROVISIONED and saves nothing.
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/media/upload/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import { validateFile } from '@/lib/storage/platform-storage';
import { notProvisionedResponse } from '@/lib/api/not-provisioned';
import {
  ObjectStorageNotProvisionedError,
  signedUrls,
  upload,
} from '@/lib/storage/object-storage';

const BUCKET = 'media-uploads';

// Callers keep `url` (brand logos, post attachments), so it is long-lived; it
// still expires, and `path` is the durable reference to re-sign from.
const SIGNED_URL_TTL_SECONDS = 365 * 24 * 60 * 60;

// ---------------------------------------------------------------------------
// Validation — multipart form fields (file validated separately)
// ---------------------------------------------------------------------------

const uploadFieldsSchema = z.object({
  folder: z.string().max(255).optional(),
  bucket: z.string().max(100).optional(),
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST — Upload a single file
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // -- Auth ----------------------------------------------------------------
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  // -- Parse multipart form data ------------------------------------------
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request. Expected multipart/form-data.' },
      { status: 400 }
    );
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: 'No file provided. Include a "file" field.' },
      { status: 400 }
    );
  }

  // -- Validate optional form fields --------------------------------------
  const fields = {
    folder: formData.get('folder')?.toString(),
    bucket: formData.get('bucket')?.toString(),
  };
  const parsed = uploadFieldsSchema.safeParse(fields);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // -- Validate file type & size ------------------------------------------
  // This is the authenticated media-library entry point, so it accepts audio as
  // well as images and video. The shared default excludes audio because the
  // public testimonial route also calls validateFile.
  const validationError = validateFile({ size: file.size, type: file.type }, [
    'image',
    'video',
    'audio',
  ]);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // -- Upload to Supabase Storage (bucket media-uploads, FD-7) ------------
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const sanitized = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 100);
    const path = `${userId}/${Date.now()}-${sanitized}`;

    await upload(BUCKET, path, buffer, file.type, { upsert: false });
    const [url] = await signedUrls(BUCKET, [path], SIGNED_URL_TTL_SECONDS);

    return NextResponse.json(
      {
        data: {
          url,
          path,
          size: buffer.length,
          mimeType: file.type,
          expiresAt: new Date(
            Date.now() + SIGNED_URL_TTL_SECONDS * 1000
          ).toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof ObjectStorageNotProvisionedError) {
      return notProvisionedResponse(
        'Media upload is not available: durable file storage is not provisioned.'
      );
    }
    logger.error(
      '[media/upload] Upload error:',
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
