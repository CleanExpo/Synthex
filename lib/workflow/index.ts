/**
 * Workflow Engine — Public API
 * Phase 62: Multi-step Workflow Engine
 * Architecture: Minions-inspired blueprint pattern
 */

// Core types
export type {
  WorkflowStepDefinition,
  WorkflowDefinition,
  StepContext,
  StepResult,
  StepResultSuccess,
  StepResultFailure,
  GateDecision,
  GateOutcome,
  StepType,
  WorkflowExecutionStatus,
  StepExecutionStatus,
  PriorStepOutput,
} from './types'

// Orchestrator (deterministic flow controller)
export {
  advanceWorkflow,
  handleStepResult,
  approveCurrentStep,
  cancelExecution,
} from './orchestrator'

// Context builder (token-budgeted context assembly)
export { buildStepContext } from './context-builder'

// Step executor (type router)
export { executeStep } from './step-executor'
