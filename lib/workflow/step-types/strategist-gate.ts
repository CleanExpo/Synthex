/**
 * Workflow validation step — senior-strategist final-gate (AT-004).
 */

import type { WorkflowStepDefinition, StepContext, StepResult } from '../types';
import {
  extractDraftForStrategistGate,
  priorBrandVoicePassed,
  runStrategistGate,
} from '@/lib/agency/strategist-gate';

export async function execute(
  stepDef: WorkflowStepDefinition,
  context: StepContext
): Promise<StepResult> {
  void stepDef;

  const stamp = await runStrategistGate({
    draft: extractDraftForStrategistGate(context.priorOutputs),
    organizationId: context.organizationId,
    brandVoicePassed: priorBrandVoicePassed(context.priorOutputs),
  });

  return {
    success: true,
    output: stamp,
    confidenceScore: stamp.pass ? 0.95 : 0.2,
    // Hold for revision when strategist does not clear the CEO queue.
    requiresApproval: !stamp.pass,
  };
}
