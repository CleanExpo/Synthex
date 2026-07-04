/**
 * Content Planner — UNI-1650
 *
 * Planner agent in the Planner→Generator→Evaluator harness.
 * Takes a high-level campaign goal and expands it into a structured
 * ContentBrief with concrete ContentRequests ready for generation.
 *
 * Design: https://www.anthropic.com/engineering/harness-design-long-running-apps
 * Model: claude-sonnet-4-6 (balanced reasoning — spec expansion requires depth)
 */

import { z } from 'zod';
import type { ContentRequest } from './content-generator';
import { withAntiSlop } from '@/lib/ai/prompts/anti-slop-directive';
import { logger } from '@/lib/logger';
import { structuredOutput } from '@/lib/ai/structured-output';
import { AnthropicProvider } from '@/lib/ai/providers/anthropic-provider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContentBrief {
  /** Original campaign goal supplied by the user */
  goal: string;
  /** Who the content is targeting */
  targetAudience: string;
  /** 3–5 thematic pillars that anchor the campaign */
  contentPillars: string[];
  /** Voice / tone direction */
  tone: string;
  /** Platform-specific notes keyed by platform name */
  platformConstraints: Record<string, string>;
  /** Key messages the content must convey */
  keyMessages: string[];
  /** 1–3 concrete content requests, ready to hand to the Generator */
  contentRequests: ContentRequest[];
}

// ---------------------------------------------------------------------------
// Structured-output schema (SYN-313)
//
// Zod schema for the ContentBrief the Planner asks Sonnet to emit. Handed to
// the AI provider as a structured-output format so Claude returns schema-valid
// JSON directly — replacing the previous fragile strip-fence + JSON.parse.
// ---------------------------------------------------------------------------

const ContentRequestSchema = z.object({
  type: z.enum(['post', 'caption', 'thread', 'story', 'reel', 'article']),
  platform: z.enum([
    'twitter',
    'instagram',
    'linkedin',
    'tiktok',
    'facebook',
    'youtube',
  ]),
  topic: z.string().optional(),
  tone: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  targetAudience: z.string().optional(),
  includeEmojis: z.boolean().optional(),
  includeHashtags: z.boolean().optional(),
  includeCTA: z.boolean().optional(),
});

const ContentBriefSchema = z.object({
  goal: z.string().optional(),
  targetAudience: z.string().optional(),
  contentPillars: z.array(z.string()).optional(),
  tone: z.string().optional(),
  platformConstraints: z.record(z.string(), z.string()).optional(),
  keyMessages: z.array(z.string()).optional(),
  contentRequests: z.array(ContentRequestSchema).min(1),
});

/** Reusable structured-output format handed to the provider. */
const briefFormat = structuredOutput(ContentBriefSchema);

export interface PlannerInput {
  /** High-level goal: "Drive signups for Synthex trial from Instagram audience" */
  goal: string;
  /** Optional platform hint — Planner will choose if omitted */
  platform?: string;
  /** Organisation context for brand-aware planning */
  orgContext?: {
    businessName?: string;
    industry?: string;
    brandVoice?: string;
  };
}

// ---------------------------------------------------------------------------
// Planner system prompt — instructs Sonnet to think like a strategist
// ---------------------------------------------------------------------------

const RAW_SYSTEM_PROMPT = `You are a senior content strategist. Your job is to turn a high-level campaign goal into a structured content brief that a content generator can execute immediately.

Return ONLY valid JSON — no markdown fences, no explanation, no preamble.

The JSON must match this exact shape:
{
  "goal": "<echo the original goal>",
  "targetAudience": "<specific audience description>",
  "contentPillars": ["<pillar 1>", "<pillar 2>", "<pillar 3>"],
  "tone": "<e.g. professional, casual, inspiring>",
  "platformConstraints": {
    "<platform>": "<key constraint for that platform>"
  },
  "keyMessages": ["<message 1>", "<message 2>"],
  "contentRequests": [
    {
      "type": "<post|caption|thread|story|article>",
      "platform": "<twitter|instagram|linkedin|tiktok|facebook|youtube>",
      "topic": "<specific topic for this piece>",
      "tone": "<tone for this piece>",
      "keywords": ["<keyword 1>", "<keyword 2>"],
      "targetAudience": "<audience for this piece>",
      "includeEmojis": true,
      "includeHashtags": true,
      "includeCTA": true
    }
  ]
}

Rules:
- contentRequests: 1–3 items only. Do not over-generate.
- Be specific about topics — "5 reasons your marketing team needs AI" not "marketing content"
- Choose platform types that match the goal and audience
- Tone should be consistent with the brand voice if provided`;

const SYSTEM_PROMPT = withAntiSlop(RAW_SYSTEM_PROMPT);

// ---------------------------------------------------------------------------
// Main planner function
// ---------------------------------------------------------------------------

export async function planContent(input: PlannerInput): Promise<ContentBrief> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const userMessage = buildUserMessage(input);
  const ai = new AnthropicProvider();

  try {
    // SYN-313: request a schema-constrained ContentBrief. The provider uses
    // Anthropic's native `output_config.format`; the validated object arrives
    // on `res.parsed`, so no strip-fence + JSON.parse is needed.
    const res = await ai.complete({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      outputFormat: briefFormat,
    });

    logger.info('content-planner: response received', {
      goal: input.goal,
      inputTokens: res.usage?.prompt_tokens,
      outputTokens: res.usage?.completion_tokens,
    });

    return parseBrief(res.parsed, input.goal);
  } catch (err) {
    logger.error('content-planner: request failed', {
      error: err,
      goal: input.goal,
    });
    return fallbackBrief(input.goal);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildUserMessage(input: PlannerInput): string {
  const lines: string[] = [`Campaign goal: ${input.goal}`];
  if (input.platform) lines.push(`Preferred platform: ${input.platform}`);
  if (input.orgContext?.businessName)
    lines.push(`Business: ${input.orgContext.businessName}`);
  if (input.orgContext?.industry)
    lines.push(`Industry: ${input.orgContext.industry}`);
  if (input.orgContext?.brandVoice)
    lines.push(`Brand voice: ${input.orgContext.brandVoice}`);
  lines.push('\nProduce a ContentBrief JSON for this campaign.');
  return lines.join('\n');
}

/**
 * Map the structured-output result into a fully-defaulted ContentBrief.
 *
 * `parsed` is the schema-validated object surfaced on the provider response
 * (SYN-313). It is re-validated defensively here so a null / malformed value
 * degrades to {@link fallbackBrief} instead of throwing. Exported for tests.
 */
export function parseBrief(
  parsed: unknown,
  originalGoal: string
): ContentBrief {
  const result = ContentBriefSchema.safeParse(parsed);

  if (!result.success) {
    logger.error('content-planner: brief failed schema validation', {
      issues: result.error.issues.slice(0, 5),
      goal: originalGoal,
    });
    return fallbackBrief(originalGoal);
  }

  const data = result.data;
  return {
    goal: data.goal ?? originalGoal,
    targetAudience: data.targetAudience ?? 'General audience',
    contentPillars: data.contentPillars ?? [],
    tone: data.tone ?? 'professional',
    platformConstraints: data.platformConstraints ?? {},
    keyMessages: data.keyMessages ?? [],
    contentRequests: data.contentRequests as ContentRequest[],
  };
}

/** Minimal brief returned when generation or parsing fails, so the pipeline continues. */
function fallbackBrief(originalGoal: string): ContentBrief {
  return {
    goal: originalGoal,
    targetAudience: 'General audience',
    contentPillars: ['Awareness', 'Value', 'CTA'],
    tone: 'professional',
    platformConstraints: {},
    keyMessages: [originalGoal],
    contentRequests: [
      {
        type: 'post',
        platform: 'linkedin',
        topic: originalGoal,
        tone: 'professional',
        keywords: [],
        targetAudience: 'General audience',
        includeEmojis: false,
        includeHashtags: true,
        includeCTA: true,
      },
    ],
  };
}
