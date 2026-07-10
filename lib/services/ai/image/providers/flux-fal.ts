/**
 * FLUX.2 pro on fal — SYNCHRONOUS image generation/edit. Uses fal.run (not the
 * video queue base). Reference images are passed as `image_urls` to the /edit
 * endpoint. Auth matches the video adapter: `Authorization: Key ${FAL_API_KEY}`.
 * NOTE: fal fetches image_urls over the public internet — they must be absolute,
 * publicly reachable URLs (deployed host), not localhost.
 */
import { logger } from '@/lib/logger';

const FAL_RUN_BASE = 'https://fal.run';
const MODEL = 'fal-ai/flux-2-pro';

export interface FluxResult {
  imageUrl: string;
  seed?: number;
  model: string;
}

interface FalImagesResponse {
  images?: Array<{ url?: string }>;
  seed?: number;
}

export async function generateFluxImage(opts: {
  prompt: string;
  imageUrls?: string[];
  imageSize?: string;
  seed?: number;
}): Promise<FluxResult> {
  const apiKey = process.env.FAL_API_KEY;
  if (!apiKey) throw new Error('FAL_API_KEY not configured');

  const hasRefs = (opts.imageUrls?.length ?? 0) > 0;
  const url = hasRefs
    ? `${FAL_RUN_BASE}/${MODEL}/edit`
    : `${FAL_RUN_BASE}/${MODEL}`;

  const body: Record<string, unknown> = { prompt: opts.prompt };
  if (hasRefs) body.image_urls = opts.imageUrls;
  if (opts.imageSize) body.image_size = opts.imageSize;
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
    logger.error('flux-fal generation failed', { status: res.status, text });
    throw new Error(`fal flux failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as FalImagesResponse;
  const imageUrl = data.images?.[0]?.url;
  if (!imageUrl) throw new Error('fal flux returned no image');
  return { imageUrl, seed: data.seed, model: MODEL };
}
