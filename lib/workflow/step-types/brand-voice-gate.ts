import type { AeoSurface } from '@/lib/aeo/types';
import type { WorkflowStepDefinition, StepContext, StepResult } from '../types';
import {
  extractDraftFromPriorOutputs,
  resolveBrandSlugFromOrgSlug,
  runBrandVoiceGate,
} from '@/lib/agency/brand-voice-gate';
import prisma from '@/lib/prisma';

export async function execute(
  stepDef: WorkflowStepDefinition,
  context: StepContext
): Promise<StepResult> {
  const draft = extractDraftFromPriorOutputs(context.priorOutputs);
  let voiceTag: string | undefined;
  let orgSlug: string | undefined;

  if (context.organizationId) {
    const dna = await prisma.brandDNA.findUnique({
      where: { organizationId: context.organizationId },
      select: {
        brandVoice: true,
        organization: { select: { slug: true } },
      },
    });
    orgSlug = dna?.organization.slug;
    const bv = dna?.brandVoice as Record<string, unknown> | null;
    if (bv) {
      voiceTag = typeof bv.voiceTag === 'string' ? bv.voiceTag : undefined;
    }
  }

  const brandSlug = orgSlug ? resolveBrandSlugFromOrgSlug(orgSlug) : undefined;
  const surface =
    typeof stepDef.config?.surface === 'string'
      ? (stepDef.config.surface as AeoSurface)
      : undefined;

  if (!brandSlug) {
    return {
      success: true,
      output: {
        gate: 'brand-voice-enforce',
        pass: false,
        score: 0,
        violations: ['brand_unresolved'],
        voiceTag,
        draftLength: draft.length,
      },
      confidenceScore: 0,
      requiresApproval: true,
    };
  }

  const result = await runBrandVoiceGate(
    { content: draft, brand: brandSlug, surface, voiceTag },
    { trackingEnabled: true }
  );
  const threshold =
    typeof stepDef.config?.passScore === 'number'
      ? (stepDef.config.passScore as number)
      : 75;

  const pass = result.pass && result.score >= threshold;

  return {
    success: true,
    output: {
      gate: 'brand-voice-enforce',
      pass,
      score: result.score,
      violations: result.violations,
      voiceTag: result.voiceTag,
      brand: brandSlug,
      draftLength: draft.length,
    },
    confidenceScore: result.score / 100,
    requiresApproval: !pass,
  };
}
