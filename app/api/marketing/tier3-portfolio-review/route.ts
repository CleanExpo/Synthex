/**
 * POST /api/marketing/tier3-portfolio-review — AT-008 (+ AT-022 surface)
 *
 * Generates a senior-cmo Tier-3 quarterly portfolio brief via the governed
 * `senior-cmo` skill and stores it as an org-scoped pending-review draft.
 * This route never publishes, reallocates capital, or amends foundation files.
 *
 * Distinct from the quarterly effect-report (client marketing metrics PDF) —
 * this is board-grade portfolio P&L / flywheel / reallocation review.
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

const brandEnum = z.enum(['DR', 'NRPG', 'RestoreAssist', 'CARSI', 'CCW']);

const tier3PortfolioReviewSchema = z.object({
  cadence: z.literal('tier-3-quarterly'),
  quarterLabel: z.string().min(1).max(40),
  windowStart: z.string().min(1).max(40),
  windowEnd: z.string().min(1).max(40),
  brandScopeInReview: z.array(brandEnum).min(1).max(5),
  crossClientBoundaryCheck: z.enum(['nexus-only', 'ccw-only']),
  upstreamInputSummary: z.string().min(1).max(4_000),
  objective: z.string().min(1).max(2_000),
});

function buildSeniorCmoPrompt(
  organizationId: string,
  request: z.infer<typeof tier3PortfolioReviewSchema>
): string {
  return [
    `Organisation ID: ${organizationId}`,
    '',
    'Create a pending-review SeniorCMODecision for a Tier-3 quarterly portfolio review. Do not publish, reallocate capital, or amend foundation files.',
    `- Cadence: ${request.cadence}`,
    `- Quarter: ${request.quarterLabel}`,
    `- Window: ${request.windowStart} → ${request.windowEnd}`,
    `- Brands in review: ${request.brandScopeInReview.join(', ')}`,
    `- Cross-client boundary check: ${request.crossClientBoundaryCheck}`,
    `- Upstream input summary: ${request.upstreamInputSummary}`,
    `- Objective: ${request.objective}`,
    '',
    'Return the complete SeniorCMODecision contract. Enforce flywheel-position citations, 90-day hypothesis + kill threshold + reallocation criterion, ≤8-sentence prose_summary, considered_and_rejected (≥2), and human review before any capital move.',
  ].join('\n');
}

export const POST = withAuth(
  async (request: NextRequest, { userId, clientId }) => {
    // AI-backed mutation — rate-limit before skill spend (route-safety [C]).
    return aiGeneration(request, async () => {
      const rawBody = await request.json().catch(() => undefined);
      const parsed = tier3PortfolioReviewSchema.safeParse(rawBody);

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const input = parsed.data;

      // Phase 3.4 / L9: never aggregate Nexus + CCW in one portfolio brief.
      const hasNexus = input.brandScopeInReview.some(b => b !== 'CCW');
      const hasCcw = input.brandScopeInReview.includes('CCW');
      if (
        (input.crossClientBoundaryCheck === 'nexus-only' && hasCcw) ||
        (input.crossClientBoundaryCheck === 'ccw-only' && hasNexus) ||
        (hasNexus && hasCcw)
      ) {
        return NextResponse.json(
          {
            error: 'Cross-client boundary breach',
            details:
              'Tier-3 portfolio review cannot mix Nexus brands with CCW in one brief. Use nexus-only or ccw-only scope.',
          },
          { status: 409 }
        );
      }

      try {
        const organizationId =
          (await getEffectiveOrganizationId(userId)) ?? clientId;
        const result = await invokeSkill({
          skill: 'senior-cmo',
          prompt: buildSeniorCmoPrompt(organizationId, input),
        });

        const draft = await prisma.contentDraft.create({
          data: {
            userId,
            organizationId,
            platform: 'cmo',
            title: `Tier-3 portfolio review — ${input.quarterLabel}`,
            content: result.content,
            topic: input.objective,
            status: 'review',
            metadata: {
              skill: result.skill,
              model: result.model,
              agencyTaskId: 'AT-008',
              relatedTaskIds: ['AT-022'],
              cadence: input.cadence,
              quarterLabel: input.quarterLabel,
              windowStart: input.windowStart,
              windowEnd: input.windowEnd,
              brandScopeInReview: input.brandScopeInReview,
              crossClientBoundaryCheck: input.crossClientBoundaryCheck,
              foundationIncluded: result.foundationIncluded,
              foundationMissing: result.foundationMissing,
              usage: result.usage ?? null,
              autoPublish: false,
              reallocatesCapital: false,
            },
          },
        });

        logger.info('marketing: Tier-3 portfolio review draft created', {
          draftId: draft.id,
          organizationId,
          quarterLabel: input.quarterLabel,
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
        logger.error('POST /api/marketing/tier3-portfolio-review failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return NextResponse.json(
          {
            error: 'Internal Server Error',
            message: 'Failed to create Tier-3 portfolio review draft',
          },
          { status: 500 }
        );
      }
    });
  }
);
