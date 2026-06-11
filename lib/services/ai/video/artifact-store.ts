/**
 * Persist a provider artifact: download (3 attempts, backoff) -> Supabase
 * storage bucket 'generated-videos' -> media library row. Provider URLs expire.
 */
import { createClient } from '@supabase/supabase-js';
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
      await new Promise(r => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw lastErr;
}

export async function storeArtifact(
  input: StoreArtifactInput
): Promise<{ storedUrl: string }> {
  const buffer = await fetchWithRetry(input.sourceUrl);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const path = `${input.userId}/${input.rowId}.mp4`;
  const { error } = await supabase.storage
    .from('generated-videos')
    .upload(path, buffer, { contentType: 'video/mp4', upsert: true });
  if (error) throw new Error(`supabase upload failed: ${error.message}`);

  const { data: pub } = supabase.storage
    .from('generated-videos')
    .getPublicUrl(path);
  const storedUrl = pub.publicUrl;

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
