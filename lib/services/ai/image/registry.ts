/**
 * Image model catalog — DATA. Mirrors lib/services/ai/video/registry.ts.
 * `grounding` marks reference-capable models; Stability/DALL-E are kept but
 * deprecated (they ignore references and are banned by the visual-content-brief
 * skill). Pricing verified 2026-07-11 (fal.ai / bfl.ai). Verify at deploy.
 */
export interface ImageModel {
  id: string;
  provider: 'fal' | 'openai' | 'stability' | 'gemini';
  label: string;
  tier: 'draft' | 'standard' | 'premium';
  costPerMegapixelUsd?: number;
  capabilities: {
    referenceImages: number; // max refs; 0 = text-only
    imageToImage: boolean;
    maxResolution: number; // px, long edge
  };
  grounding: boolean;
  deprecated?: boolean;
}

export const IMAGE_MODELS: ImageModel[] = [
  {
    id: 'fal-ai/flux-2-pro',
    provider: 'fal',
    label: 'FLUX.2 pro',
    tier: 'standard',
    costPerMegapixelUsd: 0.03,
    capabilities: {
      referenceImages: 8,
      imageToImage: true,
      maxResolution: 4096,
    },
    grounding: true,
  },
  {
    id: 'gemini-2.5-flash-image',
    provider: 'gemini',
    label: 'Gemini 2.5 Flash Image',
    tier: 'draft',
    capabilities: {
      referenceImages: 0,
      imageToImage: false,
      maxResolution: 1792,
    },
    grounding: false,
  },
  {
    id: 'stable-diffusion-3',
    provider: 'stability',
    label: 'Stability SD3',
    tier: 'draft',
    capabilities: {
      referenceImages: 0,
      imageToImage: false,
      maxResolution: 1792,
    },
    grounding: false,
    deprecated: true,
  },
  {
    id: 'dall-e-3',
    provider: 'openai',
    label: 'DALL-E 3',
    tier: 'draft',
    capabilities: {
      referenceImages: 0,
      imageToImage: false,
      maxResolution: 1792,
    },
    grounding: false,
    deprecated: true,
  },
];

/** Pick a model. When references are needed, return the first grounding-capable,
 *  non-deprecated model (FLUX.2 pro today). Otherwise honour `preferred` or the
 *  first non-deprecated entry. */
export function selectImageModel(opts: {
  needsReferences: boolean;
  preferred?: string;
}): ImageModel {
  if (opts.needsReferences) {
    const grounded = IMAGE_MODELS.find(m => m.grounding && !m.deprecated);
    if (!grounded)
      throw new Error('no grounding-capable image model registered');
    return grounded;
  }
  if (opts.preferred) {
    const byId = IMAGE_MODELS.find(m => m.id === opts.preferred);
    if (byId) return byId;
  }
  const first = IMAGE_MODELS.find(m => !m.deprecated) ?? IMAGE_MODELS[0];
  return first;
}
