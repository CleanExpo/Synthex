import type { WorkflowStepDefinition, StepContext, StepResult } from '../types';
import { logger } from '@/lib/logger';
import { getAIProvider } from '@/lib/ai/providers';

export async function execute(
  stepDef: WorkflowStepDefinition,
  context: StepContext
): Promise<StepResult> {
  try {
    const prompt = buildPrompt(
      stepDef.promptTemplate ?? 'Generate content for: {{workflowInput}}',
      context
    );

    // Get the configured AI provider
    const provider = getAIProvider();

    // Extract thinking effort from step config if provided
    const THINKING_EFFORTS = ['low', 'medium', 'high', 'max'] as const;
    const rawEffort = stepDef.config?.thinkingEffort as string | undefined;
    const thinkingEffort = THINKING_EFFORTS.find(level => level === rawEffort);

    // Call the provider with the appropriate parameters
    // (thinkingDisplay omitted — thinking content stays visible by default)
    const result = await provider.complete({
      model: 'auto', // Let the provider decide the model based on config
      messages: [{ role: 'user', content: prompt }],
      thinking: thinkingEffort,
      // For cache control, we could pass cache: true if configured
    });

    // Extract the content from the response
    const content = result.choices?.[0]?.message?.content ?? '';

    // Extract tokens used from the response
    const tokensUsed = result.usage?.total_tokens ?? 0;

    // Return structured data with the new fields
    return {
      success: true,
      output: {
        content: content,
        metadata: { model: result.model ?? 'unknown', tokensUsed },
      },
      confidenceScore: 0.9, // Placeholder - in a real implementation, this would be calculated
      retryMetadata: undefined,
      thinkingEffort: thinkingEffort,
      tokensUsed: tokensUsed,
    };
  } catch (err) {
    logger.error('ai-generate step failed', {
      error: err,
      stepName: stepDef.name,
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'AI generation failed',
      terminal: false,
    };
  }
}

function buildPrompt(template: string, context: StepContext): string {
  let prompt = template;
  if (context.workflowInput)
    prompt = prompt.replace(
      '{{workflowInput}}',
      JSON.stringify(context.workflowInput)
    );
  if (context.priorOutputs.length > 0) {
    const priorSummary = context.priorOutputs
      .map(
        p => `Step ${p.stepIndex} (${p.stepName}): ${JSON.stringify(p.output)}`
      )
      .join('\n');
    prompt += `\n\nPrevious steps:\n${priorSummary}`;
  }
  return prompt;
}
