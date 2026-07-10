/**
 * Video model catalog + tier resolver.
 * Catalog is DATA — update entries as fal's lineup/pricing changes; never hardcode
 * model ids elsewhere. Pricing verified 2026-07-10 against live fal model pages
 * (SYN-1075 live run caught Wan 2.5 + Hailuo 2.3 retired from fal — "Path
 * /v2.5/text-to-video not found"). Verify at deploy.
 */
import { AspectRatio, ModelTier, VideoModelSpec } from './types';

export const VIDEO_MODELS: VideoModelSpec[] = [
  {
    id: 'bytedance/seedance-2.0/fast/text-to-video',
    name: 'Seedance 2.0 Fast',
    provider: 'fal',
    tier: 'draft',
    costPerSecondUsd: 0.2419,
    maxDurationSeconds: 15,
    aspectRatios: ['9:16', '1:1', '16:9'],
    supportsImageInput: false,
    supportsAudio: true,
    strengths: ['cheapest live tier', 'fast', 'native audio included'],
    weaknesses: [
      'avoid for real-face likeness work (playbook: prefer face-safe models)',
    ],
    bestFor: 'iteration drafts and batch variant exploration',
  },
  {
    id: 'bytedance/seedance-2.0/fast/image-to-video',
    name: 'Seedance 2.0 Fast I2V',
    provider: 'fal',
    tier: 'draft',
    costPerSecondUsd: 0.2419,
    maxDurationSeconds: 15,
    aspectRatios: ['9:16', '1:1', '16:9'],
    supportsImageInput: true,
    supportsAudio: true,
    strengths: ['cheapest live image-to-video', 'native audio included'],
    weaknesses: [
      'avoid for real-face likeness work (playbook: prefer face-safe models)',
    ],
    bestFor: 'animating product stills cheaply',
  },
  {
    id: 'bytedance/seedance-2.0/text-to-video',
    name: 'Seedance 2.0',
    provider: 'fal',
    tier: 'standard',
    costPerSecondUsd: 0.3034,
    maxDurationSeconds: 15,
    aspectRatios: ['9:16', '1:1', '16:9'],
    supportsImageInput: false,
    supportsAudio: true,
    strengths: [
      'cinematic output with native audio',
      'multi-shot editing',
      'director-level camera control',
    ],
    weaknesses: [
      'avoid for real-face likeness work (playbook: prefer face-safe models)',
    ],
    bestFor: 'standard-quality social clips with strong camera work',
  },
  {
    id: 'fal-ai/kling-video/v3/pro/text-to-video',
    name: 'Kling 3 Pro',
    provider: 'fal',
    tier: 'premium',
    costPerSecondUsd: 0.168,
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
