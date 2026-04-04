import type { WorkflowStepDefinition, StepContext, StepResult } from '../types'
import { logger } from '@/lib/logger'

export async function execute(stepDef: WorkflowStepDefinition, context: StepContext): Promise<StepResult> {
  try {
    const lastOutput = context.priorOutputs[context.priorOutputs.length - 1]
    const baseContent = lastOutput?.output ? JSON.stringify(lastOutput.output) : ''
    const prompt = `Enrich this content with hashtags, CTAs, and metadata. Return JSON with: enrichedContent (string), additions (object with hashtags array, cta string).\n\nContent:\n${baseContent}`
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured')
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'anthropic/claude-3-haiku', messages: [{ role: 'user', content: prompt }], max_tokens: 1024 }),
    })
    if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`)
    const data = await res.json()
    const rawContent = data.choices?.[0]?.message?.content ?? '{}'
    let parsed: { enrichedContent?: string; additions?: unknown } = {}
    try { parsed = JSON.parse(rawContent) } catch { parsed = { enrichedContent: rawContent, additions: {} } }
    return {
      success: true,
      output: { enrichedContent: parsed.enrichedContent ?? rawContent, additions: parsed.additions ?? {} },
      confidenceScore: 0.88,
    }
  } catch (err) {
    logger.error('ai-enrich step failed', { error: err, stepName: stepDef.name })
    return { success: false, error: err instanceof Error ? err.message : 'AI enrichment failed', terminal: false }
  }
}
