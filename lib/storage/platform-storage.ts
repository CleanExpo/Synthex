import { promises as fs } from 'node:fs';
import path from 'node:path';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

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

export interface UploadResult {
  url: string;
  path: string;
  size: number;
  mimeType: string;
}

export function validateFile(
  file: { size: number; type: string },
  allowedTypesOverride?: readonly string[]
): string | null {
  const allowed = allowedTypesOverride ?? ALLOWED_TYPES;
  if (!allowed.includes(file.type)) {
    return `Unsupported file type: ${file.type}. Allowed: ${allowed.join(', ')}`;
  }

  const isVideo = (ALLOWED_VIDEO_TYPES as readonly string[]).includes(
    file.type
  );
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

  if (file.size > maxSize) {
    return `File too large. Maximum size is ${isVideo ? '100 MB' : '10 MB'}.`;
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
