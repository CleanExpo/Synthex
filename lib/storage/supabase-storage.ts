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
// A one-hour podcast exported at 192 kbps is roughly 86 MB, so the audio cap
// matches the video cap rather than the much smaller image one.
const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100 MB

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

// `video/quicktime` is what an iPhone records. Omitting it rejected the most
// common founder-supplied video file outright.
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const;

// `audio/x-wav` is included alongside `audio/wav` because browsers disagree on
// which one they report for the same .wav file.
const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/aac',
  'audio/ogg',
  'audio/flac',
] as const;

/** A broad kind of media, used to pick both the MIME allowlist and the size cap. */
export type MediaCategory = 'image' | 'video' | 'audio';

const TYPES_BY_CATEGORY: Record<MediaCategory, readonly string[]> = {
  image: ALLOWED_IMAGE_TYPES,
  video: ALLOWED_VIDEO_TYPES,
  audio: ALLOWED_AUDIO_TYPES,
};

const MAX_SIZE_BY_CATEGORY: Record<MediaCategory, number> = {
  image: MAX_IMAGE_SIZE,
  video: MAX_VIDEO_SIZE,
  audio: MAX_AUDIO_SIZE,
};

/**
 * What a caller gets when it does not name its own policy.
 *
 * Deliberately excludes audio. `validateFile` is shared by an unauthenticated
 * public route (`/api/public/testimonials/[token]`), so a caller must opt in to
 * accepting audio rather than inherit it by default.
 */
const DEFAULT_CATEGORIES: readonly MediaCategory[] = ['image', 'video'];

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
 *
 * The size cap follows the file's category, so a 60 MB video is accepted while a
 * 60 MB image is not.
 *
 * @param file     The file's reported size and MIME type.
 * @param allowed  Which categories this caller accepts. Defaults to images and
 *                 video. Pass `['image', 'video', 'audio']` to accept audio, or
 *                 narrow it (e.g. `['image']`) to reject everything else.
 * @returns `null` if valid, or an error message string.
 */
export function validateFile(
  file: { size: number; type: string },
  allowed: readonly MediaCategory[] = DEFAULT_CATEGORIES
): string | null {
  const category = allowed.find(c => TYPES_BY_CATEGORY[c].includes(file.type));

  if (!category) {
    const allowedTypes = allowed.flatMap(c => [...TYPES_BY_CATEGORY[c]]);
    return `Unsupported file type: ${file.type}. Allowed: ${allowedTypes.join(', ')}`;
  }

  const maxSize = MAX_SIZE_BY_CATEGORY[category];

  if (file.size > maxSize) {
    const limitLabel = `${Math.round(maxSize / (1024 * 1024))} MB`;
    return `File too large. Maximum size for ${category} is ${limitLabel}.`;
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
    console.error(
      `[supabase-storage] Failed to delete ${path}:`,
      error.message
    );
    return false;
  }

  return true;
}
