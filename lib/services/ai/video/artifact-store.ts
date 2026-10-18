/**
 * Persist a provider artifact (provider URLs expire): download (3 attempts,
 * backoff) -> object storage bucket 'generated-videos' (lib/storage/
 * object-storage, DECISIONS.md FD-7) -> media library row.
 *
 * Without storage credentials storeArtifact throws
 * ArtifactStorageNotProvisionedError before downloading anything, and the fal
 * webhook records the generation as failed with the provider URL kept in
 * metadata. A storage error also throws, so a video is never marked
 * 'rendered' at a URL that holds nothing.
 */
import { FEATURE_NOT_PROVISIONED } from '@/lib/api/not-provisioned';
import {
  ObjectStorageNotProvisionedError,
  publicUrl,
  upload,
} from '@/lib/storage/object-storage';
import { mediaLibraryService } from '@/lib/services/media-library';
import { logger } from '@/lib/logger';

const BUCKET = 'generated-videos';

export interface StoreArtifactInput {
  sourceUrl: string;
  userId: string;
  rowId: string; // VideoGeneration id, used as the storage filename
  prompt?: string;
  metadata?: Record<string, unknown>;
}

export class ArtifactStorageNotProvisionedError extends Error {
  readonly code = FEATURE_NOT_PROVISIONED;
  constructor() {
    super(
      `${FEATURE_NOT_PROVISIONED}: durable video storage is not provisioned; the artifact was not stored.`
    );
    this.name = 'ArtifactStorageNotProvisionedError';
  }
}

async function fetchWithRetry(url: string, attempts = 3): Promise<ArrayBuffer> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`download ${res.status}`);
      return await res.arrayBuffer();
    } catch (err) {
      lastErr = err;
      // Only sleep when there are more attempts remaining.
      if (i < attempts - 1) {
        await new Promise(r => setTimeout(r, 1000 * 2 ** i));
      }
    }
  }
  throw lastErr;
}

export async function storeArtifact(
  input: StoreArtifactInput
): Promise<{ storedUrl: string }> {
  const path = `${input.userId}/${input.rowId}.mp4`;

  // Resolving the URL first needs no network and fails fast when storage is
  // not provisioned, so nothing is downloaded that cannot be kept.
  let storedUrl: string;
  try {
    storedUrl = publicUrl(BUCKET, path);
  } catch (err) {
    if (err instanceof ObjectStorageNotProvisionedError) {
      throw new ArtifactStorageNotProvisionedError();
    }
    throw err;
  }

  const buffer = await fetchWithRetry(input.sourceUrl);
  await upload(BUCKET, path, Buffer.from(buffer), 'video/mp4', {
    upsert: true,
  });

  // Register in the media library; non-fatal if it fails (artifact is stored).
  await mediaLibraryService
    .createAsset(input.userId, {
      type: 'video',
      provider: 'fal',
      url: storedUrl,
      externalId: input.rowId,
      prompt: input.prompt,
      metadata: input.metadata ?? {},
    })
    .catch(e =>
      logger.error('media library registration failed (non-fatal)', { e })
    );

  return { storedUrl };
}
