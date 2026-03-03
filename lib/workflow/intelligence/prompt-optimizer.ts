/**
 * Prompt Optimizer — Phase 65
 *
 * Uses AI to suggest improved prompt templates based on pattern analysis.
 * Analyses low-confidence step outputs and generates improved prompt suggestions.
 *
 * Architecture:
 * - NEVER auto-applies — always returns suggestion for human approval
 * - Uses OpenRouter claude-3-haiku for fast, cost-effective optimisation
 * - Provides concrete improvement rationale alongside the suggested prompt
 */

import { logger } from '@/lib/logger'

export interface PromptOptimisationResult {
  originalPrompt: string
  suggestedPrompt: string
  rationale: string
  expectedImprovements: string[]
  confidenceInSuggestion: number // 0–1 — how confident the optimizer is in its suggestion
}

/**
 * Generate an improved prompt template based on low-confidence output samples.
 *
 * @param original — The current prompt template
 * @param lowConfidenceSamples — Array of output strings that scored < threshold
 * @param highConfidenceSamples — Array of output strings that scored well (for comparison)
 * @returns Suggested improved prompt with rationale (NEVER auto-applied)
 */
export async function optimizePrompt(
  original: string,
  lowConfidenceSamples: string[],
  highConfidenceSamples: string[]
): Promise<PromptOptimisationResult> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured')
  }

  const systemPrompt = `You are a prompt engineering specialist for AI marketing automation.
Your task: analyse content generation results and suggest an improved prompt template.

Rules:
- Return ONLY valid JSON matching the schema below
- Be specific and actionable in your suggestions
- Preserve the original intent while improving clarity and direction
- Use {{variable}} syntax for template variables (same as original)

Response schema:
{
  "suggestedPrompt": "<improved prompt template>",
  "rationale": "<1-2 sentence explanation of why this improves the original>",
  "expectedImprovements": ["<improvement 1>", "<improvement 2>"],
  "confidenceInSuggestion": <0.0 to 1.0>
}`

  const lowSamples = lowConfidenceSamples.slice(0, 3).join('\n---\n')
  const highSamples = highConfidenceSamples.slice(0, 3).join('\n---\n')

  const userPrompt = `Original prompt template:
${original || '(no template — default generation)'}

Low-confidence outputs (scored < 75%):
${lowSamples || '(none available)'}

High-confidence outputs (scored ≥ 85%):
${highSamples || '(none available)'}

Suggest an improved prompt template.`

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? 'https://synthex.social',
        'X-Title': process.env.OPENROUTER_SITE_NAME ?? 'Synthex',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-haiku',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1024,
        temperature: 0.3,
      }),
    })

    if (!res.ok) {
      throw new Error(`OpenRouter error: ${res.status}`)
    }

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content ?? ''

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in optimizer response')

    const parsed = JSON.parse(jsonMatch[0]) as {
      suggestedPrompt?: string
      rationale?: string
      expectedImprovements?: string[]
      confidenceInSuggestion?: number
    }

    return {
      originalPrompt: original,
      suggestedPrompt: parsed.suggestedPrompt ?? original,
      rationale: parsed.rationale ?? 'No rationale provided',
      expectedImprovements: Array.isArray(parsed.expectedImprovements) ? parsed.expectedImprovements : [],
      confidenceInSuggestion: Math.max(0, Math.min(1, parsed.confidenceInSuggestion ?? 0.7)),
    }
  } catch (err) {
    logger.error('prompt-optimizer: optimisation failed', { error: err })
    throw err
  }
}
