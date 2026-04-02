/**
 * captionGenerator — lib/calendar/captionGenerator.ts
 *
 * Calls claude-haiku-4-5 via OpenRouter to generate 3 caption variations
 * for a single content calendar slot.
 *
 * Cost is tracked via trackPipelineCost (SYN-518).
 *
 * @task SYN-521
 */

import {
  calculatePipelineCost,
  trackPipelineCost,
} from '@/lib/pipelines/track-cost';
import { withAntiSlop } from '@/lib/ai/prompts/anti-slop-directive';
import { logger } from '@/lib/logger';
import { v4 as uuid } from 'uuid';
import type { CalendarPlatform, ContentType } from './types';
import type { BlendedContentIntelligence } from '@/lib/content-intelligence/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CaptionContext {
  platform: CalendarPlatform;
  contentType: ContentType;
  businessName: string;
  industry: string;
  /** Brand voice tone e.g. "warm and approachable" */
  tone: string;
  hashtags: string[];
  /** Optional market opportunity name to focus the caption — SYN-549 */
  opportunityHint?: string;
  /**
   * Content intelligence profile for this client — SYN-632.
   * When provided, enriches the prompt with audience-specific guidance.
   * Below 0.6 confidence: framed as industry patterns.
   * At/above 0.6 confidence: framed as client-specific audience data.
   */
  intelligenceContext?: BlendedContentIntelligence;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MODEL = 'anthropic/claude-haiku-4-5';
const PRICING_MODEL = 'claude-haiku-4-5';
/** ~500 input + 800 output per 3 captions */
const MAX_TOKENS = 800;

/** Fallback captions returned when the API call fails */
const FALLBACK_CAPTIONS = [
  'Sharing something special with you today — stay tuned! ✨',
  "There's a reason our clients love what we do. Discover it. 🌟",
  "We're passionate about delivering results. See for yourself. 🎯",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const base = `You are a professional social media copywriter for an Australian business.
Write engaging, authentic captions that match the brand voice.
Always produce exactly 3 distinct caption variations — short, punchy, and platform-appropriate.
Respond ONLY with a JSON array of 3 strings: ["caption1", "caption2", "caption3"]
No preamble, no explanation, no markdown fences — just the JSON array.`;
  return withAntiSlop(base);
}

/**
 * Builds a content intelligence line for the prompt — SYN-632.
 * Framing is confidence-aware: below 0.6 uses industry patterns language;
 * at/above 0.6 uses client-specific audience data language.
 */
function buildIntelligenceLine(ctx: CaptionContext): string {
  const intel = ctx.intelligenceContext;
  if (!intel) return '';

  const topTopics = intel.topTopics
    .slice(0, 3)
    .map((t) => t.topic)
    .join(', ');
  if (!topTopics) return '';

  const bestFormats = Object.entries(intel.contentFormatScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([fmt]) => fmt)
    .join(' and ');

  const confidenceSource =
    intel.confidenceLevel >= 0.6
      ? `Based on this client's audience data (${Math.round(intel.confidenceLevel * 100)}% confidence)`
      : `Based on industry patterns for ${ctx.industry}`;

  return `${confidenceSource}, this audience responds best to: topics [${topTopics}]${bestFormats ? `, with ${bestFormats} performing best` : ''}.`;
}

function buildUserPrompt(ctx: CaptionContext): string {
  const hashtagLine =
    ctx.hashtags.length > 0
      ? `Include 2–4 of these hashtags naturally: ${ctx.hashtags.slice(0, 8).join(' ')}`
      : 'Include 2–3 relevant hashtags.';

  const opportunityLine = ctx.opportunityHint
    ? `Market opportunity: ${ctx.opportunityHint}\n`
    : '';

  const intelligenceLine = buildIntelligenceLine(ctx);

  return `Business: ${ctx.businessName}
Industry: ${ctx.industry}
Platform: ${ctx.platform}
Content type: ${ctx.contentType}
Brand voice: ${ctx.tone}
${intelligenceLine ? `Audience intelligence: ${intelligenceLine}\n` : ''}${opportunityLine}${hashtagLine}

Write 3 caption variations for this ${ctx.contentType} post on ${ctx.platform}.${ctx.opportunityHint ? ` Tie each caption to the "${ctx.opportunityHint}" opportunity.` : ''}
Keep each under 280 characters for maximum engagement.
Return ONLY the JSON array.`;
}

function parseCaptions(raw: string): string[] {
  try {
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/```[a-z]*\n?/gi, '').trim();
    const parsed = JSON.parse(cleaned) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.length >= 3 &&
      parsed.every(c => typeof c === 'string')
    ) {
      return (parsed as string[]).slice(0, 3);
    }
  } catch {
    // fall through
  }
  return FALLBACK_CAPTIONS;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate 3 caption variations for a single calendar slot.
 * Returns fallback captions on any AI error (generation must never block the calendar).
 */
export async function generateCaptions(
  context: CaptionContext,
  organizationId: string
): Promise<string[]> {
  const runId = uuid();

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    logger.warn(
      'captionGenerator: OPENROUTER_API_KEY missing — returning fallback captions'
    );
    return FALLBACK_CAPTIONS;
  }

  try {
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(context);

    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer':
            process.env.OPENROUTER_SITE_URL ?? 'https://synthex.social',
          'X-Title': process.env.OPENROUTER_SITE_NAME ?? 'Synthex',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: MAX_TOKENS,
          temperature: 0.8, // slightly higher temperature for caption variety
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      logger.warn('captionGenerator: OpenRouter non-2xx', {
        status: response.status,
        body: errText.slice(0, 200),
      });
      return FALLBACK_CAPTIONS;
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const raw = json.choices?.[0]?.message?.content ?? '';
    const inputTokens = json.usage?.prompt_tokens ?? 0;
    const outputTokens = json.usage?.completion_tokens ?? 0;

    // Track cost (non-fatal)
    try {
      const costUsd = calculatePipelineCost(
        PRICING_MODEL,
        inputTokens,
        outputTokens
      );
      await trackPipelineCost({
        pipeline_name: 'calendar-caption-generator',
        client_id: organizationId,
        run_id: runId,
        model: PRICING_MODEL,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costUsd,
      });
    } catch (costErr) {
      logger.warn('captionGenerator: cost tracking failed (non-fatal)', {
        error: costErr,
      });
    }

    return parseCaptions(raw);
  } catch (err) {
    logger.error('captionGenerator: unexpected error', { error: err });
    return FALLBACK_CAPTIONS;
  }
}
