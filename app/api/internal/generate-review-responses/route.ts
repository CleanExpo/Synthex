/**
 * POST /api/internal/generate-review-responses
 *
 * Internal route invoked daily by the Supabase Edge Function cron.
 * Generates AI reply suggestions for GBP reviews that have no aiSuggestion yet,
 * and saves them back to gbp_reviews.ai_suggestion.
 *
 * Wrapped in createEdgeFunctionRunner for structured logging to edge_function_logs.
 * Per-org runner — each org processes its own pending reviews.
 *
 * Auth: Bearer CRON_SECRET
 * SYN-628
 */

import { NextRequest, NextResponse } from 'next/server';
import { createEdgeFunctionRunner, ClientInput } from '@/lib/pipelines/runner';
import type { ReviewIntelligenceMetadata } from '@/lib/pipelines/metadata-schemas';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import Anthropic from '@anthropic-ai/sdk';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min — processes many orgs

// ── AI client (lazy singleton) ────────────────────────────────────────────────

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });
  }
  return _anthropic;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReviewInput {
  orgName: string;
}

interface ReviewIntelligenceResult {
  reviews_processed: number;
  responses_drafted: number;
  avg_confidence: number;
}

interface PendingReview {
  id: string;
  reviewerName: string | null;
  rating: number;
  comment: string;
}

// ── AI response generation ────────────────────────────────────────────────────

interface GeneratedResponse {
  suggestion: string;
  confidence: number;
}

async function generateReviewResponse(
  orgName: string,
  review: PendingReview
): Promise<GeneratedResponse> {
  const starLabel =
    ['', '1-star', '2-star', '3-star', '4-star', '5-star'][review.rating] ??
    'unknown-star';
  const reviewerLabel = review.reviewerName ?? 'a customer';

  const prompt = `You are a professional reply writer for ${orgName}, an Australian small business.

Write a brief, warm, professional reply to the following Google Business Profile review.

Review details:
- Rating: ${review.rating}/5 stars (${starLabel})
- Reviewer: ${reviewerLabel}
- Comment: "${review.comment}"

Reply guidelines:
- Address the reviewer by first name if known (not "Dear Customer")
- Be genuine and specific — reference something from their comment
- For 4-5 star reviews: thank them and reinforce what they praised
- For 1-3 star reviews: apologise sincerely, address the issue, offer to resolve offline
- Keep reply under 100 words
- Do not use marketing buzzwords
- Use Australian English (colour, recognise, etc.)

Respond with JSON only:
{
  "suggestion": "<reply text>",
  "confidence": <0.0-1.0, your confidence this reply is high quality>
}`;

  const response = await getAnthropic().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected Anthropic response type');
  }

  const parsed = JSON.parse(content.text) as GeneratedResponse;
  if (!parsed.suggestion || typeof parsed.confidence !== 'number') {
    throw new Error('Invalid response structure from AI');
  }

  return {
    suggestion: parsed.suggestion,
    confidence: Math.min(1, Math.max(0, parsed.confidence)),
  };
}

// ── Runner ────────────────────────────────────────────────────────────────────

const reviewIntelligenceRunner = createEdgeFunctionRunner<
  ReviewInput,
  ReviewIntelligenceResult
>(
  'review-intelligence',
  async (
    input: ReviewInput,
    clientId: string
  ): Promise<ReviewIntelligenceResult> => {
    // Find reviews needing an AI suggestion — cap at 10 per run to bound latency
    const pending = (await prisma.gBPReview.findMany({
      where: {
        organizationId: clientId,
        aiSuggestion: null,
        comment: { not: null },
        responseStatus: 'pending',
      },
      take: 10,
      orderBy: { reviewTime: 'desc' },
      select: { id: true, reviewerName: true, rating: true, comment: true },
    })) as PendingReview[];

    if (pending.length === 0) {
      return { reviews_processed: 0, responses_drafted: 0, avg_confidence: 0 };
    }

    let responsesGenerated = 0;
    const confidenceScores: number[] = [];

    for (const review of pending) {
      try {
        const { suggestion, confidence } = await generateReviewResponse(
          input.orgName,
          review
        );
        await prisma.gBPReview.update({
          where: { id: review.id },
          data: { aiSuggestion: suggestion, aiSuggestionAt: new Date() },
        });
        responsesGenerated++;
        confidenceScores.push(confidence);
      } catch (err) {
        logger.warn('[review-intelligence] Response generation failed', {
          reviewId: review.id,
          orgId: clientId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const avg_confidence =
      confidenceScores.length > 0
        ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
        : 0;

    return {
      reviews_processed: pending.length,
      responses_drafted: responsesGenerated,
      avg_confidence,
    };
  },
  (
    output: ReviewIntelligenceResult
  ): { valid: boolean; metadata: Record<string, unknown> } => {
    // Valid if we drafted responses (or had nothing to process)
    const valid =
      output.reviews_processed === 0 ||
      (output.responses_drafted > 0 && output.avg_confidence > 0);

    const metadata: ReviewIntelligenceMetadata = {
      reviews_processed: output.reviews_processed,
      responses_drafted: output.responses_drafted,
      avg_confidence: Math.round(output.avg_confidence * 100) / 100,
    };

    return { valid, metadata };
  }
);

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = verifyCronRequest(request, 'GENERATE_REVIEW_RESPONSES');
  if (!auth.ok) return auth.response;

  // Build per-org inputs
  const orgs = await prisma.organization.findMany({
    where: { status: 'active' },
    select: { id: true, name: true },
  });

  const inputs: ClientInput<ReviewInput>[] = orgs.map(org => ({
    clientId: org.id,
    input: { orgName: org.name },
  }));

  const runResult = await reviewIntelligenceRunner.run(inputs);

  // Aggregate totals across all orgs
  const totals = runResult.outputs.reduce(
    (acc, { output }) => {
      if (output) {
        acc.reviews_processed += output.reviews_processed;
        acc.responses_drafted += output.responses_drafted;
      }
      return acc;
    },
    { reviews_processed: 0, responses_drafted: 0 }
  );

  logger.info('[generate-review-responses] Run complete', {
    runId: runResult.runId,
    status: runResult.status,
    orgsProcessed: runResult.clientsProcessed,
    orgsFailed: runResult.clientsFailed,
    ...totals,
    durationMs: runResult.durationMs,
  });

  return NextResponse.json({
    ok: true,
    runId: runResult.runId,
    status: runResult.status,
    orgsProcessed: runResult.clientsProcessed,
    ...totals,
    durationMs: runResult.durationMs,
  });
}
