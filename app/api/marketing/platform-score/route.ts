/**
 * POST /api/marketing/platform-score — AT-021
 *
 * Scores content 0–100 against platform algorithm signals through the governed
 * `platform-content-optimiser` skill and stores the result as a pending-review
 * draft. This route never publishes or schedules.
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

const platformEnum = z.enum([
  'google-search',
  'linkedin',
  'instagram',
  'facebook',
  'tiktok',
  'reels',
  'twitter',
  'youtube',
  'pinterest',
  'gbp',
  'email',
]);

const platformScoreRequestSchema = z.object({
  brandScope: z.enum(['DR', 'NRPG', 'RestoreAssist', 'CARSI', 'CCW']),
  platform: platformEnum,
  content: z.string().min(1).max(10_000),
  sourceArtefactRef: z.string().min(1).max(500),
  voiceTag: z.string().min(1).max(100),
});

function buildPlatformScorePrompt(
  organizationId: string,
  request: z.infer<typeof platformScoreRequestSchema>
): string {
  return [
    `Organisation ID: ${organizationId}`,
    '',
    'Create a pending-review PlatformContentOptimiserScore. Do not publish, schedule, or rewrite the source without human review.',
    `- Brand scope: ${request.brandScope}`,
    `- Platform: ${request.platform}`,
    `- Voice tag: ${request.voiceTag}`,
    `- Source artefact ref: ${request.sourceArtefactRef}`,
    '',
    'Content to score:',
    '---',
    request.content,
    '---',
    '',
    'Return the complete PlatformContentOptimiserScore contract: score_0_100, signal_breakdown with plain-English signal names only (never raw algorithm jargon), top_3_lift_recommendations with falsifying post-publish checks, kill_threshold, post_publish_verification_path, considered_and_rejected (≥2), and prose_summary. Cite algorithm-knowledge-base reference + signal-translations version. Low scores (<60) must recommend source rewrite, not micro-tweaks.',
  ].join('\n');
}

export const POST = withAuth(
  async (request: NextRequest, { userId, clientId }) => {
    return aiGeneration(request, async () => {
      const rawBody = await request.json().catch(() => undefined);
      const parsed = platformScoreRequestSchema.safeParse(rawBody);

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
          skill: 'platform-content-optimiser',
          prompt: buildPlatformScorePrompt(organizationId, input),
        });

        const draft = await prisma.contentDraft.create({
          data: {
            userId,
            organizationId,
            platform: input.platform,
            title: `Pre-publish score — ${input.platform} (${input.brandScope})`,
            content: result.content,
            topic: input.sourceArtefactRef,
            status: 'review',
            metadata: {
              skill: result.skill,
              model: result.model,
              agencyTaskId: 'AT-021',
              brandScope: input.brandScope,
              platform: input.platform,
              voiceTag: input.voiceTag,
              sourceArtefactRef: input.sourceArtefactRef,
              scoredContent: input.content,
              foundationIncluded: result.foundationIncluded,
              foundationMissing: result.foundationMissing,
              usage: result.usage ?? null,
              autoPublish: false,
            },
          },
        });

        logger.info('marketing: platform pre-publish score draft created', {
          draftId: draft.id,
          organizationId,
          platform: input.platform,
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
        logger.error('POST /api/marketing/platform-score failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return NextResponse.json(
          {
            error: 'Internal Server Error',
            message: 'Failed to create platform pre-publish score draft',
          },
          { status: 500 }
        );
      }
    });
  }
);
