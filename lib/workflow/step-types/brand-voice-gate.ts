import type { WorkflowStepDefinition, StepContext, StepResult } from '../types';
import {
  extractDraftFromPriorOutputs,
  runBrandVoiceGate,
} from '@/lib/agency/brand-voice-gate';
import prisma from '@/lib/prisma';

export async function execute(
  stepDef: WorkflowStepDefinition,
  context: StepContext
): Promise<StepResult> {
  const draft = extractDraftFromPriorOutputs(context.priorOutputs);
  let voiceTag: string | undefined;
  let antiPatterns: string[] | undefined;

  if (context.organizationId) {
    const dna = await prisma.brandDNA.findUnique({
      where: { organizationId: context.organizationId },
      select: { brandVoice: true },
    });
    const bv = dna?.brandVoice as Record<string, unknown> | null;
    if (bv) {
      voiceTag = typeof bv.voiceTag === 'string' ? bv.voiceTag : undefined;
      antiPatterns = Array.isArray(bv.antiPatterns)
        ? (bv.antiPatterns as string[])
        : undefined;
    }
  }

  const result = runBrandVoiceGate({ content: draft, voiceTag, antiPatterns });
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
      draftLength: draft.length,
    },
    confidenceScore: result.score / 100,
    requiresApproval: !pass,
  };
}
