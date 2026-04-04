import type { WorkflowStepDefinition, StepContext, StepResult } from '../types'
import { logger } from '@/lib/logger'

export async function execute(stepDef: WorkflowStepDefinition, context: StepContext): Promise<StepResult> {
  try {
    const prompt = buildPrompt(stepDef.promptTemplate ?? 'Generate content for: {{workflowInput}}', context)
    // Call OpenRouter via fetch (no SDK needed — use existing OPENROUTER_API_KEY env)
    const response = await callOpenRouter(prompt)
    return {
      success: true,
      output: { content: response.content, metadata: { model: response.model, tokensUsed: response.tokensUsed } },
      confidenceScore: response.confidenceScore,
    }
  } catch (err) {
    logger.error('ai-generate step failed', { error: err, stepName: stepDef.name })
    return { success: false, error: err instanceof Error ? err.message : 'AI generation failed', terminal: false }
  }
}

function buildPrompt(template: string, context: StepContext): string {
  let prompt = template
  if (context.workflowInput) prompt = prompt.replace('{{workflowInput}}', JSON.stringify(context.workflowInput))
  if (context.priorOutputs.length > 0) {
    const priorSummary = context.priorOutputs.map(p => `Step ${p.stepIndex} (${p.stepName}): ${JSON.stringify(p.output)}`).join('\n')
    prompt += `\n\nPrevious steps:\n${priorSummary}`
  }
  return prompt
}

async function callOpenRouter(prompt: string): Promise<{ content: string; model: string; tokensUsed: number; confidenceScore: number }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured')

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
    }),
  })
  if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`)
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content ?? ''
  // Estimate confidence from content length (simple heuristic — real scoring in Phase 63)
  const confidenceScore = Math.min(0.95, 0.7 + (content.length / 5000) * 0.25)
  return { content, model: data.model ?? 'unknown', tokensUsed: data.usage?.total_tokens ?? 0, confidenceScore }
}
