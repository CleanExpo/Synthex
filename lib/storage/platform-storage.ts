import { promises as fs } from 'node:fs';
import path from 'node:path';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
// A one-hour podcast at 192 kbps is ~86 MB, so audio cap matches video.
const MAX_AUDIO_SIZE = 100 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

// `video/quicktime` is what an iPhone records.
// `video/webm` is the standard browser recording format.
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const;

// `audio/x-wav` included alongside `audio/wav` — browsers disagree on
// which MIME type they report for the same .wav file.
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

/** A broad kind of media — used to pick both the MIME allowlist and size cap. */
export type MediaCategory = 'image' | 'video' | 'audio';

const TYPES_BY_CATEGORY: Record<MediaCategory, readonly string[]> = {
  image: ALLOWED_IMAGE_TYPES,
  video: ALLOWED_VIDEO_TYPES,
  audio: ALLOWED_AUDIO_TYPES,
};

const SIZE_BY_CATEGORY: Record<MediaCategory, number> = {
  image: MAX_IMAGE_SIZE,
  video: MAX_VIDEO_SIZE,
  audio: MAX_AUDIO_SIZE,
};

const SIZE_LABEL_BY_CATEGORY: Record<MediaCategory, string> = {
  image: '10 MB',
  video: '100 MB',
  audio: '100 MB',
};

export interface UploadResult {
  url: string;
  path: string;
  size: number;
  mimeType: string;
}

/**
 * Validate a file against the allowed types and size caps.
 *
 * @param file - File metadata to validate.
 * @param categories - Which media categories to allow. Defaults to images +
 *   video (the conservative public-facing policy). Pass `['image','video','audio']`
 *   for authenticated media-library uploads.
 * @returns An error string if invalid, or null if the file is acceptable.
 */
export function validateFile(
  file: { size: number; type: string },
  categories: MediaCategory[] = ['image', 'video']
): string | null {
  const allowed = categories.flatMap(c => [...TYPES_BY_CATEGORY[c]]);

  if (!allowed.includes(file.type)) {
    return `Unsupported file type: ${file.type}. Allowed: ${allowed.join(', ')}`;
  }

  const category = categories.find(c =>
    (TYPES_BY_CATEGORY[c] as readonly string[]).includes(file.type)
  )!;
  const maxSize = SIZE_BY_CATEGORY[category];
  const sizeLabel = SIZE_LABEL_BY_CATEGORY[category];

  if (file.size > maxSize) {
    return `File too large. Maximum size is ${sizeLabel}.`;
  }

  return null;
}

export async function uploadToStorage(
  userId: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string
): Promise<UploadResult> {
  const sanitized = fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 100);

  const relativePath = path.join(
    'uploads',
    userId,
    `${Date.now()}-${sanitized}`
  );
  const absolutePath = path.join(process.cwd(), 'public', relativePath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);

  return {
    url: `/${relativePath.replace(/\\/g, '/')}`,
    path: relativePath.replace(/\\/g, '/'),
    size: buffer.length,
    mimeType,
  };
}

export async function deleteFromStorage(storagePath: string): Promise<boolean> {
  try {
    const absolutePath = path.join(process.cwd(), 'public', storagePath);
    await fs.unlink(absolutePath);
    return true;
  } catch {
    return false;
  }
}
