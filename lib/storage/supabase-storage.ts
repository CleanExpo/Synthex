/**
 * Supabase Storage Helper
 *
 * Upload, validate, and delete media files from Supabase Storage.
 * Uses the service-role key for server-side operations.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL (PUBLIC)
 * - SUPABASE_SERVICE_ROLE_KEY: Service-role key for storage access (SECRET)
 *
 * @module lib/storage/supabase-storage
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUCKET = 'post-media';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

const ALLOWED_VIDEO_TYPES = ['video/mp4'] as const;

const ALLOWED_TYPES: readonly string[] = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadResult {
  /** Public URL of the uploaded file */
  url: string;
  /** Storage path within the bucket */
  path: string;
  /** File size in bytes */
  size: number;
  /** MIME type of the uploaded file */
  mimeType: string;
}

// ---------------------------------------------------------------------------
// Service-role client (lazy singleton)
// ---------------------------------------------------------------------------

let _storageClient: ReturnType<typeof createClient> | null = null;

function getStorageClient() {
  if (_storageClient) return _storageClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for storage operations'
    );
  }

  _storageClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return _storageClient;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a file before upload.
 * @returns `null` if valid, or an error message string.
 */
export function validateFile(file: { size: number; type: string }): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `Unsupported file type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(', ')}`;
  }

  const isVideo = (ALLOWED_VIDEO_TYPES as readonly string[]).includes(file.type);
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

  if (file.size > maxSize) {
    const limitLabel = isVideo ? '100 MB' : '10 MB';
    return `File too large. Maximum size is ${limitLabel}.`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/**
 * Upload a file buffer to Supabase Storage.
 *
 * Files are stored under `{userId}/{timestamp}-{sanitisedFileName}` inside
 * the `post-media` bucket. A public URL is returned via `getPublicUrl()`.
 */
export async function uploadToStorage(
  userId: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string
): Promise<UploadResult> {
  const client = getStorageClient();

  // Sanitise the file name: keep only alphanumeric, dashes, underscores, dots
  const sanitised = fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 100);

  const storagePath = `${userId}/${Date.now()}-${sanitised}`;

  const { error } = await client.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = client.storage.from(BUCKET).getPublicUrl(storagePath);

  return {
    url: publicUrl,
    path: storagePath,
    size: buffer.length,
    mimeType,
  };
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Remove a file from Supabase Storage by its path.
 * @returns `true` if deleted, `false` on failure (logged but not thrown).
 */
export async function deleteFromStorage(path: string): Promise<boolean> {
  const client = getStorageClient();

  const { error } = await client.storage.from(BUCKET).remove([path]);

  if (error) {
    console.error(`[supabase-storage] Failed to delete ${path}:`, error.message);
    return false;
  }

  return true;
}
