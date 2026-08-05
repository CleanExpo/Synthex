/**
 * POST /api/marketing/email-sequence — AT-012
 *
 * Generates an email sequence specification through the governed
 * `email-specialist` skill and stores it as a pending-review draft. This route
 * never sends email or schedules a recipient-facing action.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { invokeSkill } from '@/lib/ai/skills';
import { withAuth } from '@/lib/auth/with-auth';
import { logger } from '@/lib/logger';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';

export const runtime = 'nodejs';

const sequenceRequestSchema = z.object({
  triggerId: z.enum([
    'T1',
    'T2',
    'T3',
    'T4',
    'T5',
    'T6',
    'T7',
    'T8',
    'T9',
    'T10',
  ]),
  brandScope: z.enum(['DR', 'NRPG', 'RestoreAssist', 'CARSI', 'CCW']),
  sourceSignal: z.string().min(1).max(500),
  audienceId: z.string().min(1).max(200),
  audienceEvidenceRef: z.string().min(1).max(500),
  touchesSoFar7d: z.number().int().min(0).max(3),
  capWindowResetsAt: z.string().datetime(),
  espSetupState: z.enum(['verified', 'placeholder', 'verification-needed']),
  espGateId: z.string().min(1).max(100),
  complianceOverrideActive: z.boolean(),
  crossClientGateState: z
    .enum(['verified', 'hypothesis', 'verification-needed'])
    .optional(),
  objective: z.string().min(1).max(2_000),
});

function buildEmailSpecialistPrompt(
  organizationId: string,
  request: z.infer<typeof sequenceRequestSchema>
): string {
  return [
    `Organisation ID: ${organizationId}`,
    '',
    'Create a pending-review email sequence specification. Do not send, schedule, or publish an email.',
    `- Trigger ID: ${request.triggerId}`,
    `- Brand scope: ${request.brandScope}`,
    `- Source signal: ${request.sourceSignal}`,
    `- Audience ID: ${request.audienceId}`,
    `- Audience evidence reference: ${request.audienceEvidenceRef}`,
    `- Touches used in trailing 7-day window: ${request.touchesSoFar7d}/3`,
    `- Cap window resets at: ${request.capWindowResetsAt}`,
    `- ESP setup: ${request.espSetupState} (${request.espGateId})`,
    `- T5/T8 compliance override active: ${request.complianceOverrideActive}`,
    `- Cross-client gate state: ${request.crossClientGateState ?? 'not applicable'}`,
    `- Objective: ${request.objective}`,
    '',
    'Return the complete EmailSequenceOutput contract. Enforce the frequency cap, quiet hours, compliance override, cross-client boundary, and human review gates.',
  ].join('\n');
}

export const POST = withAuth(
  async (request: NextRequest, { userId, clientId }) => {
    const rawBody = await request.json().catch(() => undefined);
    const parsed = sequenceRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const input = parsed.data;
    if (input.touchesSoFar7d >= 3) {
      return NextResponse.json(
        {
          error: 'Frequency cap reached',
          details: 'No email draft may exceed 3 touches in 7 days.',
        },
        { status: 409 }
      );
    }

    if (
      input.complianceOverrideActive &&
      ['T3', 'T4', 'T7', 'T10'].includes(input.triggerId)
    ) {
      return NextResponse.json(
        {
          error: 'Compliance override active',
          details: `${input.triggerId} is paused while a T5 or T8 compliance override is active.`,
        },
        { status: 409 }
      );
    }

    try {
      const organizationId =
        (await getEffectiveOrganizationId(userId)) ?? clientId;
      const result = await invokeSkill({
        skill: 'email-specialist',
        prompt: buildEmailSpecialistPrompt(organizationId, input),
      });

      const draft = await prisma.contentDraft.create({
        data: {
          userId,
          organizationId,
          platform: 'email',
          title: `${input.triggerId} email sequence — ${input.brandScope}`,
          content: result.content,
          topic: input.objective,
          status: 'review',
          metadata: {
            skill: result.skill,
            model: result.model,
            triggerId: input.triggerId,
            brandScope: input.brandScope,
            foundationIncluded: result.foundationIncluded,
            foundationMissing: result.foundationMissing,
            usage: result.usage ?? null,
          },
        },
      });

      logger.info('marketing: email sequence draft created', {
        draftId: draft.id,
        organizationId,
        triggerId: input.triggerId,
        skill: result.skill.slug,
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
      logger.error('POST /api/marketing/email-sequence failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Failed to create email sequence draft',
        },
        { status: 500 }
      );
    }
  }
);
