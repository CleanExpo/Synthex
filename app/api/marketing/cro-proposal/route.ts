/**
 * POST /api/marketing/cro-proposal — AT-011
 *
 * Generates a single-variable CRO test proposal through the governed
 * `cro-specialist` skill and stores it as a pending-review draft. This route
 * never publishes, schedules, or exposes a live experiment.
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

const croProposalRequestSchema = z.object({
  brandScope: z.enum(['DR', 'NRPG', 'RestoreAssist', 'CARSI', 'CCW']),
  funnelStep: z.string().min(1).max(100),
  frictionId: z.string().min(1).max(200),
  gapAuditId: z.string().min(1).max(100),
  verificationState: z.literal('verified-via-Gap-audit'),
  metric: z.string().min(1).max(200),
  observedValue: z.number(),
  baselineValue: z.number(),
  baselineSource: z.string().min(1).max(500),
  metricSource: z.string().min(1).max(200),
  window: z.string().min(1).max(200),
  sampleSize: z.number().int().positive(),
  audienceEvidenceRef: z.string().min(1).max(500),
  objective: z.string().min(1).max(2_000),
});

function buildCroSpecialistPrompt(
  organizationId: string,
  request: z.infer<typeof croProposalRequestSchema>
): string {
  return [
    `Organisation ID: ${organizationId}`,
    '',
    'Create a pending-review CroProposalOutput. Do not publish, schedule, or expose a live experiment.',
    `- Brand scope: ${request.brandScope}`,
    `- Funnel step: ${request.funnelStep}`,
    `- Friction ID: ${request.frictionId}`,
    `- Gap audit ID: ${request.gapAuditId}`,
    `- Verification state: ${request.verificationState}`,
    `- Metric: ${request.metric}`,
    `- Observed value: ${request.observedValue}`,
    `- Baseline value: ${request.baselineValue}`,
    `- Baseline source: ${request.baselineSource}`,
    `- Metric source: ${request.metricSource}`,
    `- Window: ${request.window}`,
    `- Sample size: ${request.sampleSize}`,
    `- Audience evidence reference: ${request.audienceEvidenceRef}`,
    `- Objective: ${request.objective}`,
    '',
    'Return the complete CroProposalOutput contract. Enforce single-variable discipline, kill threshold + 14-day mid-read, Gap-audit-verified friction only, and human review before any exposure.',
  ].join('\n');
}

export const POST = withAuth(
  async (request: NextRequest, { userId, clientId }) => {
    // AI-backed mutation — rate-limit before skill spend (route-safety [C]).
    return aiGeneration(request, async () => {
      const rawBody = await request.json().catch(() => undefined);
      const parsed = croProposalRequestSchema.safeParse(rawBody);

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const input = parsed.data;

      try {
        const organizationId =
          (await getEffectiveOrganizationId(userId)) ?? clientId;
        const result = await invokeSkill({
          skill: 'cro-specialist',
          prompt: buildCroSpecialistPrompt(organizationId, input),
        });

        const draft = await prisma.contentDraft.create({
          data: {
            userId,
            organizationId,
            platform: 'cro',
            title: `${input.frictionId} CRO proposal — ${input.brandScope}`,
            content: result.content,
            topic: input.objective,
            status: 'review',
            metadata: {
              skill: result.skill,
              model: result.model,
              agencyTaskId: 'AT-011',
              brandScope: input.brandScope,
              funnelStep: input.funnelStep,
              frictionId: input.frictionId,
              gapAuditId: input.gapAuditId,
              verificationState: input.verificationState,
              foundationIncluded: result.foundationIncluded,
              foundationMissing: result.foundationMissing,
              usage: result.usage ?? null,
              autoPublish: false,
            },
          },
        });

        logger.info('marketing: CRO proposal draft created', {
          draftId: draft.id,
          organizationId,
          frictionId: input.frictionId,
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
        logger.error('POST /api/marketing/cro-proposal failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return NextResponse.json(
          {
            error: 'Internal Server Error',
            message: 'Failed to create CRO proposal draft',
          },
          { status: 500 }
        );
      }
    });
  }
);
