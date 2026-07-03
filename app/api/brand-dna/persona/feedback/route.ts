/**
 * Brand persona training loop — feedback endpoint (#8).
 *
 *   POST /api/brand-dna/persona/feedback
 *
 * Takes owner feedback on the brand voice/persona, refines the BRAND-LEVEL
 * profile held in the BrandDNA JSON columns (brandVoice / persona), persists the
 * update back to those SAME columns (no new model/column), and closes the loop by
 * scoring a refined voice sample against the updated profile via the existing
 * quality-scorer. AI is reached only through getAIProvider().
 *
 * Ordering (repo norm): 401 (no session) → 403 (no org) → 400 (bad body)
 *   → 404 (no BrandDNA) → 200.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { defineRoute } from '@/lib/api/define-route';
import { logger } from '@/lib/logger';
import {
  refineBrandPersona,
  brandVoiceToScorerProfile,
} from '@/lib/brand-dna/persona-refiner';
import { QualityScorer } from '@/lib/brand-voice/quality-scorer';
import type { BrandVoice, BrandPersona } from '@/lib/brand-dna/types';

export const runtime = 'nodejs';

const feedbackSchema = z.object({
  feedback: z.string().min(3).max(2000),
  voiceSamples: z.array(z.string().min(1).max(1000)).max(25).optional(),
});

// Defaults mirror lib/brand-dna/extractor.ts so a sparse JSON column still
// yields a well-formed profile to refine.
const DEFAULT_VOICE: BrandVoice = {
  formality: 2,
  boldness: 3,
  tone: 'friendly and approachable',
  samplePhrases: [],
};
const DEFAULT_PERSONA: BrandPersona = {
  ageRange: '',
  values: [],
  painPoints: [],
  description: '',
};

export const POST = defineRoute(
  {
    body: feedbackSchema,
    serverErrorMessage: 'Failed to refine brand persona',
    onError: error =>
      logger.error('brand-dna: persona feedback failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
  },
  async ({ body }, { clientId }) => {
    const brandDna = await prisma.brandDNA.findUnique({
      where: { organizationId: clientId },
      select: {
        businessName: true,
        brandVoice: true,
        persona: true,
      },
    });

    if (!brandDna) {
      return NextResponse.json(
        { error: 'Brand DNA not yet extracted' },
        { status: 404 }
      );
    }

    // The JSON columns are loosely typed; coalesce to well-formed defaults.
    const currentVoice: BrandVoice = {
      ...DEFAULT_VOICE,
      ...((brandDna.brandVoice as Partial<BrandVoice> | null) ?? {}),
    };
    const currentPersona: BrandPersona = {
      ...DEFAULT_PERSONA,
      ...((brandDna.persona as Partial<BrandPersona> | null) ?? {}),
    };

    const refined = await refineBrandPersona({
      brandVoice: currentVoice,
      persona: currentPersona,
      feedback: body.feedback,
      voiceSamples: body.voiceSamples,
    });

    // Persist back to the SAME JSON columns — no new table/column.
    await prisma.brandDNA.update({
      where: { organizationId: clientId },
      data: {
        brandVoice: refined.brandVoice as unknown as object,
        persona: refined.persona as unknown as object,
        lastRefreshedAt: new Date(),
      },
    });

    // Close the loop: the refined voice samples feed the existing scorer. We
    // score the most representative refined sample against the updated profile so
    // the caller sees how the new voice grades. No sample → null score.
    const sampleToScore = refined.brandVoice.samplePhrases[0] ?? null;
    let score = null;
    if (sampleToScore) {
      const profile = brandVoiceToScorerProfile(
        refined.brandVoice,
        brandDna.businessName
      );
      score = await new QualityScorer().scoreContent(sampleToScore, profile);
    }

    return NextResponse.json({
      brandVoice: refined.brandVoice,
      persona: refined.persona,
      rationale: refined.rationale,
      scoredSample: sampleToScore,
      score,
    });
  }
);
