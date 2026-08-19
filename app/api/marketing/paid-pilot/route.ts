/**
 * POST /api/marketing/paid-pilot — AT-016
 *
 * Generates a single-variable paid pilot test design through the governed
 * `paid-performance-marketer` skill and stores it as a pending-review draft.
 * This route never places spend, creates ad-account objects, or schedules ads.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { invokeSkill } from '@/lib/ai/skills';
import { withAuth } from '@/lib/auth/with-auth';
import { logger } from '@/lib/logger';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { aiGeneration } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/** Phase 1.2 pilot-scale ceilings (AUD monthly). CARSI is feed-only. */
const PILOT_CEILING_AUD = {
  DR: 3_000,
  NRPG: 1_000,
  RestoreAssist: 500,
  CARSI: 0,
  CCW: 0,
} as const;

const paidPilotRequestSchema = z.object({
  brandScope: z.enum(['DR', 'NRPG', 'RestoreAssist', 'CARSI', 'CCW']),
  channel: z.enum([
    'google-search',
    'google-pmax',
    'meta-feed',
    'meta-stories',
    'linkedin-sponsored',
    'apple-search-ads',
  ]),
  adAccountId: z.string().min(1).max(100),
  flywheelPosition: z.string().min(1).max(200),
  proposedSpendAud: z.number().positive().max(3_000),
  pilotCeilingAud: z.number().nonnegative().max(3_000),
  singleVariable: z.string().min(1).max(300),
  attState: z.enum([
    'verified',
    'placeholder',
    'verification-needed',
    'not-applicable',
  ]),
  privacyNutritionState: z
    .enum(['verified', 'placeholder', 'verification-needed', 'not-applicable'])
    .optional(),
  sourceOfTruthJobId: z.string().min(1).max(200),
  reallocationOnKill: z.string().min(1).max(500),
  capitalAuthorisationRef: z.string().min(1).max(300),
  objective: z.string().min(1).max(2_000),
});

function buildPaidPerformancePrompt(
  organizationId: string,
  request: z.infer<typeof paidPilotRequestSchema>
): string {
  return [
    `Organisation ID: ${organizationId}`,
    '',
    'Create a pending-review PaidPerformanceMarketerProposal. Do not place spend, create ads, or schedule a campaign.',
    `- Brand scope: ${request.brandScope}`,
    `- Channel: ${request.channel}`,
    `- Ad account ID: ${request.adAccountId}`,
    `- Flywheel position: ${request.flywheelPosition}`,
    `- Proposed spend (AUD): ${request.proposedSpendAud}`,
    `- Pilot ceiling (AUD): ${request.pilotCeilingAud}`,
    `- Single variable under test: ${request.singleVariable}`,
    `- ATT state: ${request.attState}`,
    `- Privacy Nutrition state: ${request.privacyNutritionState ?? 'not provided'}`,
    `- Source-of-truth job ID: ${request.sourceOfTruthJobId}`,
    `- Re-allocation on kill: ${request.reallocationOnKill}`,
    `- Capital authorisation reference: ${request.capitalAuthorisationRef}`,
    `- Objective: ${request.objective}`,
    '',
    'Return the complete PaidPerformanceMarketerProposal contract. Enforce single-variable discipline, LTV-anchored CPI/CPA ceiling, D+7 mid-read kill threshold, ceiling circuit-breaker, explicit re-allocation criterion, and human review before any spend.',
  ].join('\n');
}

export const POST = withAuth(
  async (request: NextRequest, { userId, clientId }) => {
    // AI-backed mutation — rate-limit before skill spend (route-safety [C]).
    return aiGeneration(request, async () => {
      const rawBody = await request.json().catch(() => undefined);
      const parsed = paidPilotRequestSchema.safeParse(rawBody);

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const input = parsed.data;
      const brandCeiling = PILOT_CEILING_AUD[input.brandScope];

      if (brandCeiling === 0) {
        return NextResponse.json(
          {
            error: 'Paid pilot not available',
            details: `${input.brandScope} has no paid-media pilot ceiling (feed-only / boundary). Design rejected.`,
          },
          { status: 409 }
        );
      }

      if (input.pilotCeilingAud > brandCeiling) {
        return NextResponse.json(
          {
            error: 'Pilot ceiling exceeded',
            details: `${input.brandScope} Phase 1.2 ceiling is $${brandCeiling} AUD. Requested ceiling $${input.pilotCeilingAud} AUD.`,
          },
          { status: 409 }
        );
      }

      if (input.proposedSpendAud > input.pilotCeilingAud) {
        return NextResponse.json(
          {
            error: 'Spend exceeds pilot ceiling',
            details: `Proposed spend $${input.proposedSpendAud} AUD exceeds pilot ceiling $${input.pilotCeilingAud} AUD.`,
          },
          { status: 409 }
        );
      }

      try {
        const organizationId =
          (await getEffectiveOrganizationId(userId)) ?? clientId;
        const result = await invokeSkill({
          skill: 'paid-performance-marketer',
          prompt: buildPaidPerformancePrompt(organizationId, input),
        });

        const draft = await prisma.contentDraft.create({
          data: {
            userId,
            organizationId,
            platform: 'paid',
            title: `${input.channel} paid pilot — ${input.brandScope}`,
            content: result.content,
            topic: input.objective,
            status: 'review',
            metadata: {
              skill: result.skill,
              model: result.model,
              agencyTaskId: 'AT-016',
              brandScope: input.brandScope,
              channel: input.channel,
              adAccountId: input.adAccountId,
              flywheelPosition: input.flywheelPosition,
              proposedSpendAud: input.proposedSpendAud,
              pilotCeilingAud: input.pilotCeilingAud,
              singleVariable: input.singleVariable,
              attState: input.attState,
              privacyNutritionState: input.privacyNutritionState ?? null,
              sourceOfTruthJobId: input.sourceOfTruthJobId,
              reallocationOnKill: input.reallocationOnKill,
              capitalAuthorisationRef: input.capitalAuthorisationRef,
              foundationIncluded: result.foundationIncluded,
              foundationMissing: result.foundationMissing,
              usage: result.usage ?? null,
              autoPublish: false,
              placesSpend: false,
            },
          },
        });

        logger.info('marketing: paid pilot design draft created', {
          draftId: draft.id,
          organizationId,
          brandScope: input.brandScope,
          channel: input.channel,
          skill: result.skill,
        });

        return NextResponse.json(
          {
            data: {
              reviewState: 'pending_review' as const,
              draft: {
                id: draft.id,
                title: draft.title,
                status: draft.status,
                content: draft.content,
                metadata: draft.metadata,
                createdAt: draft.createdAt,
              },
            },
          },
          { status: 201 }
        );
      } catch (error) {
        logger.error('POST /api/marketing/paid-pilot failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return NextResponse.json(
          {
            error: 'Internal Server Error',
            message: 'Failed to create paid pilot design draft',
          },
          { status: 500 }
        );
      }
    });
  }
);
