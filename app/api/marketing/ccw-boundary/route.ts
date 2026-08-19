/**
 * POST /api/marketing/ccw-boundary — AT-024
 *
 * Enforces the H-4 cross-client boundary handoff for requests that involve CCW
 * plus at least one Nexus brand. When VG-71 is not verified, the route BLOCKs
 * deterministically (no skill spend, no draft that enables cross-promo). When
 * VG-71 is verified, it asks `senior-strategist` for a boundary decision and
 * stores it as a pending-review draft. Never publishes or executes cross-promo.
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

const NEXUS_BRANDS = ['DR', 'NRPG', 'RestoreAssist', 'CARSI'] as const;

const VG71_STATES = [
  'verified',
  'placeholder',
  'verification-needed',
  'hypothesis',
] as const;

const ccwBoundaryRequestSchema = z.object({
  nexusBrand: z.enum(NEXUS_BRANDS),
  /** Always CCW — kept explicit so callers cannot omit the cross-client side. */
  ccwBrand: z.literal('CCW'),
  promoType: z.enum([
    'T4-cross-promotion',
    'T9-cross-promotion',
    'cross-portfolio-promo',
    'shared-audience-activation',
  ]),
  vg71State: z.enum(VG71_STATES),
  l9CarveOutApplies: z.boolean(),
  proposedAction: z.string().min(1).max(1_000),
  objective: z.string().min(1).max(2_000),
});

function buildSeniorStrategistPrompt(
  organizationId: string,
  request: z.infer<typeof ccwBoundaryRequestSchema>
): string {
  return [
    `Organisation ID: ${organizationId}`,
    '',
    'Create a pending-review SeniorStrategistDecision for H-4 cross-client boundary.',
    'Do not publish, schedule, or execute any cross-portfolio promotion.',
    `- Nexus brand: ${request.nexusBrand}`,
    `- CCW brand: ${request.ccwBrand}`,
    `- Promo type: ${request.promoType}`,
    `- VG-71 CCW client agreement state: ${request.vg71State}`,
    `- L9 founder-content carve-out applies: ${request.l9CarveOutApplies}`,
    `- Proposed action: ${request.proposedAction}`,
    `- Objective: ${request.objective}`,
    '',
    'Return the complete SeniorStrategistDecision contract. Enforce L1 isolation,',
    'L9 carve-out discipline, VG-71 citation, and human review before any cross-promo.',
    'Set cross_client_boundary_check appropriately for a CCW ↔ Nexus request.',
  ].join('\n');
}

export const POST = withAuth(
  async (request: NextRequest, { userId, clientId }) => {
    // AI-backed mutation — rate-limit before skill spend (route-safety [C]).
    // Deterministic VG-71 BLOCK returns before invokeSkill, so no spend there.
    return aiGeneration(request, async () => {
      const rawBody = await request.json().catch(() => undefined);
      const parsed = ccwBoundaryRequestSchema.safeParse(rawBody);

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const input = parsed.data;

      // H-4 product enforcement: VG-71 must be verified or cross-promo is BLOCKED.
      if (input.vg71State !== 'verified') {
        logger.info('marketing: CCW boundary BLOCKED — VG-71 not verified', {
          nexusBrand: input.nexusBrand,
          promoType: input.promoType,
          vg71State: input.vg71State,
        });
        return NextResponse.json(
          {
            error: 'Cross-promotion blocked',
            details:
              `H-4 / VG-71 CCW client agreement is [${input.vg71State}]. ` +
              'Cross-portfolio promotion is BLOCKED until VG-71 is verified. ' +
              'Isolation holds; request stays in test mode.',
            gate: {
              id: 'VG-71',
              state: input.vg71State,
              protocol: 'H-4',
              decision: 'BLOCKED',
            },
          },
          { status: 409 }
        );
      }

      try {
        const organizationId =
          (await getEffectiveOrganizationId(userId)) ?? clientId;
        const result = await invokeSkill({
          skill: 'senior-strategist',
          prompt: buildSeniorStrategistPrompt(organizationId, input),
        });

        const draft = await prisma.contentDraft.create({
          data: {
            userId,
            organizationId,
            platform: 'governance',
            title: `H-4 CCW boundary — ${input.nexusBrand} ↔ CCW`,
            content: result.content,
            topic: input.objective,
            status: 'review',
            metadata: {
              skill: result.skill,
              model: result.model,
              agencyTaskId: 'AT-024',
              protocol: 'H-4',
              nexusBrand: input.nexusBrand,
              ccwBrand: input.ccwBrand,
              promoType: input.promoType,
              vg71State: input.vg71State,
              l9CarveOutApplies: input.l9CarveOutApplies,
              proposedAction: input.proposedAction,
              foundationIncluded: result.foundationIncluded,
              foundationMissing: result.foundationMissing,
              usage: result.usage ?? null,
              autoPublish: false,
              executesCrossPromo: false,
            },
          },
        });

        logger.info('marketing: CCW boundary decision draft created', {
          draftId: draft.id,
          organizationId,
          nexusBrand: input.nexusBrand,
          promoType: input.promoType,
          skill: result.skill,
        });

        return NextResponse.json(
          {
            data: {
              reviewState: 'pending_review' as const,
              gate: {
                id: 'VG-71',
                state: input.vg71State,
                protocol: 'H-4',
                decision: 'pending_strategist_review',
              },
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
        logger.error('POST /api/marketing/ccw-boundary failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return NextResponse.json(
          {
            error: 'Internal Server Error',
            message: 'Failed to create CCW boundary decision draft',
          },
          { status: 500 }
        );
      }
    });
  }
);
