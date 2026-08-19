/**
 * Mechanical brand-voice gate for workflow validation steps (SYN-972 / AT-003).
 * Delegates to lib/aeo/brand-voice-enforce (R1–R9); maps result to StepResult shape.
 */

import { brands, type BrandSlug } from '@unite-group/brand-config';
import {
  enforceBrandVoice,
  type BrandVoiceEnforceDeps,
} from '@/lib/aeo/brand-voice-enforce';
import type { AeoSurface } from '@/lib/aeo/types';

export interface BrandVoiceGateInput {
  content: string;
  brand: BrandSlug;
  surface?: AeoSurface;
  voiceTag?: string;
}

export interface BrandVoiceGateResult {
  pass: boolean;
  score: number;
  violations: string[];
  voiceTag?: string;
}

/** Organisation.slug → BrandConfig.slug (org slugs often differ from brand slugs). */
const ORG_SLUG_TO_BRAND: Readonly<Record<string, BrandSlug>> = {
  'disaster-recovery': 'dr',
  restoreassist: 'ra',
  'restore-assist': 'ra',
  'unite-group': 'unite',
  nrpg: 'nrpg',
  carsi: 'carsi',
  synthex: 'synthex',
};

/**
 * Resolve a portfolio org slug to a BrandSlug for enforceBrandVoice.
 * Returns undefined when the org is not a known portfolio brand.
 */
export function resolveBrandSlugFromOrgSlug(
  orgSlug: string
): BrandSlug | undefined {
  if (orgSlug in brands) return orgSlug as BrandSlug;
  return ORG_SLUG_TO_BRAND[orgSlug];
}

function scoreFromViolations(violationCount: number): number {
  return Math.max(0, 100 - violationCount * 25);
}

/**
 * Run the full R1–R9 mechanical gate and map to workflow StepResult fields.
 */
export async function runBrandVoiceGate(
  input: BrandVoiceGateInput,
  deps?: BrandVoiceEnforceDeps
): Promise<BrandVoiceGateResult> {
  const text = input.content?.trim() ?? '';

  if (!text) {
    return {
      pass: false,
      score: 0,
      violations: ['empty_content'],
      voiceTag: input.voiceTag,
    };
  }

  const enforceResult = await enforceBrandVoice(
    {
      brand: input.brand,
      candidate: text,
      surface: input.surface ?? 'outreach',
    },
    deps
  );

  const violations = enforceResult.reasons;
  return {
    pass: enforceResult.pass,
    score: scoreFromViolations(violations.length),
    violations,
    voiceTag: input.voiceTag,
  };
}

/**
 * Extract draft text from prior workflow step outputs.
 */
export function extractDraftFromPriorOutputs(
  priorOutputs: { output: unknown }[]
): string {
  for (let i = priorOutputs.length - 1; i >= 0; i--) {
    const out = priorOutputs[i].output;
    if (typeof out === 'string' && out.trim()) return out;
    if (out && typeof out === 'object') {
      const o = out as Record<string, unknown>;
      if (typeof o.content === 'string') return o.content;
      if (typeof o.text === 'string') return o.text;
      if (typeof o.generatedContent === 'string') return o.generatedContent;
    }
  }
  return '';
}
