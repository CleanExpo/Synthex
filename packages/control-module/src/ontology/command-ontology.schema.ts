import { z } from 'zod';

export const ScenarioStateSchema = z.enum([
  'draft',
  'needs_evidence',
  'ready_for_review',
  'approved',
  'blocked',
]);

export const ApprovalGateSchema = z.enum([
  'human_review',
  'client_review',
  'production_blocked',
]);

export const ProviderModeSchema = z.enum(['live', 'mock', 'draft', 'blocked']);

export const ProviderReadinessSchema = z.object({
  provider: z.string().min(1),
  mode: ProviderModeSchema,
  reason: z.string().min(1),
});

export const CommandPacketSchema = z.object({
  id: z.string().min(1),
  boardInputId: z.string().min(1),
  title: z.string().min(1),
  ontologyRefs: z.array(z.string().min(1)),
  teamRoute: z.array(z.string().min(1)),
  scenarioState: ScenarioStateSchema,
  approvalGate: ApprovalGateSchema,
  risks: z.array(z.string().min(1)),
  nextAction: z.string().min(1),
  outcomeMetric: z.string().min(1),
});

export type ScenarioState = z.infer<typeof ScenarioStateSchema>;
export type ApprovalGate = z.infer<typeof ApprovalGateSchema>;
export type ProviderMode = z.infer<typeof ProviderModeSchema>;
export type ProviderReadiness = z.infer<typeof ProviderReadinessSchema>;
export type CommandPacket = z.infer<typeof CommandPacketSchema>;
