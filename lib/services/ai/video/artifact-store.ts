/**
 * Persist a provider artifact: download (3 attempts, backoff) -> platform
 * storage (lib/storage/platform-storage) -> media library row. Provider URLs
 * expire.
 */
import { uploadToStorage } from '@/lib/storage/platform-storage';
import { mediaLibraryService } from '@/lib/services/media-library';
import { logger } from '@/lib/logger';

export interface StoreArtifactInput {
  sourceUrl: string;
  userId: string;
  rowId: string; // VideoGeneration id, used as the storage filename
  prompt?: string;
  metadata?: Record<string, unknown>;
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
      // Fix 5: only sleep when there are more attempts remaining
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
  const buffer = await fetchWithRetry(input.sourceUrl);

  let storedUrl: string;
  try {
    const uploaded = await uploadToStorage(
      input.userId,
      `${input.rowId}.mp4`,
      Buffer.from(buffer),
      'video/mp4'
    );
    storedUrl = uploaded.url;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown upload error';
    throw new Error(`video upload failed: ${message}`);
  }

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
