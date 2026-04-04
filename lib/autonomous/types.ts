/**
 * Autonomous Instruction System — Types
 *
 * Bridges natural language instructions to the existing workflow engine.
 * No new Prisma models needed — uses WorkflowExecution.inputData for audit trail.
 */

import type { WorkflowStepDefinition } from '@/lib/workflow/types'

// ---------------------------------------------------------------------------
// Parsed Instruction (output of the NL parser)
// ---------------------------------------------------------------------------

export interface ParsedInstruction {
  /** Human-readable summary of what the instruction will do */
  summary: string
  /** Generated workflow title */
  title: string
  /** Workflow steps translated from the instruction */
  steps: WorkflowStepDefinition[]
  /** Parser confidence in the translation (0.0–1.0) */
  confidence: number
  /** Warnings about ambiguous or risky parts of the instruction */
  warnings: string[]
  /** The original instruction text (for audit trail) */
  originalInstruction: string
  /** Detected intent categories */
  intents: InstructionIntent[]
}

export type InstructionIntent =
  | 'create'
  | 'analyse'
  | 'enrich'
  | 'schedule'
  | 'publish'
  | 'notify'
  | 'review'
  | 'research'
  | 'optimise'

// ---------------------------------------------------------------------------
// Parse Request / Response (API contract)
// ---------------------------------------------------------------------------

export interface ParseRequest {
  instruction: string
}

export interface ParseResponse {
  parsed: ParsedInstruction
}

export interface ExecuteRequest {
  title: string
  steps: WorkflowStepDefinition[]
  inputData?: Record<string, unknown>
}

export interface ExecuteResponse {
  execution: {
    id: string
    title: string
    status: string
    totalSteps: number
    createdAt: string
  }
}
