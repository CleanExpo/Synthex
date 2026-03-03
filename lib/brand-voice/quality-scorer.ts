/**
 * Quality Scorer — Phase 64
 *
 * Evaluates AI-generated content against a brand voice profile before publishing.
 * Uses OpenRouter (claude-3-haiku) for fast scoring.
 *
 * Architecture (Minions principle: "walls before models"):
 * - Returns a structured QualityScore with numeric dimensions and flags
 * - autoApprove: true when overall score >= AUTO_APPROVE_THRESHOLD (0.85)
 * - Low confidence content → routed to human review queue
 * - NEVER auto-applies — always returns suggestion for human or orchestrator to act on
 */

import { logger } from '@/lib/logger'

const AUTO_APPROVE_THRESHOLD = 0.85

export interface BrandVoiceProfile {
  tone: string       // e.g. 'professional', 'casual', 'authoritative'
  style: string      // e.g. 'formal', 'conversational', 'thought-provoking'
  vocabulary: string // e.g. 'simple', 'standard', 'technical', 'sophisticated'
  emotion: string    // e.g. 'neutral', 'friendly', 'confident', 'inspiring'
  name?: string      // Persona name for context
}

export interface QualityDimensions {
  brandAlignment: number   // 0–1 — does content match the voice profile?
  clarity: number          // 0–1 — is the content clear and readable?
  engagement: number       // 0–1 — is the content likely to engage the audience?
  appropriateness: number  // 0–1 — is the content appropriate for the platform?
}

export interface QualityScore {
  overall: number             // 0–1 weighted average
  dimensions: QualityDimensions
  flags: string[]             // Issues detected (empty if clean)
  autoApprove: boolean        // true when overall >= AUTO_APPROVE_THRESHOLD
  reasoning: string           // Brief explanation from the scorer
}

const DEFAULT_BRAND_VOICE: BrandVoiceProfile = {
  tone: 'professional',
  style: 'conversational',
  vocabulary: 'standard',
  emotion: 'friendly',
}

/**
 * QualityScorer — stateless evaluator class.
 * Instantiate once and call scoreContent() as needed.
 */
export class QualityScorer {
  private apiKey: string

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.OPENROUTER_API_KEY
    if (!key) throw new Error('OPENROUTER_API_KEY is not configured')
    this.apiKey = key
  }

  /**
   * Score content against a brand voice profile.
   * Returns structured QualityScore with auto-approve flag.
   */
  async scoreContent(
    content: string,
    brandVoice: BrandVoiceProfile = DEFAULT_BRAND_VOICE
  ): Promise<QualityScore> {
    const systemPrompt = this.buildSystemPrompt(brandVoice)
    const userPrompt = this.buildUserPrompt(content)

    try {
      const rawScore = await this.callOpenRouter(systemPrompt, userPrompt)
      return this.parseScore(rawScore)
    } catch (err) {
      logger.error('quality-scorer: scoring failed, returning conservative score', { error: err })
      // Conservative fallback — low score, no auto-approve
      return {
        overall: 0.5,
        dimensions: { brandAlignment: 0.5, clarity: 0.5, engagement: 0.5, appropriateness: 0.5 },
        flags: ['Scoring service unavailable — manual review recommended'],
        autoApprove: false,
        reasoning: 'Automatic scoring failed; defaulting to manual review',
      }
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

Only include flags if there are actual issues. Empty array [] is valid.`
  }

  private buildUserPrompt(content: string): string {
    const preview = content.length > 2000 ? content.slice(0, 2000) + '...[truncated]' : content
    return `Evaluate this content:\n\n${preview}`
  }

  private async callOpenRouter(system: string, user: string): Promise<string> {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? 'https://synthex.social',
        'X-Title': process.env.OPENROUTER_SITE_NAME ?? 'Synthex',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-haiku',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 512,
        temperature: 0.2, // Low temperature for consistent scoring
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`OpenRouter error ${res.status}: ${errorText}`)
    }

    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? ''
  }

  private parseScore(raw: string): QualityScore {
    // Extract JSON from response (handle markdown code blocks if present)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in scorer response')
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      brandAlignment?: number
      clarity?: number
      engagement?: number
      appropriateness?: number
      flags?: string[]
      reasoning?: string
    }

    const dimensions: QualityDimensions = {
      brandAlignment: clamp(parsed.brandAlignment ?? 0.5),
      clarity: clamp(parsed.clarity ?? 0.5),
      engagement: clamp(parsed.engagement ?? 0.5),
      appropriateness: clamp(parsed.appropriateness ?? 0.5),
    }

    // Weighted average: brand alignment 30%, clarity 30%, engagement 25%, appropriateness 15%
    const overall =
      dimensions.brandAlignment * 0.3 +
      dimensions.clarity * 0.3 +
      dimensions.engagement * 0.25 +
      dimensions.appropriateness * 0.15

    return {
      overall: Math.round(overall * 100) / 100,
      dimensions,
      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
      autoApprove: overall >= AUTO_APPROVE_THRESHOLD,
      reasoning: parsed.reasoning ?? '',
    }
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

// Default singleton — exported for convenience
let _defaultScorer: QualityScorer | null = null

export function getQualityScorer(): QualityScorer {
  if (!_defaultScorer) {
    _defaultScorer = new QualityScorer()
  }
  return _defaultScorer
}
