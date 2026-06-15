/**
 * generateNextSteps — lib/brandiq/generateNextSteps.ts
 *
 * Calls claude-haiku-4-5 via OpenRouter to produce 3 specific, actionable
 * next steps tailored to the client's brand profile and first-win metric.
 *
 * Cost is tracked via trackPipelineCost (SYN-518).
 *
 * Server-only — never import this in a client component.
 *
 * @task SYN-527
 */

import {
  calculatePipelineCost,
  trackPipelineCost,
} from '@/lib/pipelines/track-cost';
import { getAIProvider } from '@/lib/ai/providers';
import { logger } from '@/lib/logger';
import { v4 as uuid } from 'uuid';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrandContext {
  businessName: string;
  industry: string;
  vertical: string;
  tone: string;
  winMetric?: string; // e.g. 'impressions' | 'engagementRate'
  improvementPct?: number;
}

export interface NextStep {
  action: string; // Short imperative — "Post a behind-the-scenes reel"
  reason: string; // Why — "Your audience resonates 47% more with video"
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRICING_MODEL = 'claude-haiku-4-5'; // key used in MODEL_RATES
const MAX_TOKENS = 512;

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Generate 3 specific next steps for a client who has just unlocked Brand IQ.
 * Returns an array of 3 NextStep objects, or falls back to generic steps on error.
 */
export async function generateNextSteps(
  context: BrandContext,
  organizationId: string
): Promise<NextStep[]> {
  const runId = uuid();

  const winLine =
    context.winMetric && context.improvementPct != null
      ? `Their best post delivered ${context.improvementPct}% more ${context.winMetric} than their average.`
      : 'They have recently achieved their first content win.';

  const systemPrompt = `You are a concise marketing strategist for Synthex, an AI content platform.
Return ONLY a JSON array of exactly 3 next-step objects. Each object must have:
  "action": a short imperative sentence (max 12 words) — what to do next
  "reason": one sentence explaining why (max 20 words) — anchored to their specific result

Rules:
- Be specific to their industry and brand tone
- Each step must be different (format, timing, audience)
- No generic advice like "post consistently"
- No markdown, no explanation outside the JSON array`;

  const userPrompt = `Client: ${context.businessName} (${context.industry}, ${context.vertical} sector)
Brand tone: ${context.tone}
${winLine}

Generate 3 next steps to compound this momentum.`;

  try {
    // Route through the shared provider factory (OpenAI by default; OpenRouter
    // still selectable via AI_PROVIDER). The factory's fast model replaces the
    // previous hardcoded OpenRouter `fetch`, which silently degraded to generic
    // fallbackSteps on this OpenAI-only deployment (OPENROUTER_API_KEY unset).
    const ai = getAIProvider();
    const response = await ai.complete({
      model: ai.models.fast,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
    });

    const raw = response.choices?.[0]?.message?.content ?? '';
    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;

    // Track cost — non-fatal
    try {
      const costUsd = calculatePipelineCost(
        PRICING_MODEL,
        inputTokens,
        outputTokens
      );
      await trackPipelineCost({
        pipeline_name: 'brand-iq-next-steps',
        client_id: organizationId,
        run_id: runId,
        model: PRICING_MODEL,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costUsd,
      });
    } catch (costErr) {
      logger.error('brandiq:generateNextSteps: cost tracking failed', {
        error: costErr,
      });
    }

    return parseNextSteps(raw, context);
  } catch (err) {
    logger.error('brandiq:generateNextSteps: unexpected error', { error: err });
    return fallbackSteps(context);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseNextSteps(raw: string, context: BrandContext): NextStep[] {
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return fallbackSteps(context);
    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      action?: string;
      reason?: string;
    }>;
    if (!Array.isArray(parsed) || parsed.length === 0)
      return fallbackSteps(context);
    return parsed.slice(0, 3).map(s => ({
      action: (s.action ?? '').trim() || 'Create a new content piece',
      reason: (s.reason ?? '').trim() || 'Building on your recent momentum.',
    }));
  } catch {
    return fallbackSteps(context);
  }
}

function fallbackSteps(context: BrandContext): NextStep[] {
  const industry = context.industry || 'your industry';
  return [
    {
      action: 'Repeat your best-performing content format this week',
      reason: `Your ${context.winMetric ?? 'engagement'} data shows what your audience wants.`,
    },
    {
      action: 'Create a behind-the-scenes post about your process',
      reason: `${industry} audiences respond strongly to authentic, expert content.`,
    },
    {
      action: 'Respond to every comment on your last 3 posts',
      reason:
        'Early engagement signals boost algorithmic reach compounding over weeks.',
    },
  ];
}
