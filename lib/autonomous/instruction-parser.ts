/**
 * Instruction Parser — Natural Language → WorkflowDefinition
 *
 * Uses the platform AI provider to convert free-text instructions
 * into structured workflow step definitions.
 */

import { z } from 'zod';
import { getAIProvider } from '@/lib/ai/providers';
import { logger } from '@/lib/logger';
import {
  INSTRUCTION_PARSER_SYSTEM_PROMPT,
  buildParserUserPrompt,
} from './instruction-prompts';
import type { ParsedInstruction, InstructionIntent } from './types';

// ---------------------------------------------------------------------------
// Validation schema for LLM output
// ---------------------------------------------------------------------------

const stepSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['ai', 'approval', 'action', 'validation']),
  promptTemplate: z.string().optional(),
  actionType: z.enum(['publish', 'schedule', 'notify']).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  autoApproveThreshold: z.number().min(0).max(1).optional(),
});

const parsedOutputSchema = z.object({
  summary: z.string().min(1),
  title: z.string().min(1).max(100),
  steps: z.array(stepSchema).min(1).max(10),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()),
  intents: z.array(
    z.enum([
      'create',
      'analyse',
      'enrich',
      'schedule',
      'publish',
      'notify',
      'review',
      'research',
      'optimise',
    ])
  ),
});

// ---------------------------------------------------------------------------
// Safety: ensure approval steps exist before publish/schedule actions
// ---------------------------------------------------------------------------

function ensureSafetyGates(
  steps: z.infer<typeof parsedOutputSchema>['steps']
): z.infer<typeof parsedOutputSchema>['steps'] {
  const result: typeof steps = [];

  for (const step of steps) {
    if (
      step.type === 'action' &&
      (step.actionType === 'publish' || step.actionType === 'schedule')
    ) {
      // Check if the previous step is already an approval
      const prev = result[result.length - 1];
      if (!prev || prev.type !== 'approval') {
        result.push({
          name: `Review before ${step.actionType}`,
          type: 'approval',
          config: { reason: `Human review required before ${step.actionType}` },
        });
      }
    }
    result.push(step);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main parser function
// ---------------------------------------------------------------------------

export async function parseInstruction(
  instruction: string
): Promise<ParsedInstruction> {
  const ai = getAIProvider();

  const response = await ai.complete({
    model: ai.models.balanced,
    messages: [
      { role: 'system', content: INSTRUCTION_PARSER_SYSTEM_PROMPT },
      { role: 'user', content: buildParserUserPrompt(instruction) },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) {
    throw new Error('AI provider returned empty response');
  }

  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = rawContent.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    logger.error('Failed to parse instruction response as JSON', {
      rawContent: rawContent.slice(0, 500),
    });
    throw new Error(
      'Failed to parse AI response — the instruction may be too complex'
    );
  }

  const validated = parsedOutputSchema.safeParse(parsed);
  if (!validated.success) {
    logger.error('Instruction parse output failed validation', {
      errors: validated.error.flatten().fieldErrors,
    });
    throw new Error(
      'AI response did not match expected format — try rephrasing your instruction'
    );
  }

  // Enforce safety gates
  const safeSteps = ensureSafetyGates(validated.data.steps);

  return {
    summary: validated.data.summary,
    title: validated.data.title,
    steps: safeSteps,
    confidence: validated.data.confidence,
    warnings: validated.data.warnings,
    intents: validated.data.intents as InstructionIntent[],
    originalInstruction: instruction,
  };
}
