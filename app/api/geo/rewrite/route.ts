/**
 * GEO Tactic Rewrite API — Streaming AI Rewrite Endpoint
 *
 * POST /api/geo/rewrite
 * Body: { content: string, tactic: GEOTactic, section?: string }
 * Returns: Server-Sent Events stream of { text } chunks, terminated by [DONE]
 *
 * Gated at Pro plan or higher. Free plan receives 403 with upgrade: true.
 * Temperature: 0.3 — conservative rewriting that preserves author voice.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 * - OPENROUTER_API_KEY or equivalent AI provider key
 *
 * @module app/api/geo/rewrite/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { RateLimiter } from '@/lib/rate-limit';
import { getAIProvider } from '@/lib/ai/providers';
import { isFeatureAvailable } from '@/lib/geo/feature-limits';
import { buildTacticRewritePrompt } from '@/lib/geo/tactic-prompts';
import type { GEOTactic } from '@/lib/geo/types';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import { logger } from '@/lib/logger';
import {
  governedCall,
  GovernorRefusedError,
  GOVERNOR_MODE,
  type ProviderCallResult,
} from '@/lib/ai/governor';
import {
  estimateTokens,
  governorProviderFor,
  governorRefusalResponse,
  resolveGovernorScope,
  unwrapGoverned,
} from '@/lib/ai/route-governance';

// ─── Rate limiter — 20 req/min for AI rewrite calls ───────────────────────────

const rewriteRateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 20,
  identifier: (req: NextRequest) => {
    const ip =
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      'unknown';
    return `geo-rewrite:${ip}`;
  },
});

// ─── Validation schema ─────────────────────────────────────────────────────────

const rewriteSchema = z.object({
  content: z
    .string()
    .min(50, 'Content must be at least 50 characters')
    .max(50000, 'Content must be under 50,000 characters'),
  tactic: z.enum([
    'authoritative-citations',
    'statistics',
    'quotations',
    'fluency',
    'readability',
    'technical-vocabulary',
    'uniqueness',
    'information-flow',
    'persuasion',
  ] as const),
  section: z.string().max(5000).optional(),
});

// ─── POST Handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Auth
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorised', message: 'Authentication required' },
      { status: 401 }
    );
  }

  // 2. Rate limit
  const rateLimitResult = await rewriteRateLimiter.check(request);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again shortly.' },
      { status: 429 }
    );
  }

  // 3. Feature gate — rewrites require pro plan or higher
  const subscription = await subscriptionService.getSubscription(userId);
  const plan = subscription?.plan ?? 'free';

  if (!isFeatureAvailable(plan, 'tacticOptimiserRewrites')) {
    return NextResponse.json(
      {
        error: 'AI rewrites require a Pro plan or higher',
        upgrade: true,
      },
      { status: 403 }
    );
  }

  // 4. Validate body
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const parsed = rewriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { content, tactic, section } = parsed.data;

  // 5. Build prompt
  const { system, user } = buildTacticRewritePrompt(tactic as GEOTactic, {
    content,
    section,
  });

  // 6. Stream response via AI provider, through the Governor
  const aiProvider = getAIProvider();
  const provider = governorProviderFor(aiProvider.name);
  const scope = await resolveGovernorScope(userId);
  if (!scope && GOVERNOR_MODE !== 'shadow') {
    return governorRefusalResponse(
      new GovernorRefusedError('refused_flag_missing', 'no organisation')
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        const messages = [
          { role: 'system' as const, content: system },
          { role: 'user' as const, content: user },
        ];
        // Streams report no usage: tokens are estimated at ~4 chars a token.
        const callProvider = async (
          client: typeof aiProvider,
          model: string
        ): Promise<ProviderCallResult<void>> => {
          let outputChars = 0;
          for await (const text of client.stream({
            model,
            messages,
            temperature: 0.3,
            max_tokens: 4000,
          })) {
            if (text) {
              outputChars += text.length;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
              );
            }
          }
          return {
            data: undefined,
            inputTokens: estimateTokens(system + user),
            outputTokens: Math.ceil(outputChars / 4),
            modelId: model,
          };
        };

        if (!scope) {
          // No organisation, shadow mode only: enforcing mode refused above.
          await callProvider(aiProvider, aiProvider.models.balanced);
        } else {
          let providerError: { error: unknown } | null = null;
          const result = await governedCall<void>({
            organizationId: scope.organizationId,
            brandSlug: scope.brandSlug,
            runner: 'geo-rewrite',
            provider,
            model: { kind: 'registered', modelId: aiProvider.models.balanced },
            pipelineName: 'geo-rewrite',
            estimate: {
              inputTokens: estimateTokens(system + user),
              outputTokens: 4000,
            },
            mode: GOVERNOR_MODE,
            execute: async ctx => {
              try {
                return await callProvider(
                  ctx.apiKey
                    ? getAIProvider({ apiKey: ctx.apiKey, provider })
                    : aiProvider,
                  ctx.model?.id ?? aiProvider.models.balanced
                );
              } catch (error) {
                providerError = { error };
                throw error;
              }
            },
          });
          unwrapGoverned(result, providerError);
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        logger.error('GEO rewrite streaming error', { error, tactic, userId });
        const refusal =
          error instanceof GovernorRefusedError
            ? {
                error: 'Rewrite refused by the spend governor',
                code: error.outcome,
              }
            : { error: 'Rewrite failed. Please try again.' };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(refusal)}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export const runtime = 'nodejs';
