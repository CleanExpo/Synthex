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
  /** True for models that accept a `loras` param (dev-tier fal models only). */
  loras: boolean;
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
    loras: false,
  },
  {
    id: 'fal-ai/flux-2/lora',
    provider: 'fal',
    label: 'FLUX.2 dev LoRA',
    tier: 'standard',
    capabilities: {
      referenceImages: 8,
      imageToImage: true,
      maxResolution: 4096,
    },
    grounding: true,
    loras: true,
  },
  {
    // Nano Banana Pro. Default for the gemini adapter (SYN-1095). `grounding` is
    // false because the adapter sends text parts only — the model itself accepts
    // reference images, so flipping this on is follow-up work in the adapter, not a
    // registry edit. Verified live 2026-07-15: 200 + inlineData on generateContent.
    id: 'gemini-3-pro-image',
    provider: 'gemini',
    label: 'Gemini 3 Pro Image (Nano Banana Pro)',
    tier: 'standard',
    capabilities: {
      referenceImages: 0,
      imageToImage: false,
      maxResolution: 4096,
    },
    grounding: false,
    loras: false,
  },
  {
    // Superseded by gemini-3-pro-image; retained as the GEMINI_IMAGE_MODEL fallback.
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
    loras: false,
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
    loras: false,
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
    loras: false,
    deprecated: true,
  },
];

/** Pick a model. When `needsLora` is set, return the first loras-capable,
 *  non-deprecated model (the ONLY way a `loras: true` entry is ever selected).
 *  When references are needed, return the first grounding-capable,
 *  non-deprecated, non-loras model (FLUX.2 pro today). Otherwise honour
 *  `preferred` or the first non-deprecated, non-loras entry. `loras: true`
 *  entries are excluded from every path except the explicit `needsLora` one. */
export function selectImageModel(opts: {
  needsReferences: boolean;
  needsLora?: boolean;
  preferred?: string;
}): ImageModel {
  if (opts.needsLora) {
    const lora = IMAGE_MODELS.find(m => m.loras && !m.deprecated);
    if (!lora) throw new Error('no loras-capable image model registered');
    return lora;
  }
  if (opts.needsReferences) {
    const grounded = IMAGE_MODELS.find(
      m => m.grounding && !m.loras && !m.deprecated
    );
    if (!grounded)
      throw new Error('no grounding-capable image model registered');
    return grounded;
  }
  if (opts.preferred) {
    const byId = IMAGE_MODELS.find(m => m.id === opts.preferred && !m.loras);
    if (byId) return byId;
  }
  const first = IMAGE_MODELS.find(m => !m.deprecated && !m.loras);
  if (!first) {
    // Structural guarantee: the default path NEVER returns a loras entry,
    // even if every non-loras model were deprecated (CodeRabbit #734).
    throw new Error('no non-LoRA image model available for default selection');
  }
  return first;
}
