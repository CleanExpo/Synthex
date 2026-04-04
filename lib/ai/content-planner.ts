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

import type { ContentRequest } from './content-generator';
import { withAntiSlop } from '@/lib/ai/prompts/anti-slop-directive';
import { logger } from '@/lib/logger';

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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const userMessage = buildUserMessage(input);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };

  const text = data.content.find(b => b.type === 'text')?.text ?? '';

  logger.info('content-planner: response received', {
    goal: input.goal,
    inputTokens: data.usage.input_tokens,
    outputTokens: data.usage.output_tokens,
  });

  return parseBrief(text, input.goal);
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

function parseBrief(text: string, originalGoal: string): ContentBrief {
  // Strip any accidental markdown fences
  const cleaned = text
    .replace(/^```(?:json)?\n?/m, '')
    .replace(/\n?```$/m, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as Partial<ContentBrief>;

    // Validate required fields
    if (!parsed.contentRequests || !Array.isArray(parsed.contentRequests)) {
      throw new Error('contentRequests missing or not an array');
    }

    return {
      goal: parsed.goal ?? originalGoal,
      targetAudience: parsed.targetAudience ?? 'General audience',
      contentPillars: Array.isArray(parsed.contentPillars)
        ? parsed.contentPillars
        : [],
      tone: parsed.tone ?? 'professional',
      platformConstraints: parsed.platformConstraints ?? {},
      keyMessages: Array.isArray(parsed.keyMessages) ? parsed.keyMessages : [],
      contentRequests: parsed.contentRequests,
    };
  } catch (err) {
    logger.error('content-planner: failed to parse brief JSON', {
      error: err,
      raw: text.slice(0, 500),
    });
    // Graceful fallback — return a minimal brief so the pipeline can continue
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
}
