/**
 * Ensure NL-to-workflow executions always include a brand-voice validation
 * step before publish/schedule or human approval (AT-027).
 *
 * The parser may omit the gate; execute must not.
 */

import type { WorkflowStepDefinition } from '@/lib/workflow/types';

export const BRAND_VOICE_GATE_STEP: WorkflowStepDefinition = {
  name: 'Brand voice gate',
  type: 'validation',
  config: { subType: 'brand-voice', passScore: 75 },
};

function isBrandVoiceGate(step: WorkflowStepDefinition): boolean {
  return step.type === 'validation' && step.config?.subType === 'brand-voice';
}

/**
 * Return steps with a brand-voice validation gate inserted before the first
 * approval or publish/schedule action. No-op when a gate is already present.
 * Appends when neither sink exists (analysis-only workflows still get the gate).
 */
export function ensureBrandVoiceGate(
  steps: WorkflowStepDefinition[]
): WorkflowStepDefinition[] {
  if (steps.some(isBrandVoiceGate)) {
    return steps;
  }

  const insertAt = steps.findIndex(
    step =>
      step.type === 'approval' ||
      (step.type === 'action' &&
        (step.actionType === 'publish' || step.actionType === 'schedule'))
  );

  if (insertAt >= 0) {
    return [
      ...steps.slice(0, insertAt),
      BRAND_VOICE_GATE_STEP,
      ...steps.slice(insertAt),
    ];
  }

  return [...steps, BRAND_VOICE_GATE_STEP];
}
