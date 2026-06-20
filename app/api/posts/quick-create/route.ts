/**
 * Quick Post creation endpoint.
 *
 * The "10x easier" default path for media-post creation: takes one optional
 * intent line and returns a single scored, platform-targeted draft Post —
 * reusing the existing branded-content generator, quality gate, and Post/Campaign
 * models. No new tables, packages, or migrations.
 *
 * Mirrors the auth/rate-limit/503 structure of app/api/ai/generate-content.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { aiContentGenerator } from '@/lib/ai/content-generator';
import type { ContentRequest } from '@/lib/ai/content-generator';
import { ClientBrandedContentService } from '@/lib/services/client-branded-content';
import { logger } from '@/lib/logger';
import { getUserAICredentials } from '@/lib/ai/api-credential-injector';
import { requireApiKey } from '@/lib/middleware/require-api-key';
import { prisma } from '@/lib/prisma';
import { withRateLimit, UsageTracker } from '@/lib/middleware/rate-limiter';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { evaluateContent, scoreDimensions } from '@/lib/autopilot/quality-gate';

export const runtime = 'nodejs';
export const maxDuration = 60; // Prevent 504s on long-running LLM calls

// Platforms with a one-click auto-publish adapter (no per-slot metadata needed).
// Mirrors the (module-local) set in lib/publish/publishQueue.ts — kept in sync
// manually since that constant is not exported.
const AUTO_PUBLISH_PLATFORMS = new Set([
  'instagram',
  'facebook',
  'linkedin',
  'twitter',
  'threads',
]);

const QUICK_POSTS_CAMPAIGN_NAME = 'Quick Posts';

const quickCreateSchema = z.object({
  intent: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  return withRateLimit(request, async () => {
    return requireApiKey(request, async userId => {
      try {
        // 1. AI-key gate (mirror /api/ai/generate-content)
        const userCreds = await getUserAICredentials(userId);
        const platformKeyConfigured = !!(
          process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY
        );
        if (!userCreds?.apiKey && !platformKeyConfigured) {
          return NextResponse.json(
            {
              error: 'AI service unavailable',
              message:
                'OPENAI_API_KEY is not configured. Set it in your environment variables or provide your own API key in Settings.',
            },
            { status: 503 }
          );
        }

        // 2. Parse + validate body
        const body = await request.json().catch(() => ({}));
        const validation = quickCreateSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json(
            { error: 'Invalid request data', details: validation.error.issues },
            { status: 400 }
          );
        }
        const intent = validation.data.intent?.trim() || undefined;

        // 3. Resolve the active brand (multi-business aware)
        const orgId = await getEffectiveOrganizationId(userId);
        if (!orgId) {
          return NextResponse.json(
            {
              error: 'No active brand. Connect a brand before creating a post.',
            },
            { status: 400 }
          );
        }

        // 4. Pick a platform — prefer one that can be one-click scheduled
        const connections = await prisma.platformConnection.findMany({
          where: { organizationId: orgId, isActive: true, deletedAt: null },
          select: { platform: true },
          distinct: ['platform'],
        });
        const connected = connections.map(c => c.platform);
        const schedulable = connected.filter(p =>
          AUTO_PUBLISH_PLATFORMS.has(p)
        );
        const platform = schedulable[0] ?? connected[0] ?? 'instagram';
        const canSchedule = schedulable.includes(platform);

        // 5. Generate — branded service first, graceful fallback to base generator
        const prompt =
          intent ??
          'An on-brand post highlighting what we do and why it helps.';
        let content: string;
        let variations: string[];
        try {
          const branded = await ClientBrandedContentService.generate({
            orgId,
            userId,
            platform,
            prompt,
            contentType: 'post',
            tone: 'professional',
          });
          content = branded.content;
          variations = branded.variations;
        } catch (brandedError) {
          logger.warn(
            'quick-create: branded service failed, falling back to aiContentGenerator',
            {
              error:
                brandedError instanceof Error
                  ? brandedError.message
                  : String(brandedError),
            }
          );
          const generated = await aiContentGenerator.generateContent(
            {
              type: 'post',
              // Base generator types platform as a fixed union; connection
              // platforms (e.g. 'threads') are a superset, cast as in the
              // generator's own calendar path (content-generator.ts:874).
              platform: platform as ContentRequest['platform'],
              topic: prompt,
              orgId,
            },
            userCreds ?? undefined
          );
          content = generated.content;
          variations = generated.variations.map(v => v.content);
        }

        // 6. Score + gate the result
        const dimensions = scoreDimensions(content, platform);
        const gate = evaluateContent(content, platform);

        // 7. Persist — find-or-create the per-org "Quick Posts" campaign
        let campaign = await prisma.campaign.findFirst({
          where: {
            organizationId: orgId,
            name: QUICK_POSTS_CAMPAIGN_NAME,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!campaign) {
          campaign = await prisma.campaign.create({
            data: {
              name: QUICK_POSTS_CAMPAIGN_NAME,
              description: 'One-click posts created from the Quick Post box.',
              platform,
              status: 'draft',
              userId,
              organizationId: orgId,
            },
            select: { id: true },
          });
        }

        const post = await prisma.post.create({
          data: {
            content,
            platform,
            campaignId: campaign.id,
            status: 'draft',
            source: 'quick',
            scheduledAt: null,
            metadata: {
              source: 'quick',
              intent: intent ?? null,
              scoreOverall: gate.score,
              scoreDimensions: dimensions,
              decision: gate.decision,
              generatedAt: new Date().toISOString(),
            },
          },
          select: { id: true },
        });

        // 8. Track usage for subscription limits
        await UsageTracker.track(userId, 'ai_posts', 1);

        // 9. Respond
        return NextResponse.json({
          success: true,
          data: {
            postId: post.id,
            content,
            platform,
            canSchedule,
            score: gate.score,
            dimensions,
            decision: gate.decision,
            variations,
          },
        });
      } catch (error) {
        logger.error('Quick post creation error', { error });
        return NextResponse.json(
          {
            error: 'Failed to create post',
            message: 'An unexpected error occurred. Please try again.',
          },
          { status: 500 }
        );
      }
    });
  });
}
