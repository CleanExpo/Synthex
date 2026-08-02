/**
 * FLUX.2 dev LoRA adapter on fal — SYNCHRONOUS image generation with LoRA composition.
 * Routes: no imageUrls → /fal-ai/flux-2/lora (text-to-image);
 * with imageUrls → /fal-ai/flux-2/lora/edit (edit/inpainting).
 * Auth matches flux-fal: `Authorization: Key ${FAL_API_KEY}`.
 * NOTE: fal fetches image_urls over the public internet — they must be absolute,
 * publicly reachable URLs (deployed host), not localhost.
 */
import { ProviderNotConfiguredError } from './errors';
import { logger } from '@/lib/logger';

const FAL_RUN_BASE = 'https://fal.run';
const MODEL = 'fal-ai/flux-2/lora'; // matches the IMAGE_MODELS registry id (Task 3)

export interface FluxLoraResult {
  imageUrl: string;
  seed?: number;
  model: string;
}

interface FalImagesResponse {
  images?: Array<{ url?: string }>;
  seed?: number;
}

export async function generateFluxLoraImage(opts: {
  prompt: string;
  loras: Array<{ path: string; scale?: number }>;
  imageUrls?: string[];
  seed?: number;
}): Promise<FluxLoraResult> {
  const apiKey = process.env.FAL_API_KEY;
  // Typed so the spend meter can tell a provably-unsent call from one that
  // may have been billed. This guard runs before any fetch.
  if (!apiKey)
    throw new ProviderNotConfiguredError('fal-ai/flux-2/lora', 'FAL_API_KEY');

  const hasRefs = (opts.imageUrls?.length ?? 0) > 0;
  const url = hasRefs
    ? `${FAL_RUN_BASE}/fal-ai/flux-2/lora/edit`
    : `${FAL_RUN_BASE}/fal-ai/flux-2/lora`;

  // Build loras array, omitting scale when undefined
  const loras = opts.loras.map(lora => {
    if (typeof lora.scale === 'number') {
      return { path: lora.path, scale: lora.scale };
    }
    return { path: lora.path };
  });

  const body: Record<string, unknown> = {
    prompt: opts.prompt,
    loras,
  };
  if (hasRefs) body.image_urls = opts.imageUrls;
  if (typeof opts.seed === 'number') body.seed = opts.seed;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error('flux-lora-fal generation failed', {
      status: res.status,
      text,
    });
    throw new Error(`fal flux-lora failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as FalImagesResponse;
  const imageUrl = data.images?.[0]?.url;
  if (!imageUrl) throw new Error('fal flux-lora returned no image');
  return { imageUrl, seed: data.seed, model: MODEL };
}
