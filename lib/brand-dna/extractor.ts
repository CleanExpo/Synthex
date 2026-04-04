// lib/brand-dna/extractor.ts
// Maps PipelineResult → BrandDNA Prisma upsert payload.
// Also handles full extract-and-persist flow.

import { prisma } from '@/lib/prisma';
import {
  runOnboardingPipeline,
  type PipelineResult,
} from '@/lib/ai/onboarding-pipeline';
import { logger } from '@/lib/logger';
import type { BrandVoice, BrandPersona, BrandSocialProfile } from './types';

// Infer vertical from industry string
function inferVertical(industry: string): string {
  const lower = industry.toLowerCase();
  if (
    lower.includes('café') ||
    lower.includes('cafe') ||
    lower.includes('coffee') ||
    lower.includes('food') ||
    lower.includes('restaurant')
  )
    return 'café';
  if (
    lower.includes('hair') ||
    lower.includes('salon') ||
    lower.includes('beauty') ||
    lower.includes('nail')
  )
    return 'salon';
  if (
    lower.includes('gym') ||
    lower.includes('fitness') ||
    lower.includes('sport') ||
    lower.includes('health')
  )
    return 'gym';
  if (
    lower.includes('trade') ||
    lower.includes('plumb') ||
    lower.includes('electr') ||
    lower.includes('build') ||
    lower.includes('construct')
  )
    return 'tradie';
  return 'other';
}

export interface BrandDNAUpsertPayload {
  organizationId: string;
  businessName: string;
  vertical: string;
  industry: string;
  logoUrl: string | null;
  primaryColour: string | null;
  secondaryColour: string | null;
  neutralColour: string | null;
  brandVoice: BrandVoice;
  persona: BrandPersona;
  offerings: string[];
  socialProfiles: BrandSocialProfile[];
  seoScore: number | null;
  sourceUrl: string;
}

export function mapPipelineResultToBrandDNA(
  result: PipelineResult,
  organizationId: string
): BrandDNAUpsertPayload {
  return {
    organizationId,
    businessName: result.businessName,
    vertical: inferVertical(result.industry),
    industry: result.industry,
    logoUrl: result.logoUrl,
    primaryColour: result.brandColours?.primary ?? null,
    secondaryColour: result.brandColours?.secondary ?? null,
    neutralColour: null, // not in pipeline output — left for user to set
    brandVoice: {
      formality: 2, // default casual — pipeline doesn't score this yet
      boldness: 3,
      tone: result.suggestedTone || 'friendly and approachable',
      samplePhrases: [],
    },
    persona: {
      ageRange: '',
      values: [],
      painPoints: [],
      description: result.targetAudience || '',
    },
    offerings: result.keyTopics ?? [],
    socialProfiles: (result.socialProfiles ?? []).map(p => ({
      platform: p.platform,
      url: p.url,
      verified: p.verified,
    })),
    seoScore: result.seoScore ?? null,
    sourceUrl: result.url,
  };
}

/**
 * Full extraction: runs pipeline + persists BrandDNA.
 * Call this in background after returning the instant preview.
 */
export async function extractAndPersistBrandDNA(
  url: string,
  businessName: string,
  organizationId: string
): Promise<void> {
  try {
    const pipelineResult = await runOnboardingPipeline({ url, businessName });
    const payload = mapPipelineResultToBrandDNA(pipelineResult, organizationId);

    // Cast JSON fields to satisfy Prisma's InputJsonValue type
    const prismaPayload = {
      ...payload,
      brandVoice: payload.brandVoice as unknown as object,
      persona: payload.persona as unknown as object,
      offerings: payload.offerings as unknown as object,
      socialProfiles: payload.socialProfiles as unknown as object,
      lastRefreshedAt: new Date(),
    };

    await prisma.brandDNA.upsert({
      where: { organizationId },
      create: prismaPayload,
      update: prismaPayload,
    });

    logger.info(
      `[brand-dna] Extracted and persisted for org ${organizationId}`
    );
  } catch (error) {
    logger.error('[brand-dna] Full extraction failed', error);
  }
}
