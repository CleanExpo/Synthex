import type { WorkflowStepDefinition, StepContext, StepResult } from '../types'
import { logger } from '@/lib/logger'

export async function execute(stepDef: WorkflowStepDefinition, context: StepContext): Promise<StepResult> {
  try {
    const lastOutput = context.priorOutputs[context.priorOutputs.length - 1]
    const contentToAnalyse = lastOutput?.output ? JSON.stringify(lastOutput.output) : 'No prior content'
    const prompt = `Analyse this content and return JSON with keys: analysis (string), score (0-10), reasoning (string).\n\nContent:\n${contentToAnalyse}`
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
    let parsed: { analysis?: string; score?: number; reasoning?: string } = {}
    try { parsed = JSON.parse(rawContent) } catch { parsed = { analysis: rawContent, score: 5, reasoning: 'Parse error' } }
    const score = parsed.score ?? 5
    return {
      success: true,
      output: { analysis: parsed.analysis ?? '', score, reasoning: parsed.reasoning ?? '' },
      confidenceScore: Math.min(0.95, 0.6 + (score / 10) * 0.35),
    }
  } catch (err) {
    logger.error('ai-analyse step failed', { error: err, stepName: stepDef.name })
    return { success: false, error: err instanceof Error ? err.message : 'AI analysis failed', terminal: false }
  }
}
