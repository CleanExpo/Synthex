/**
 * Video model catalog + tier resolver.
 * Catalog is DATA — update entries as fal's lineup/pricing changes; never hardcode
 * model ids elsewhere. Pricing observed 2026-06 (fal.ai/pricing); verify at deploy.
 */
import { AspectRatio, ModelTier, VideoModelSpec } from './types';

export const VIDEO_MODELS: VideoModelSpec[] = [
  {
    id: 'fal-ai/wan/v2.5/text-to-video',
    name: 'Wan 2.5',
    provider: 'fal',
    tier: 'draft',
    costPerSecondUsd: 0.05,
    maxDurationSeconds: 10,
    aspectRatios: ['9:16', '1:1', '16:9'],
    supportsImageInput: false,
    supportsAudio: false,
    strengths: ['cheapest', 'fast queue', 'good composition/timing drafts'],
    weaknesses: ['weaker complex motion', 'no audio', 'no image input'],
    bestFor: 'iteration drafts and batch variant exploration',
  },
  {
    id: 'fal-ai/wan/v2.5/image-to-video',
    name: 'Wan 2.5 I2V',
    provider: 'fal',
    tier: 'draft',
    costPerSecondUsd: 0.05,
    maxDurationSeconds: 10,
    aspectRatios: ['9:16', '1:1', '16:9'],
    supportsImageInput: true,
    supportsAudio: false,
    strengths: ['cheapest image-to-video'],
    weaknesses: ['weaker complex motion', 'no audio'],
    bestFor: 'animating product stills cheaply',
  },
  {
    id: 'fal-ai/minimax/hailuo-2.3/text-to-video',
    name: 'MiniMax Hailuo 2.3',
    provider: 'fal',
    tier: 'standard',
    costPerSecondUsd: 0.25,
    maxDurationSeconds: 10,
    aspectRatios: ['9:16', '1:1', '16:9'],
    supportsImageInput: true,
    supportsAudio: false,
    strengths: ['strong human/subject motion', 'good prompt adherence'],
    weaknesses: ['no native audio', 'mid price'],
    bestFor: 'standard-quality social clips with people or products in motion',
  },
  {
    id: 'fal-ai/kling-video/v3/pro/text-to-video',
    name: 'Kling 3 Pro',
    provider: 'fal',
    tier: 'premium',
    costPerSecondUsd: 0.28,
    maxDurationSeconds: 10,
    aspectRatios: ['9:16', '1:1', '16:9'],
    supportsImageInput: true,
    supportsAudio: true,
    strengths: [
      'native audio + lip-sync',
      'strong realism',
      'price-leader at premium',
    ],
    weaknesses: ['queue can be slow at peak'],
    bestFor: 'finished product with dialogue/SFX at the lower premium price',
  },
  {
    id: 'fal-ai/veo3.1',
    name: 'Veo 3.1',
    provider: 'fal',
    tier: 'premium',
    costPerSecondUsd: 0.4,
    maxDurationSeconds: 8,
    aspectRatios: ['9:16', '16:9'],
    supportsImageInput: true,
    supportsAudio: true,
    strengths: ['best realism', 'native audio', 'cinematic lighting'],
    weaknesses: ['most expensive', 'no 1:1'],
    bestFor: 'hero/final assets where quality is the point',
  },
];

export interface ResolveOptions {
  aspectRatio: AspectRatio;
  durationSeconds: number;
  audio?: boolean;
  requiresImage?: boolean;
}

export function resolveModel(
  tier: ModelTier,
  opts: ResolveOptions
): VideoModelSpec {
  const candidates = VIDEO_MODELS.filter(
    m =>
      m.tier === tier &&
      m.aspectRatios.includes(opts.aspectRatio) &&
      (!opts.audio || m.supportsAudio) &&
      (!opts.requiresImage || m.supportsImageInput)
  );
  if (candidates.length === 0) {
    throw new Error(
      `No ${tier} model supports aspect=${opts.aspectRatio}` +
        `${opts.audio ? ' +audio' : ''}${opts.requiresImage ? ' +image' : ''}`
    );
  }
  const within = candidates.filter(
    m => opts.durationSeconds <= m.maxDurationSeconds
  );
  if (within.length === 0) {
    const max = Math.max(...candidates.map(m => m.maxDurationSeconds));
    throw new Error(
      `Requested duration ${opts.durationSeconds}s exceeds ${tier} tier maximum of ${max}s`
    );
  }
  // Cheapest matching model wins within a tier.
  return within.sort((a, b) => a.costPerSecondUsd - b.costPerSecondUsd)[0];
}

export function estimateCostUsd(
  model: VideoModelSpec,
  durationSeconds: number
): number {
  return Math.round(model.costPerSecondUsd * durationSeconds * 10000) / 10000;
}
