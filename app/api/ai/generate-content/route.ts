/**
 * AI Content Generation API Endpoint
 * Handles requests for AI-powered content creation
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { aiContentGenerator } from '@/lib/ai/content-generator';
import { ClientBrandedContentService } from '@/lib/services/client-branded-content';
import { contentScorer } from '@/lib/ai/content-scorer';
import { authMonitor } from '@/lib/auth/monitoring';
import { logger } from '@/lib/logger';
import { getUserAICredentials } from '@/lib/ai/api-credential-injector';
import { requireApiKey } from '@/lib/middleware/require-api-key';
import { prisma } from '@/lib/prisma';
import { withRateLimit, UsageTracker } from '@/lib/middleware/rate-limiter';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { calculateVisibilityScore } from '@/lib/scoring/visibility-score';
import {
  acquireIdempotencyKey,
  enforceBudgetPreflight,
  estimateContentGenerationCostUsd,
  GenerationBudgetExceededError,
  recordGenerationCost,
  releaseIdempotencyKey,
  storeIdempotentResponse,
  systemGenerationContext,
  type GenerationContext,
} from '@/lib/ai/generation-context';

/** Tenant-scoped idempotency namespace for this route. */
const IDEMPOTENCY_SCOPE = 'generate-content';

export const runtime = 'nodejs';
export const maxDuration = 60; // Prevent 504s on long-running LLM calls

// SYN-1053 Phase 3: variations whose pure content score is below this threshold
// are flagged (never blocked). Reuses the pure contentScorer — zero added AI
// cost. Override per-environment via SYNTHEX_QUALITY_THRESHOLD.
const QUALITY_THRESHOLD = Number(process.env.SYNTHEX_QUALITY_THRESHOLD) || 80;

// Zod schema to validate and sanitise the AI-generated content response
const generatedContentSchema = z.object({
  id: z.string(),
  content: z.string(),
  platform: z.string(),
  variations: z
    .array(
      z.object({
        id: z.string(),
        content: z.string(),
        style: z.string(),
        score: z.number().transform(n => Math.max(0, Math.min(100, n))),
        belowThreshold: z.boolean().optional(),
      })
    )
    .default([]),
  hashtags: z.array(z.string()).default([]),
  emojis: z.array(z.string()).default([]),
  hooks: z.array(z.string()).default([]),
  cta: z.string().optional(),
  // DEPRECATED aliases of the heuristic* fields below — kept populated so
  // existing consumers are untouched (SYN-MCP-003).
  estimatedEngagement: z
    .number()
    .min(0)
    .transform(n => Math.max(0, n)),
  viralScore: z.number().transform(n => Math.max(0, Math.min(100, n))),
  // Honest names: rule-based heuristics, NOT predictions (SYN-MCP-003).
  heuristicEngagement: z
    .number()
    .min(0)
    .transform(n => Math.max(0, n))
    .optional(),
  heuristicViralScore: z
    .number()
    .transform(n => Math.max(0, Math.min(100, n)))
    .optional(),
  qualityThreshold: z.number().optional(),
  flaggedCount: z.number().optional(),
  metadata: z.object({
    generatedAt: z.unknown(),
    model: z.string(),
    tokens: z.number().min(0),
    processingTime: z.number().min(0),
  }),
});

// Platforms supported by the generator — single source for the POST schema
// and the calendar GET's platform filter (SYN-MCP-002).
const SUPPORTED_PLATFORMS = [
  'twitter',
  'instagram',
  'linkedin',
  'tiktok',
  'facebook',
  'youtube',
] as const;

// Single-request schema. Also the inner shape for batch items — SYN-MCP-002:
// batchRequests was previously z.array(z.any()) (untyped, unbounded, no
// budget), letting one request fan out arbitrary LLM spend.
const singleGenerateRequestSchema = z.object({
  type: z
    .enum(['post', 'caption', 'thread', 'story', 'reel', 'article'])
    .optional()
    .default('post'),
  platform: z.enum(SUPPORTED_PLATFORMS),
  topic: z.string().optional(),
  tone: z
    .enum([
      'professional',
      'casual',
      'friendly',
      'authoritative',
      'humorous',
      'inspirational',
      'educational',
    ])
    .optional(),
  keywords: z.array(z.string()).optional(),
  targetAudience: z.string().optional(),
  length: z.enum(['short', 'medium', 'long']).optional(),
  includeEmojis: z.boolean().optional().default(true),
  includeHashtags: z.boolean().optional().default(true),
  includeCTA: z.boolean().optional().default(false),
  // Trained persona to apply for voice/style. The main content UI sends this
  // when the user selects a persona; it must be forwarded to the generator so
  // the chosen voice is actually applied (was previously dropped on parse).
  personaId: z.string().min(1).optional(),
});

const generateContentSchema = singleGenerateRequestSchema.extend({
  // Typed + capped batch: each item must be a valid single request, max 10.
  batchRequests: z.array(singleGenerateRequestSchema).min(1).max(10).optional(),
  // Accepted and recorded now — dedupe + per-request budget ENFORCEMENT land
  // with the full GenerationContext threading in SYN-MCP-003.
  idempotencyKey: z.string().min(8).max(128).optional(),
  maxCostUsd: z.number().positive().max(5).optional(),
});

export async function POST(request: NextRequest) {
  // Apply rate limiting + API key hard gate
  return withRateLimit(request, async () => {
    return requireApiKey(request, async userId => {
      // Hoisted so the catch block can release a claimed idempotency key
      // after a FAILED generation (client may retry with the same key).
      let acquiredIdempotencyKey: string | null = null;
      try {
        // Resolve user's own API credentials (falls back to platform key when null)
        const userCreds = await getUserAICredentials(userId);

        // Validate that an AI provider key is available.
        // Synthex defaults to OpenAI (OPENAI_API_KEY); other providers remain
        // supported via AI_PROVIDER for users who configure their own key.
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

        // Parse request body
        const body = await request.json();
        const validation = generateContentSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json(
            { error: 'Invalid request data', details: validation.error.issues },
            { status: 400 }
          );
        }
        const {
          type,
          platform,
          topic,
          tone,
          keywords,
          targetAudience,
          length,
          includeEmojis,
          includeHashtags,
          includeCTA,
          personaId,
          batchRequests,
          idempotencyKey,
          maxCostUsd,
        } = validation.data;

        // Track content generation event
        authMonitor.trackEvent({
          type: 'content_generation',
          method: 'ai',
          timestamp: Date.now(),
          metadata: { platform, type },
        });

        // SYN-MCP-003: REAL enforcement of maxCostUsd + idempotencyKey.
        //
        // 1) Budget preflight — BEFORE any LLM call. The estimate is the
        //    worst-case spend at max_tokens (batch = sum of children),
        //    priced via the canonical MODEL_RATES table.
        try {
          const estimatedCostUsd = batchRequests
            ? batchRequests.reduce(
                (sum, item) => sum + estimateContentGenerationCostUsd(item),
                0
              )
            : estimateContentGenerationCostUsd({ type });
          enforceBudgetPreflight(maxCostUsd, estimatedCostUsd);
        } catch (budgetError) {
          if (budgetError instanceof GenerationBudgetExceededError) {
            return NextResponse.json(
              {
                error: 'Budget exceeded',
                message: budgetError.message,
                estimatedCostUsd: budgetError.estimatedCostUsd,
                maxCostUsd: budgetError.maxCostUsd,
              },
              { status: 402 }
            );
          }
          throw budgetError;
        }

        // 2) Idempotent replay — tenant-scoped (userId is hashed into the
        //    Redis key, so one user can never replay another's response).
        if (idempotencyKey) {
          const acquisition = await acquireIdempotencyKey(
            IDEMPOTENCY_SCOPE,
            userId,
            idempotencyKey
          );
          if (acquisition.state === 'replayed') {
            const replayResponse = NextResponse.json(
              JSON.parse(acquisition.payload),
              { status: 200 }
            );
            replayResponse.headers.set('Idempotent-Replay', 'true');
            return replayResponse;
          }
          if (acquisition.state === 'pending') {
            return NextResponse.json(
              {
                error: 'Duplicate request',
                message:
                  'A request with this idempotencyKey is already in progress. Retry after it completes to receive the cached response.',
              },
              { status: 409 }
            );
          }
          acquiredIdempotencyKey = idempotencyKey;
        }

        // Resolve the user's organisation FIRST — both the batch and single
        // paths need it for brand context. (SYN-MCP-002: the batch branch
        // previously returned early, BEFORE org resolution and usage
        // tracking, so batch children got no brand context and were never
        // counted against subscription limits.)
        let organizationId: string | undefined;
        try {
          const userRecord = userId
            ? await prisma.user.findUnique({
                where: { id: userId },
                select: { organizationId: true },
              })
            : null;
          organizationId = userRecord?.organizationId ?? undefined;
        } catch (orgLookupError) {
          // Best-effort: generation still works without org context (matches
          // the pre-existing fallback behaviour when the lookup failed).
          logger.warn('generate-content: organisation lookup failed', {
            error:
              orgLookupError instanceof Error
                ? orgLookupError.message
                : String(orgLookupError),
          });
        }

        // SYN-MCP-003: server-built GenerationContext — derived ONLY from the
        // authenticated user + org lookup above, never from body fields (the
        // request schema deliberately accepts no organizationId/brandId).
        const generationContext: GenerationContext = organizationId
          ? {
              organizationId,
              userId,
              traceId: crypto.randomUUID(),
              autonomyLevel: 'manual',
              budget: { maxCostUsd, idempotencyKey },
            }
          : systemGenerationContext(undefined, {
              userId,
              autonomyLevel: 'manual',
              budget: { maxCostUsd, idempotencyKey },
            });

        // Handle batch generation (typed + capped by the schema above).
        if (batchRequests) {
          const results = await aiContentGenerator.batchGenerate(
            // Pass the resolved org into each child the same way the single
            // path does (ContentRequest.orgId) so brand context engages.
            batchRequests.map(item => ({ ...item, orgId: organizationId })),
            generationContext
          );
          // Per-child usage accounting (was previously untracked).
          await UsageTracker.track(userId, 'ai_posts', results.length);
          const batchEnvelope = {
            success: true,
            data: results,
            count: results.length,
          };
          if (acquiredIdempotencyKey) {
            await storeIdempotentResponse(
              IDEMPOTENCY_SCOPE,
              userId,
              acquiredIdempotencyKey,
              JSON.stringify(batchEnvelope)
            ).catch(() => {});
          }
          return NextResponse.json(batchEnvelope);
        }

        // Try to use ClientBrandedContentService (new service that uses client's API keys)
        let generatedContent;
        try {
          // When the user explicitly selected a trained persona, use the
          // persona-aware generator: ClientBrandedContentService applies the
          // org BrandDNA but cannot apply a specific persona's voice.
          if (organizationId && topic && !personaId) {
            // Use new branded content service
            const brandedResult = await ClientBrandedContentService.generate({
              orgId: organizationId,
              userId: userId,
              platform,
              prompt: topic,
              contentType: type === 'reel' ? 'post' : type,
              tone,
              targetLength: length,
              includeHashtags,
              includeEmojis,
              customInstructions: keywords?.join(', '),
            });

            // Convert to expected format. Scores come from the real content
            // scorer (pure, no AI cost) — never mock values (CLAUDE.md: no
            // mock/stub data in product surfaces). SYN-1050 Phase 1.
            const primaryScore = contentScorer.score(
              brandedResult.content,
              platform
            );
            generatedContent = {
              id: crypto.randomUUID?.() ?? Date.now().toString(),
              content: brandedResult.content,
              platform,
              variations: brandedResult.variations.map((v, i) => ({
                id: `var-${i}`,
                content: v,
                style: 'alternative',
                score: Math.round(contentScorer.score(v, platform).overall),
              })),
              hashtags: [],
              emojis: [],
              hooks: [],
              cta: undefined,
              // Deprecated aliases + honest heuristic names (SYN-MCP-003).
              estimatedEngagement: Math.round(
                primaryScore.dimensions.engagement.score
              ),
              viralScore: Math.round(primaryScore.overall),
              heuristicEngagement: Math.round(
                primaryScore.dimensions.engagement.score
              ),
              heuristicViralScore: Math.round(primaryScore.overall),
              metadata: {
                generatedAt: new Date(),
                model: brandedResult.model,
                tokens: brandedResult.metadata.tokensUsed ?? 0,
                processingTime: 0,
              },
            };

            // Org-attributed cost ledger row for the branded path (the
            // aiContentGenerator path records its own) — never blocking.
            const brandedTokens = brandedResult.metadata.tokensUsed ?? 0;
            recordGenerationCost(generationContext, {
              pipelineName: 'content-generation',
              model: brandedResult.model,
              inputTokens: Math.round(brandedTokens * 0.4),
              outputTokens: Math.round(brandedTokens * 0.6),
            }).catch(() => {});
          } else {
            // Persona-aware / fallback generator (supports personaId + orgId)
            generatedContent = await aiContentGenerator.generateContent(
              {
                type,
                platform,
                topic,
                tone,
                keywords,
                targetAudience,
                length,
                includeEmojis,
                includeHashtags,
                includeCTA,
                personaId,
                orgId: organizationId,
              },
              generationContext,
              userCreds ?? undefined
            );
          }
        } catch (brandedContentError) {
          // Graceful degradation: fall back to old service if new service fails
          logger.warn(
            'ClientBrandedContentService failed, falling back to aiContentGenerator',
            {
              error:
                brandedContentError instanceof Error
                  ? brandedContentError.message
                  : String(brandedContentError),
            }
          );
          generatedContent = await aiContentGenerator.generateContent(
            {
              type,
              platform,
              topic,
              tone,
              keywords,
              targetAudience,
              length,
              includeEmojis,
              includeHashtags,
              includeCTA,
              personaId,
              orgId: organizationId,
            },
            generationContext,
            userCreds ?? undefined
          );
        }

        // SYN-1053 Phase 3: flag (never block) low-quality variations. Works
        // for BOTH the branded branch (variations already carry a numeric
        // `score`) and the fallback aiContentGenerator branch (score may be
        // absent — fall back to the pure scorer, no AI cost). Additive only.
        const gc = generatedContent as
          | {
              variations?: Array<{
                score?: number;
                content?: string;
                belowThreshold?: boolean;
              }>;
              qualityThreshold?: number;
              flaggedCount?: number;
            }
          | undefined;
        if (gc && Array.isArray(gc.variations)) {
          let flaggedCount = 0;
          for (const v of gc.variations) {
            const variationScore =
              typeof v.score === 'number'
                ? v.score
                : contentScorer.score(v.content || '', platform).overall;
            v.belowThreshold = variationScore < QUALITY_THRESHOLD;
            if (v.belowThreshold) flaggedCount++;
          }
          gc.qualityThreshold = QUALITY_THRESHOLD;
          gc.flaggedCount = flaggedCount;
        }

        // Validate and sanitise the AI response to ensure scores are in bounds
        const validatedContent =
          generatedContentSchema.safeParse(generatedContent);
        const responseData = validatedContent.success
          ? validatedContent.data
          : generatedContent;

        // Track usage for subscription limits
        await UsageTracker.track(userId, 'ai_posts', 1);

        // Trigger visibility score recalculation after successful content generation
        if (organizationId) {
          calculateVisibilityScore(organizationId).catch(() => {});
        }

        const envelope = {
          success: true,
          data: responseData,
        };
        if (acquiredIdempotencyKey) {
          await storeIdempotentResponse(
            IDEMPOTENCY_SCOPE,
            userId,
            acquiredIdempotencyKey,
            JSON.stringify(envelope)
          ).catch(() => {});
        }
        return NextResponse.json(envelope);
      } catch (error) {
        logger.error('Content generation API error', { error });

        // Failed generation: release the idempotency key so the client can
        // retry with the same key instead of being stuck on a 409/stale
        // pending marker for 24h.
        if (acquiredIdempotencyKey) {
          await releaseIdempotencyKey(
            IDEMPOTENCY_SCOPE,
            userId,
            acquiredIdempotencyKey
          ).catch(() => {});
        }

        // Track error
        authMonitor.trackEvent({
          type: 'content_generation_error',
          method: 'ai',
          timestamp: Date.now(),
          metadata: { error: String(error) },
        });

        return NextResponse.json(
          {
            error: 'Failed to generate content',
            message: 'An unexpected error occurred. Please try again.',
          },
          { status: 500 }
        );
      }
    });
  });
}

/** Clamp a parsed query number into [lo, hi]; non-finite values become lo. */
function clampInt(value: number, lo: number, hi: number): number {
  if (!Number.isFinite(value)) return lo;
  return Math.min(hi, Math.max(lo, Math.trunc(value)));
}

/**
 * DEPRECATED synchronous calendar endpoint — SYN-MCP-002.
 * Prefer POST /api/ai/calendar-jobs (async job + status polling), which does
 * not hold a function open for days*platforms*postsPerDay LLM calls.
 *
 * Containment applied here: same withRateLimit wrapper as POST (GET
 * previously bypassed it), params clamped (days 1..14, postsPerDay 1..3,
 * platforms <=4 filtered to the supported set), org-aware generation, and
 * per-post usage tracking (previously untracked).
 */
export async function GET(request: NextRequest) {
  return withRateLimit(request, async () => {
    try {
      // Verify authentication via JWT — cookie existence alone is insufficient
      const userId = await getUserIdFromRequestOrCookies(request);
      if (!userId) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      // Get query parameters — clamped to contain cost (was unclamped:
      // days=365&postsPerDay=100 fanned out unbounded LLM calls).
      const { searchParams } = new URL(request.url);
      const days = clampInt(
        parseInt(searchParams.get('days') || '7', 10),
        1,
        14
      );
      const postsPerDay = clampInt(
        parseInt(searchParams.get('postsPerDay') || '3', 10),
        1,
        3
      );
      const requestedPlatforms = searchParams
        .get('platforms')
        ?.split(',')
        .map(p => p.trim())
        .filter(Boolean) ?? ['twitter', 'instagram', 'linkedin'];
      const filteredPlatforms = requestedPlatforms
        .filter((p): p is (typeof SUPPORTED_PLATFORMS)[number] =>
          (SUPPORTED_PLATFORMS as readonly string[]).includes(p)
        )
        .slice(0, 4);
      // If nothing valid was requested, fall back to the historical default
      // rather than generating an empty calendar.
      const platforms: string[] =
        filteredPlatforms.length > 0
          ? filteredPlatforms
          : ['twitter', 'instagram', 'linkedin'];

      // Resolve org for brand context (best-effort, same as the POST path).
      let organizationId: string | undefined;
      try {
        const userRecord = await prisma.user.findUnique({
          where: { id: userId },
          select: { organizationId: true },
        });
        organizationId = userRecord?.organizationId ?? undefined;
      } catch {
        // Calendar generation still works without org context.
      }

      // SYN-MCP-003: server-built context (org lookup above; system sentinel
      // preserves the previous no-org behaviour for users without an org).
      const calendarContext: GenerationContext = organizationId
        ? {
            organizationId,
            userId,
            traceId: crypto.randomUUID(),
            autonomyLevel: 'manual',
          }
        : systemGenerationContext(undefined, {
            userId,
            autonomyLevel: 'manual',
          });

      // Generate content calendar
      const calendar = await aiContentGenerator.generateContentCalendar(
        days,
        platforms,
        postsPerDay,
        calendarContext
      );

      // Convert Map to object for JSON serialization
      const calendarObject: Record<string, unknown> = {};
      let totalPosts = 0;
      calendar.forEach((value, key) => {
        calendarObject[key] = value;
        totalPosts += Array.isArray(value) ? value.length : 0;
      });

      // Per-post usage accounting (was previously untracked).
      await UsageTracker.track(userId, 'ai_posts', totalPosts);

      const response = NextResponse.json({
        success: true,
        data: calendarObject,
        metadata: {
          days,
          platforms,
          postsPerDay,
          totalPosts,
        },
      });
      // Deprecated sync path — use POST /api/ai/calendar-jobs instead.
      response.headers.set('Deprecation', 'true');
      return response;
    } catch (error) {
      logger.error('Calendar generation error', { error });
      return NextResponse.json(
        { error: 'Failed to generate content calendar' },
        { status: 500 }
      );
    }
  });
}
