import { z } from 'zod';
import { ApprovalGateSchema } from '../ontology/command-ontology.schema';

export const ResearchCouncilRoleSchema = z.enum([
  'market-researcher',
  'technical-architect',
  'brand-strategist',
  'contrarian-reviewer',
  'chair',
]);

export const ResearchEvidenceRefSchema = z.object({
  ref: z.string().min(1),
  sourceType: z.enum(['wiki', 'source', 'repo', 'provider', 'user_input']),
  summary: z.string().min(1),
});

export const ResearchCouncilFindingSchema = z.object({
  role: ResearchCouncilRoleSchema,
  claim: z.string().min(1),
  evidenceRefs: z.array(ResearchEvidenceRefSchema).min(1),
  confidence: z.number().min(0).max(1),
  risks: z.array(z.string().min(1)),
  nextAction: z.string().min(1),
});

export const ResearchCouncilPacketSchema = z.object({
  id: z.string().min(1),
  boardInputId: z.string().min(1),
  question: z.string().min(1),
  councilRoute: z.array(ResearchCouncilRoleSchema).min(1),
  findings: z.array(ResearchCouncilFindingSchema).min(1),
  synthesis: z.object({
    decision: z.string().min(1),
    confidence: z.number().min(0).max(1),
    openQuestions: z.array(z.string().min(1)),
  }),
  approvalGate: ApprovalGateSchema,
  learningLoop: z.object({
    metric: z.string().min(1),
    keepCriteria: z.string().min(1),
    discardCriteria: z.string().min(1),
  }),
});

export type ResearchCouncilRole = z.infer<typeof ResearchCouncilRoleSchema>;
export type ResearchEvidenceRef = z.infer<typeof ResearchEvidenceRefSchema>;
export type ResearchCouncilFinding = z.infer<
  typeof ResearchCouncilFindingSchema
>;
export type ResearchCouncilPacket = z.infer<typeof ResearchCouncilPacketSchema>;
