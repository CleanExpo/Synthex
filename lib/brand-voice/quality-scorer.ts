/**
 * Quality Scorer — Phase 64
 *
 * Evaluates AI-generated content against a brand voice profile before publishing.
 * Scores via the shared AI provider factory (OpenAI by default — OpenAI-only
 * direction), so it works on whatever provider the platform is configured for
 * instead of hard-requiring OpenRouter, which is no longer the default and is
 * absent on OpenAI-only deployments. (Previously the constructor threw
 * "OPENROUTER_API_KEY is not configured", which surfaced as a 500 on
 * POST /api/brand-voice/score and silently disabled scoring in the
 * human-approval workflow step.)
 *
 * Architecture (Minions principle: "walls before models"):
 * - Returns a structured QualityScore with numeric dimensions and flags
 * - autoApprove: true when overall score >= AUTO_APPROVE_THRESHOLD (0.85)
 * - Low confidence content → routed to human review queue
 * - NEVER auto-applies — always returns suggestion for human or orchestrator to act on
 */

import { logger } from '@/lib/logger';
import { getAIProvider } from '@/lib/ai/providers';

const AUTO_APPROVE_THRESHOLD = 0.85;

export interface BrandVoiceProfile {
  tone: string; // e.g. 'professional', 'casual', 'authoritative'
  style: string; // e.g. 'formal', 'conversational', 'thought-provoking'
  vocabulary: string; // e.g. 'simple', 'standard', 'technical', 'sophisticated'
  emotion: string; // e.g. 'neutral', 'friendly', 'confident', 'inspiring'
  name?: string; // Persona name for context
}

export interface QualityDimensions {
  brandAlignment: number; // 0–1 — does content match the voice profile?
  clarity: number; // 0–1 — is the content clear and readable?
  engagement: number; // 0–1 — is the content likely to engage the audience?
  appropriateness: number; // 0–1 — is the content appropriate for the platform?
}

export interface QualityScore {
  overall: number; // 0–1 weighted average
  dimensions: QualityDimensions;
  flags: string[]; // Issues detected (empty if clean)
  autoApprove: boolean; // true when overall >= AUTO_APPROVE_THRESHOLD
  reasoning: string; // Brief explanation from the scorer
}

const DEFAULT_BRAND_VOICE: BrandVoiceProfile = {
  tone: 'professional',
  style: 'conversational',
  vocabulary: 'standard',
  emotion: 'friendly',
};

/**
 * QualityScorer — stateless evaluator class.
 * Instantiate once and call scoreContent() as needed.
 */
export class QualityScorer {
  /**
   * Optional user-supplied API key. When set, scoring runs against the user's
   * own credentials (per-request provider instance); otherwise the cached
   * platform provider is used. No key is required at construction time — the
   * factory resolves the platform key, and a missing key degrades gracefully to
   * the conservative fallback rather than throwing.
   */
  private readonly userApiKey?: string;

  constructor(apiKey?: string) {
    this.userApiKey = apiKey ?? undefined;
  }

  /**
   * Score content against a brand voice profile.
   * Returns structured QualityScore with auto-approve flag.
   */
  async scoreContent(
    content: string,
    brandVoice: BrandVoiceProfile = DEFAULT_BRAND_VOICE
  ): Promise<QualityScore> {
    const systemPrompt = this.buildSystemPrompt(brandVoice);
    const userPrompt = this.buildUserPrompt(content);

    try {
      const rawScore = await this.callProvider(systemPrompt, userPrompt);
      return this.parseScore(rawScore);
    } catch (err) {
      logger.error(
        'quality-scorer: scoring failed, returning conservative score',
        { error: err }
      );
      // Fail closed — 0.0 is unambiguously "Poor" on the scoring guide.
      // Returning 0.5 previously looked like a mid-range pass when the
      // provider was simply down.
      return {
        overall: 0,
        dimensions: {
          brandAlignment: 0,
          clarity: 0,
          engagement: 0,
          appropriateness: 0,
        },
        flags: ['Scoring service unavailable — manual review recommended'],
        autoApprove: false,
        reasoning: 'Automatic scoring failed; defaulting to manual review',
      };
    }
  }

  private buildSystemPrompt(profile: BrandVoiceProfile): string {
    return `You are a brand voice quality reviewer for ${profile.name ? `the "${profile.name}" persona` : 'a brand'}.

Brand Voice Profile:
- Tone: ${profile.tone}
- Style: ${profile.style}
- Vocabulary level: ${profile.vocabulary}
- Emotional register: ${profile.emotion}

Your task: Evaluate the provided content and return a JSON quality score.

Respond ONLY with valid JSON matching this exact schema:
{
  "brandAlignment": <0.0 to 1.0>,
  "clarity": <0.0 to 1.0>,
  "engagement": <0.0 to 1.0>,
  "appropriateness": <0.0 to 1.0>,
  "flags": ["<issue1>", "<issue2>"],
  "reasoning": "<brief 1-2 sentence explanation>"
}

Scoring guide:
- 0.9–1.0: Excellent — perfectly on-brand, no issues
- 0.7–0.89: Good — minor deviations, acceptable
- 0.5–0.69: Needs improvement — notable issues
- 0.0–0.49: Poor — significant brand misalignment

Only include flags if there are actual issues. Empty array [] is valid.`;
  }

  private buildUserPrompt(content: string): string {
    const preview =
      content.length > 2000
        ? content.slice(0, 2000) + '...[truncated]'
        : content;
    return `Evaluate this content:\n\n${preview}`;
  }

  private async callProvider(system: string, user: string): Promise<string> {
    // Resolve via the shared factory: user key path when supplied (fresh,
    // uncached instance), platform key path otherwise (cached singleton).
    const ai = this.userApiKey
      ? getAIProvider({ apiKey: this.userApiKey })
      : getAIProvider();

    const response = await ai.complete({
      // Fast/cheap tier — this is a low-temperature JSON scorer, not creative
      // generation.
      model: ai.models.fast,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: 512,
      temperature: 0.2, // Low temperature for consistent scoring
    });

    return response.choices?.[0]?.message?.content ?? '';
  }

  private parseScore(raw: string): QualityScore {
    // Extract JSON from response (handle markdown code blocks if present)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in scorer response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      brandAlignment?: number;
      clarity?: number;
      engagement?: number;
      appropriateness?: number;
      flags?: string[];
      reasoning?: string;
    };

    const dimensions: QualityDimensions = {
      brandAlignment: clamp(parsed.brandAlignment ?? 0.5),
      clarity: clamp(parsed.clarity ?? 0.5),
      engagement: clamp(parsed.engagement ?? 0.5),
      appropriateness: clamp(parsed.appropriateness ?? 0.5),
    };

    // Weighted average: brand alignment 30%, clarity 30%, engagement 25%, appropriateness 15%
    const overall =
      dimensions.brandAlignment * 0.3 +
      dimensions.clarity * 0.3 +
      dimensions.engagement * 0.25 +
      dimensions.appropriateness * 0.15;

    return {
      overall: Math.round(overall * 100) / 100,
      dimensions,
      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
      autoApprove: overall >= AUTO_APPROVE_THRESHOLD,
      reasoning: parsed.reasoning ?? '',
    };
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// Default singleton — exported for convenience
let _defaultScorer: QualityScorer | null = null;

export function getQualityScorer(): QualityScorer {
  if (!_defaultScorer) {
    _defaultScorer = new QualityScorer();
  }
  return _defaultScorer;
}
