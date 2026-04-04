/**
 * Media Upload API
 *
 * POST /api/media/upload
 * Accepts multipart/form-data with a `file` field.
 * Validates file type and size, uploads to Supabase Storage,
 * and returns the public URL.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL (PUBLIC)
 * - SUPABASE_SERVICE_ROLE_KEY (SECRET)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/media/upload/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import { validateFile, uploadToStorage } from '@/lib/storage/supabase-storage';

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
  const validationError = validateFile({ size: file.size, type: file.type });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // -- Upload to Supabase Storage -----------------------------------------
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadToStorage(userId, file.name, buffer, file.type);

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    logger.error(
      '[media/upload] Upload error:',
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
