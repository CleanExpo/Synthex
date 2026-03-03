import type { WorkflowStepDefinition, StepContext, StepResult } from '../types'

export async function execute(_stepDef: WorkflowStepDefinition, _context: StepContext): Promise<StepResult> {
  // Human approval steps always pause the workflow — they never call AI
  return {
    success: true,
    output: { waitingFor: 'human_approval' },
    requiresApproval: true,
  }
}
