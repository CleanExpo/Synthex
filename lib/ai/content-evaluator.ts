/**
 * Content Evaluator — UNI-1650
 *
 * Evaluator agent in the Planner→Generator→Evaluator harness.
 * Scores generated content against the originating brief using 4 axes.
 *
 * Key design principle (Anthropic harness research):
 *   "Tuning a standalone evaluator to be skeptical is far more tractable
 *    than making a generator critical of its own work."
 *
 * Model: claude-haiku-4-5-20251001 (fast + cost-efficient at scale)
 * Threshold: score >= 80 → pass (maps to confidenceScore >= 0.80)
 */

import type { ContentBrief } from './content-planner';
import { withAntiSlop } from '@/lib/ai/prompts/anti-slop-directive';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EvaluationDimensions {
  /** Does the content faithfully address the brief's goal and key messages? */
  briefAlignment: number;
  /** Is it original and specific, not generic/template-feeling? */
  originality: number;
  /** Is the format, length, and tone appropriate for the target platform? */
  platformFit: number;
  /** Is it clear, readable, and free of jargon? */
  clarity: number;
}

export interface EvaluationResult {
  /** Weighted composite score 0–100 */
  score: number;
  /** true if score >= 80 */
  pass: boolean;
  dimensions: EvaluationDimensions;
  /** Actionable suggestions for the next generation attempt */
  feedback: string[];
  /** Normalised for the orchestrator confidence gate (score / 100) */
  confidenceScore: number;
}

// ---------------------------------------------------------------------------
// Dimension weights (sum to 1.0)
// Subjective quality (briefAlignment + originality) weighted higher per
// Anthropic research to prevent safe-but-generic output.
// ---------------------------------------------------------------------------

const WEIGHTS = {
  briefAlignment: 0.35,
  originality: 0.25,
  platformFit: 0.25,
  clarity: 0.15,
} as const;

// ---------------------------------------------------------------------------
// Evaluator system prompt — calibrated to be skeptical
// Few-shot examples anchor the scoring scale so the model doesn't grade on a curve.
// ---------------------------------------------------------------------------

const RAW_SYSTEM_PROMPT = `You are a rigorous content quality evaluator. Your job is to score AI-generated content against the brief that produced it.

Be SKEPTICAL. A score of 85+ means the content is genuinely excellent and ready to publish. Most content will score 50–75 and need revision. Do not give high scores to content that is merely adequate.

Score each dimension 0–100:
- briefAlignment: Does every sentence serve the brief's goal and key messages? (0 = completely off-brief, 100 = perfectly on-brief)
- originality: Is it specific, fresh, and non-generic? Would a human mistake it for a template? (0 = pure boilerplate, 100 = highly original)
- platformFit: Is the length, tone, and format exactly right for the platform? (0 = completely wrong platform, 100 = platform-native)
- clarity: Is it clear, direct, and readable? No jargon, no filler? (0 = incomprehensible, 100 = crystal clear)

CALIBRATION EXAMPLES:
- "Just launched our new product. Check it out!" → briefAlignment:20, originality:10, platformFit:40, clarity:70
- A 2000-word LinkedIn post on a Twitter brief → platformFit:5
- Content using the exact keywords from the brief but adding nothing → originality:25
- Content that hits all brief points with a memorable hook and clear CTA → briefAlignment:85, originality:75

Return ONLY valid JSON — no markdown fences, no explanation:
{
  "dimensions": {
    "briefAlignment": <0-100>,
    "originality": <0-100>,
    "platformFit": <0-100>,
    "clarity": <0-100>
  },
  "feedback": ["<specific actionable suggestion 1>", "<suggestion 2>"]
}

feedback: 1–4 items, each specific and actionable (e.g. "Add a hook question in the first line" not "Improve the opening").`;

const SYSTEM_PROMPT = withAntiSlop(RAW_SYSTEM_PROMPT);

// ---------------------------------------------------------------------------
// Main evaluator function
// ---------------------------------------------------------------------------

export async function evaluateContent(
  content: string,
  brief: ContentBrief
): Promise<EvaluationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const userMessage = buildUserMessage(content, brief);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
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

  logger.info('content-evaluator: evaluation complete', {
    goal: brief.goal,
    inputTokens: data.usage.input_tokens,
    outputTokens: data.usage.output_tokens,
  });

  return parseEvaluation(text);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildUserMessage(content: string, brief: ContentBrief): string {
  const briefSummary = [
    `Goal: ${brief.goal}`,
    `Target audience: ${brief.targetAudience}`,
    `Tone: ${brief.tone}`,
    `Key messages: ${brief.keyMessages.join('; ')}`,
    brief.contentRequests[0]
      ? `Platform: ${brief.contentRequests[0].platform} (${brief.contentRequests[0].type})`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `BRIEF:\n${briefSummary}\n\nGENERATED CONTENT:\n${content}\n\nEvaluate this content against the brief.`;
}

function parseEvaluation(text: string): EvaluationResult {
  const cleaned = text
    .replace(/^```(?:json)?\n?/m, '')
    .replace(/\n?```$/m, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as {
      dimensions?: Partial<EvaluationDimensions>;
      feedback?: string[];
    };

    const dims: EvaluationDimensions = {
      briefAlignment: clamp(parsed.dimensions?.briefAlignment ?? 50),
      originality: clamp(parsed.dimensions?.originality ?? 50),
      platformFit: clamp(parsed.dimensions?.platformFit ?? 50),
      clarity: clamp(parsed.dimensions?.clarity ?? 50),
    };

    const score = Math.round(
      dims.briefAlignment * WEIGHTS.briefAlignment +
        dims.originality * WEIGHTS.originality +
        dims.platformFit * WEIGHTS.platformFit +
        dims.clarity * WEIGHTS.clarity
    );

    return {
      score,
      pass: score >= 80,
      dimensions: dims,
      feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [],
      confidenceScore: score / 100,
    };
  } catch (err) {
    logger.error('content-evaluator: failed to parse evaluation JSON', {
      error: err,
      raw: text.slice(0, 300),
    });
    // Conservative fallback — fail the gate so a human reviews
    return {
      score: 40,
      pass: false,
      dimensions: {
        briefAlignment: 40,
        originality: 40,
        platformFit: 40,
        clarity: 40,
      },
      feedback: ['Evaluation parsing failed — please review content manually.'],
      confidenceScore: 0.4,
    };
  }
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
