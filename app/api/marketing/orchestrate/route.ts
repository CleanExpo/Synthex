/**
 * POST /api/marketing/orchestrate — SYN-967 (10x Organic Marketing Engine, Lane 2)
 *
 * Turns a single marketing brief into a full authority campaign set (calendar +
 * platform drafts + evidence manifest + publish gates) via the real, deterministic
 * orchestrator `generateFullAuthorityCampaign`. This route is the API + review-gate
 * slice: the generated set is returned in a `pending_review` state and is NEVER
 * auto-published. A human (owner/admin) reviews it in the admin surface before any
 * downstream publish step (a later slice) can act on it.
 *
 * Optional `skillContribution` (AT-001): when set to an allowlisted orchestration
 * skill (`senior-strategist` or `senior-cmo`), the route also calls `invokeSkill`
 * and returns the strategist brief alongside the deterministic set. Omit the field
 * for the original SYN-967 behaviour.
 *
 * Persistence (AT-017): the pending-review campaign set is stored in the
 * organisation-scoped marketing campaign record so review survives the request.
 *
 * Auth: owner/admin only (org-scoped via withAuth). 401 unauth · 403 non-admin ·
 * 400 invalid brief · 200 pending-review set.
 *
 * Note: the campaign pack is fully deterministic (template/algorithmic). Skill
 * contribution is additive and uses the configured AI provider when requested.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { invokeSkill, type InvokeSkillResult } from '@/lib/ai/skills';
import type { InvocableSkill } from '@/lib/ai/skills/policy';
import { withAuth } from '@/lib/auth/with-auth';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';
import {
  generateFullAuthorityCampaign,
  type AuthorityCampaignChannel,
  type AuthorityCampaignInput,
} from '@/lib/marketing-agency/full-campaign-generator';
import { aiGeneration } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const CHANNELS = [
  'blog',
  'newsletter',
  'linkedin',
  'facebook',
  'instagram',
  'youtube_shorts',
  'reddit',
] as const satisfies readonly AuthorityCampaignChannel[];

/** Orchestration skills wired for AT-001 — subset of PRODUCT_INVOCABLE_SKILLS. */
const ORCHESTRATION_SKILLS = [
  'senior-strategist',
  'senior-cmo',
] as const satisfies readonly InvocableSkill[];

const sourceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  sourceType: z.string().min(1),
  checkedAt: z.string().min(1),
  url: z.string().url().optional(),
  path: z.string().optional(),
});

const briefSchema = z.object({
  business: z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    websiteUrl: z.string().url().optional(),
    positioning: z.string().min(1),
    audience: z.array(z.string().min(1)).min(1),
    offers: z.array(z.string()).default([]),
    voiceRules: z.array(z.string()).default([]),
    forbiddenClaims: z.array(z.string()).default([]),
  }),
  objective: z.string().min(1),
  operatingMandate: z.string().min(1).optional(),
  channels: z.array(z.enum(CHANNELS)).nonempty().optional(),
  // Default 7 → a seven-asset organic set per brief (one draft per horizon day).
  horizonDays: z.number().int().min(1).max(30).optional(),
  sources: z.array(sourceSchema).default([]),
  /** When set, invoke the allowlisted skill and attach its brief to the response. */
  skillContribution: z.enum(ORCHESTRATION_SKILLS).optional(),
});

function buildOrchestrationSkillPrompt(
  organizationId: string,
  input: AuthorityCampaignInput
): string {
  const { business, objective, operatingMandate, channels, horizonDays } =
    input;
  const channelList =
    channels && channels.length > 0
      ? channels.join(', ')
      : 'default organic set';

  return [
    `Organisation ID: ${organizationId}`,
    '',
    'Review this marketing brief and provide strategic orchestration guidance:',
    `- Business: ${business.name} (${business.slug})`,
    `- Positioning: ${business.positioning}`,
    `- Audience: ${business.audience.join('; ')}`,
    `- Objective: ${objective}`,
    `- Operating mandate: ${operatingMandate}`,
    `- Channels: ${channelList}`,
    `- Horizon: ${horizonDays} days`,
    '',
    'Return channel sequencing priorities, risk flags, and human-review recommendations',
    'before the deterministic draft set enters the approval queue.',
  ].join('\n');
}

function mapSkillContribution(result: InvokeSkillResult) {
  return {
    skill: result.skill,
    content: result.content,
    model: result.model,
    foundationIncluded: result.foundationIncluded,
    foundationMissing: result.foundationMissing,
    usage: result.usage,
  };
}

export const POST = withAuth(
  async (request: NextRequest, { userId, clientId, role }) => {
    // AT-001 skill path is AI-backed — fail closed on rate limit before spend.
    return aiGeneration(request, async () => {
      // Admin gate — owner/admin only (mirrors the /dashboard/admin owner-only guard).
      if (role !== 'owner') {
        return NextResponse.json(
          {
            error: 'Forbidden',
            message: 'Marketing orchestration is admin-only',
          },
          { status: 403 }
        );
      }

      const rawBody = await request.json().catch(() => undefined);
      const parsed = briefSchema.safeParse(rawBody);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const brief = parsed.data;
      const generatedAt = new Date().toISOString();
      const campaignId = `${brief.business.slug}-${Date.now().toString(36)}`;

      const input: AuthorityCampaignInput = {
        campaignId,
        generatedAt,
        business: brief.business,
        objective: brief.objective,
        operatingMandate:
          brief.operatingMandate ??
          'Source-first, owned-media-first. External publishing stays gated until approvals and rights are recorded.',
        sources: brief.sources,
        channels: brief.channels,
        horizonDays: brief.horizonDays ?? 7,
      };

      try {
        const pack = generateFullAuthorityCampaign(input);

        let skillContribution:
          | ReturnType<typeof mapSkillContribution>
          | undefined;

        if (brief.skillContribution) {
          const skillResult = await invokeSkill({
            skill: brief.skillContribution,
            prompt: buildOrchestrationSkillPrompt(clientId, input),
          });
          skillContribution = mapSkillContribution(skillResult);

          logger.info('marketing: skill contribution attached', {
            campaignId,
            organizationId: clientId,
            skill: brief.skillContribution,
            model: skillResult.model,
          });
        }

        const persistedCampaign = await prisma.marketingAgencyCampaign.create({
          data: {
            organizationId: clientId,
            createdById: userId,
            name: `${brief.business.name} authority campaign`,
            slug: pack.campaignId,
            status: 'pending_review',
            providerMode: 'deterministic',
            productName: brief.business.name,
            primaryOffer: brief.objective,
            boardMemo: {
              objective: brief.objective,
              audience: brief.business.audience,
              channels: pack.channels,
              publishingGate:
                'Campaign is pending human review. Do not publish any asset.',
            },
            metadata: {
              orchestrator: 'full-authority-campaign',
              reviewState: 'pending_review',
              generatedAt: pack.generatedAt,
              campaignSet: pack as unknown as Prisma.InputJsonValue,
              ...(skillContribution
                ? {
                    skillContribution: {
                      skill: brief.skillContribution,
                      model: skillContribution.model,
                    },
                  }
                : {}),
            } satisfies Prisma.InputJsonObject,
          },
          select: { id: true },
        });

        logger.info('marketing: orchestrated pending-review set', {
          campaignId,
          persistedCampaignId: persistedCampaign.id,
          organizationId: clientId,
          triggeredBy: userId,
          assetCount: pack.drafts.length,
          skillContribution: brief.skillContribution ?? null,
        });

        // NOT auto-published — persisted for human review only.
        return NextResponse.json({
          data: {
            reviewState: 'pending_review' as const,
            campaignId: pack.campaignId,
            persistedCampaignId: persistedCampaign.id,
            generatedAt: pack.generatedAt,
            assetCount: pack.drafts.length,
            set: pack,
            ...(skillContribution ? { skillContribution } : {}),
          },
        });
      } catch (error) {
        logger.error('POST /api/marketing/orchestrate failed', {
          campaignId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return NextResponse.json(
          {
            error: 'Internal Server Error',
            message: 'Failed to orchestrate campaign',
          },
          { status: 500 }
        );
      }
    });
  }
);
