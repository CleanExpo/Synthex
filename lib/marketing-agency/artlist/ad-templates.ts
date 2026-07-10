/**
 * Ad Template Library (SYN-46)
 *
 * The first two curated ad templates for the Synthex ad studio. Both are
 * powered by the sanctioned Artlist AI substrate (image/video toolkit) paired
 * with the existing ElevenLabs voice + video pipeline. No external ad-platform
 * or paid text-to-video API is wired here — this module is pure data +
 * deterministic logic (prompt rendering, quality validation, regenerate
 * request building). Standing up a live Artlist generation call and publishing
 * to an ad network are separate, founder-gated steps (see SYN-43 / SYN-48).
 *
 * Templates:
 *  1. 3D Product Spin   — product photo -> rotating 3D turntable view, with an
 *                         exploded/schematic variant. Curated, tested prompts.
 *  2. Quick Social Clip — product photo -> 5s vertical scroll-stopper with
 *                         motion, optimised for Stories / Reels.
 *
 * Each template ships: a preview thumbnail, a prompt template with variables
 * (product name, style, mood), quality validation (auto-reject poor
 * generations) and a one-click regenerate request builder.
 */

import type { ProviderMode } from '../types';

export type AdTemplateId = '3d-product-spin' | 'quick-social-clip';

export type AdTemplateVariantId = 'default' | 'exploded-schematic';

export type AdAspectRatio = '16:9' | '9:16' | '1:1';

export type AdTemplateVariableKey = 'productName' | 'style' | 'mood';

/** The three curated variables every template exposes. */
export interface AdTemplateVariableSchema {
  key: AdTemplateVariableKey;
  label: string;
  required: boolean;
  /** Curated presets. Free-text values are also accepted. */
  options?: string[];
  default?: string;
}

export interface AdTemplateVariant {
  id: AdTemplateVariantId;
  name: string;
  description: string;
  /** Tested prompt with {{productName}} / {{style}} / {{mood}} placeholders. */
  promptTemplate: string;
}

/** A single automated quality gate applied to a generation result. */
export type AdQualityCheckStatus = 'pass' | 'reject';

export interface AdQualityThresholds {
  /** Minimum model-reported quality score (0-1) before auto-reject. */
  minQualityScore: number;
  /** Allowed absolute drift, in seconds, from the template duration. */
  durationToleranceSec: number;
}

export interface AdTemplate {
  id: AdTemplateId;
  name: string;
  description: string;
  substrate: 'artlist';
  /** Product photo is the required source input for both templates. */
  sourceInput: 'product-photo';
  outputKind: 'video';
  aspectRatio: AdAspectRatio;
  durationSec: number;
  platforms: string[];
  /** Public preview thumbnail path. */
  thumbnailUrl: string;
  variables: AdTemplateVariableSchema[];
  variants: AdTemplateVariant[];
  quality: AdQualityThresholds;
}

const STYLE_OPTIONS = ['minimal', 'premium', 'playful', 'technical', 'bold'];
const MOOD_OPTIONS = ['calm', 'energetic', 'confident', 'luxurious', 'clean'];

function styleVariable(defaultStyle: string): AdTemplateVariableSchema {
  return {
    key: 'style',
    label: 'Style',
    required: true,
    options: STYLE_OPTIONS,
    default: defaultStyle,
  };
}

function moodVariable(defaultMood: string): AdTemplateVariableSchema {
  return {
    key: 'mood',
    label: 'Mood',
    required: true,
    options: MOOD_OPTIONS,
    default: defaultMood,
  };
}

const productNameVariable: AdTemplateVariableSchema = {
  key: 'productName',
  label: 'Product name',
  required: true,
};

/** The two shipped templates. Order is the library display order. */
export const AD_TEMPLATES: readonly AdTemplate[] = [
  {
    id: '3d-product-spin',
    name: '3D Product Spin',
    description:
      'Turn a single product photo into a seamless rotating 3D turntable view. Includes an exploded/schematic variant for technical products.',
    substrate: 'artlist',
    sourceInput: 'product-photo',
    outputKind: 'video',
    aspectRatio: '1:1',
    durationSec: 8,
    platforms: ['instagram-feed', 'facebook-feed', 'website', 'marketplace'],
    thumbnailUrl: '/ad-templates/3d-product-spin.svg',
    variables: [
      productNameVariable,
      styleVariable('premium'),
      moodVariable('confident'),
    ],
    variants: [
      {
        id: 'default',
        name: 'Turntable Spin',
        description: 'Seamless 360-degree rotation on a clean studio backdrop.',
        promptTemplate:
          'A photorealistic 360-degree turntable rotation of {{productName}}, seamless loop, studio softbox lighting, {{style}} styling, {{mood}} mood, clean seamless backdrop, product centered and fully in frame, smooth constant-speed rotation, sharp focus, high detail, no text, no watermark, commercial product photography.',
      },
      {
        id: 'exploded-schematic',
        name: 'Exploded Schematic',
        description:
          'Components separate into an ordered blueprint-style exploded view.',
        promptTemplate:
          'An exploded technical schematic animation of {{productName}}, components separating and floating apart in an ordered blueprint layout, {{style}} styling, {{mood}} mood, thin annotation lines, isometric engineering view, clean neutral backdrop, precise part alignment, no text labels, no watermark, high-detail industrial visualization.',
      },
    ],
    quality: { minQualityScore: 0.6, durationToleranceSec: 1.5 },
  },
  {
    id: 'quick-social-clip',
    name: 'Quick Social Clip',
    description:
      'Turn a product photo into a 5-second vertical scroll-stopper with motion, optimised for Stories and Reels.',
    substrate: 'artlist',
    sourceInput: 'product-photo',
    outputKind: 'video',
    aspectRatio: '9:16',
    durationSec: 5,
    platforms: [
      'instagram-reels',
      'instagram-stories',
      'tiktok',
      'youtube-shorts',
    ],
    thumbnailUrl: '/ad-templates/quick-social-clip.svg',
    variables: [
      productNameVariable,
      styleVariable('bold'),
      moodVariable('energetic'),
    ],
    variants: [
      {
        id: 'default',
        name: 'Scroll-Stopper',
        description:
          'Dynamic push-in and parallax with a punchy first-frame hook.',
        promptTemplate:
          'A 5-second vertical scroll-stopping social clip of {{productName}}, dynamic push-in and parallax motion, {{style}} styling, {{mood}} mood, punchy first-frame hook, energetic pacing optimized for Stories and Reels, product hero shot centered in the safe zone, high contrast, no text overlay, no watermark, mobile-first 9:16 framing.',
      },
    ],
    quality: { minQualityScore: 0.55, durationToleranceSec: 1 },
  },
] as const;

export function listAdTemplates(): readonly AdTemplate[] {
  return AD_TEMPLATES;
}

export function getAdTemplate(id: string): AdTemplate | undefined {
  return AD_TEMPLATES.find(t => t.id === id);
}

export function getAdTemplateVariant(
  template: AdTemplate,
  variantId: AdTemplateVariantId = 'default'
): AdTemplateVariant | undefined {
  return template.variants.find(v => v.id === variantId);
}

// --- Prompt rendering -------------------------------------------------------

export type AdTemplateVariables = Partial<
  Record<AdTemplateVariableKey, string>
>;

export class AdTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdTemplateError';
  }
}

export interface RenderedAdPrompt {
  templateId: AdTemplateId;
  variantId: AdTemplateVariantId;
  prompt: string;
  aspectRatio: AdAspectRatio;
  durationSec: number;
  substrate: 'artlist';
  resolvedVariables: Record<AdTemplateVariableKey, string>;
}

/**
 * Fill any variables not supplied by the caller with the template defaults.
 * Returns the fully-resolved variable set (or a list of missing required keys).
 */
export function resolveAdTemplateVariables(
  template: AdTemplate,
  input: AdTemplateVariables
):
  | { ok: true; values: Record<AdTemplateVariableKey, string> }
  | { ok: false; missing: AdTemplateVariableKey[] } {
  const values = {} as Record<AdTemplateVariableKey, string>;
  const missing: AdTemplateVariableKey[] = [];

  for (const schema of template.variables) {
    const supplied = input[schema.key]?.trim();
    const resolved = supplied || schema.default;
    if (!resolved) {
      if (schema.required) missing.push(schema.key);
      continue;
    }
    values[schema.key] = resolved;
  }

  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, values };
}

/** Render a template variant into a final Artlist prompt string. */
export function renderAdPrompt(
  templateId: string,
  input: AdTemplateVariables,
  variantId: AdTemplateVariantId = 'default'
): RenderedAdPrompt {
  const template = getAdTemplate(templateId);
  if (!template) {
    throw new AdTemplateError(`Unknown ad template: ${templateId}`);
  }

  const variant = getAdTemplateVariant(template, variantId);
  if (!variant) {
    throw new AdTemplateError(
      `Template "${template.id}" has no variant "${variantId}".`
    );
  }

  const resolved = resolveAdTemplateVariables(template, input);
  if (!resolved.ok) {
    throw new AdTemplateError(
      `Missing required variable(s) for "${template.id}": ${resolved.missing.join(', ')}`
    );
  }

  const prompt = variant.promptTemplate.replace(
    /\{\{\s*(productName|style|mood)\s*\}\}/g,
    (_match, key: AdTemplateVariableKey) => resolved.values[key]
  );

  return {
    templateId: template.id,
    variantId: variant.id,
    prompt,
    aspectRatio: template.aspectRatio,
    durationSec: template.durationSec,
    substrate: 'artlist',
    resolvedVariables: resolved.values,
  };
}

// --- Generation request + regenerate ---------------------------------------

export interface AdGenerationRequest {
  templateId: AdTemplateId;
  variantId: AdTemplateVariantId;
  variables: Record<AdTemplateVariableKey, string>;
  prompt: string;
  aspectRatio: AdAspectRatio;
  durationSec: number;
  substrate: 'artlist';
  providerMode: ProviderMode;
  /** Deterministic seed so a render is reproducible; changes on regenerate. */
  seed: number;
  /** 1-based generation attempt. Increments on each regenerate. */
  attempt: number;
}

function seedFrom(prompt: string, salt: number): number {
  // Small deterministic FNV-1a-style hash; not cryptographic.
  let h = 2166136261 ^ salt;
  for (let i = 0; i < prompt.length; i++) {
    h ^= prompt.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function buildAdGenerationRequest(
  templateId: string,
  input: AdTemplateVariables,
  opts: { variantId?: AdTemplateVariantId; providerMode?: ProviderMode } = {}
): AdGenerationRequest {
  const rendered = renderAdPrompt(
    templateId,
    input,
    opts.variantId ?? 'default'
  );
  return {
    templateId: rendered.templateId,
    variantId: rendered.variantId,
    variables: rendered.resolvedVariables,
    prompt: rendered.prompt,
    aspectRatio: rendered.aspectRatio,
    durationSec: rendered.durationSec,
    substrate: 'artlist',
    providerMode: opts.providerMode ?? 'mock',
    attempt: 1,
    seed: seedFrom(rendered.prompt, 1),
  };
}

/** One-click regenerate: same prompt, next attempt, fresh seed. */
export function buildRegenerateRequest(
  previous: AdGenerationRequest
): AdGenerationRequest {
  const attempt = previous.attempt + 1;
  return {
    ...previous,
    attempt,
    seed: seedFrom(previous.prompt, attempt),
  };
}

// --- Quality validation (auto-reject poor generations) ----------------------

export interface AdGenerationResult {
  status: 'completed' | 'failed';
  widthPx: number;
  heightPx: number;
  durationSec: number;
  /** Model / harness reported quality score, 0-1. */
  qualityScore: number;
}

export interface AdQualityCheck {
  label: string;
  status: AdQualityCheckStatus;
  detail: string;
}

export interface AdQualityVerdict {
  accepted: boolean;
  checks: AdQualityCheck[];
  rejectionReasons: string[];
}

const ASPECT_RATIO_VALUE: Record<AdAspectRatio, number> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1,
};

/**
 * Validate a generation against the template's quality bar. Any failing check
 * auto-rejects the generation (accepted === false) so the caller can trigger a
 * regenerate rather than surface a poor asset.
 */
export function validateAdGeneration(
  template: AdTemplate,
  result: AdGenerationResult
): AdQualityVerdict {
  const checks: AdQualityCheck[] = [];

  // 1. Generation actually completed.
  checks.push(
    result.status === 'completed'
      ? { label: 'status', status: 'pass', detail: 'Generation completed.' }
      : {
          label: 'status',
          status: 'reject',
          detail: 'Generation did not complete.',
        }
  );

  // 2. Non-empty frame.
  const hasPixels = result.widthPx > 0 && result.heightPx > 0;
  checks.push(
    hasPixels
      ? {
          label: 'dimensions',
          status: 'pass',
          detail: `${result.widthPx}x${result.heightPx}`,
        }
      : {
          label: 'dimensions',
          status: 'reject',
          detail: 'Empty or zero-dimension output.',
        }
  );

  // 3. Aspect ratio matches the template intent (5% tolerance).
  const expected = ASPECT_RATIO_VALUE[template.aspectRatio];
  const actual = hasPixels ? result.widthPx / result.heightPx : 0;
  const aspectOk = hasPixels && Math.abs(actual - expected) / expected <= 0.05;
  checks.push(
    aspectOk
      ? {
          label: 'aspectRatio',
          status: 'pass',
          detail: `Matches ${template.aspectRatio}.`,
        }
      : {
          label: 'aspectRatio',
          status: 'reject',
          detail: `Expected ${template.aspectRatio} (${expected.toFixed(2)}), got ${actual.toFixed(2)}.`,
        }
  );

  // 4. Duration within tolerance.
  const durationOk =
    Math.abs(result.durationSec - template.durationSec) <=
    template.quality.durationToleranceSec;
  checks.push(
    durationOk
      ? { label: 'duration', status: 'pass', detail: `${result.durationSec}s` }
      : {
          label: 'duration',
          status: 'reject',
          detail: `Expected ~${template.durationSec}s (±${template.quality.durationToleranceSec}s), got ${result.durationSec}s.`,
        }
  );

  // 5. Quality score above the auto-reject floor.
  const scoreOk = result.qualityScore >= template.quality.minQualityScore;
  checks.push(
    scoreOk
      ? {
          label: 'qualityScore',
          status: 'pass',
          detail: result.qualityScore.toFixed(2),
        }
      : {
          label: 'qualityScore',
          status: 'reject',
          detail: `Below floor ${template.quality.minQualityScore} (got ${result.qualityScore.toFixed(2)}).`,
        }
  );

  const rejectionReasons = checks
    .filter(c => c.status === 'reject')
    .map(c => `${c.label}: ${c.detail}`);

  return {
    accepted: rejectionReasons.length === 0,
    checks,
    rejectionReasons,
  };
}
