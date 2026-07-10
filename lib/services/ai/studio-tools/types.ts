/**
 * Studio/MCP tool contract types — SYN-MCP-007 (SYN-1084).
 *
 * Extends the phase-1 StudioTool contract with the 4-plane namespace fields:
 *   - scope:     the namespace a tool belongs to. Tool registration over MCP is
 *                filtered by the caller key's scopes (SYN-MCP-004-1 registry);
 *                '*' in caller.scopes = all tools.
 *   - riskClass: what the tool can do to the world. v1 registers ONLY
 *                read/draft — publish and spend exist in the taxonomy but any
 *                tool carrying them is rejected by the registry guard and a
 *                machine-enforced test (capability tokens land post-004-2).
 *   - costClass: what the tool costs to run (free = no external spend,
 *                metered = cheap LLM/deterministic compute, expensive = real
 *                provider generation spend).
 *   - outputSchema: optional Zod object describing the tool's exact return
 *                shape. When present the MCP route registers it and emits
 *                structuredContent alongside text content. LOAD-BEARING
 *                CAVEAT (spike 2026-07-10): once declared, SDK 1.29.0
 *                VALIDATES structuredContent at call time and THROWS on
 *                mismatch — only declare shapes proven by a contract test.
 */
import { z } from 'zod';
import type { InitiatedBy } from '@/lib/services/ai/video/types';

/** Tool namespaces live in v1. 'tasks' and 'research' are reserved:
 *  tasks_* deferred to SYN-MCP-007b (tenant-isolation design gate),
 *  research_* lands with SYN-MCP-006 wiring. */
export type ToolScope =
  | 'creative'
  | 'approvals'
  | 'context'
  | 'performance'
  | 'tasks'
  | 'research';

export type RiskClass = 'read' | 'draft' | 'spend' | 'publish';

export type CostClass = 'free' | 'metered' | 'expensive';

export interface ToolContext {
  userId: string;
  organizationId: string;
  initiatedBy: InitiatedBy;
  /**
   * SYN-MCP-004-1: tool scopes of the caller's MCP key ('*' = all tools).
   * Consumed by SYN-MCP-007's scope-filtered tool registration.
   * Absent for non-MCP callers (REST routes, copilot).
   */
  scopes?: string[];
}

export interface StudioTool {
  name: string;
  description: string;
  /** Namespace this tool belongs to — drives scope-filtered registration. */
  scope: ToolScope;
  /** v1 invariant: only 'read' | 'draft' may be registered (machine-enforced). */
  riskClass: RiskClass;
  costClass: CostClass;
  schema: z.ZodTypeAny;
  /**
   * Exact return shape (z.object). Presence turns on structuredContent
   * emission + SDK call-time validation — never declare speculatively.
   */
  outputSchema?: z.ZodTypeAny;
  execute: (
    args: unknown,
    ctx: ToolContext
  ) => Promise<Record<string, unknown>>;
}
