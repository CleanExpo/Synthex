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
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { RateLimiter } from '@/lib/rate-limit';
import { getAIProvider } from '@/lib/ai/providers';
import { isFeatureAvailable } from '@/lib/geo/feature-limits';
import { buildTacticRewritePrompt } from '@/lib/geo/tactic-prompts';
import type { GEOTactic } from '@/lib/geo/types';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import { logger } from '@/lib/logger';

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
  content: z.string().min(50, 'Content must be at least 50 characters').max(50000, 'Content must be under 50,000 characters'),
  tactic: z.enum([
    'authoritative-citations', 'statistics', 'quotations', 'fluency',
    'readability', 'technical-vocabulary', 'uniqueness', 'information-flow', 'persuasion',
  ] as const),
  section: z.string().max(5000).optional(),
});

// ─── POST Handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Auth
  const userId = await getUserIdFromRequest(request);
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
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
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
  const { system, user } = buildTacticRewritePrompt(tactic as GEOTactic, { content, section });

  // 6. Stream response via AI provider
  const aiProvider = getAIProvider();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        const tokenStream = aiProvider.stream({
          model: aiProvider.models.balanced,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.3,
          max_tokens: 4000,
        });

        for await (const text of tokenStream) {
          if (text) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        logger.error('GEO rewrite streaming error', { error, tactic, userId });
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: 'Rewrite failed. Please try again.' })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export const runtime = 'nodejs';
