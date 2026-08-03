import { z } from 'zod';

export const VISION_LENSES = [
  'signal-separation',
  'upstream-causes',
  'downstream-effects',
  'stakeholder-shifts',
  'outside-analogies',
  'counterfactuals',
  'adjacent-value',
] as const;

export const VisionLensSchema = z.enum(VISION_LENSES);
export type VisionLens = z.infer<typeof VisionLensSchema>;

export const EvidenceStateSchema = z.enum([
  'verified',
  'inferred',
  'opinion',
  'assumption',
  'contradicted',
  'missing',
]);

export const ContextSignalKindSchema = z.enum([
  'origin-signal',
  'website',
  'social-page',
  'product-page',
  'competitor-page',
  'document',
  'note',
  'constraint',
  'capability',
  'prior-attempt',
]);

export const ContextSignalSchema = z
  .object({
    id: z.string().min(1).max(120),
    kind: ContextSignalKindSchema,
    label: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1).max(20_000),
    sourceUrl: z.string().url().max(2_000).optional(),
    evidenceState: EvidenceStateSchema,
    capturedAt: z.string().datetime(),
    provenance: z.string().trim().min(1).max(500),
  })
  .strict();

export type ContextSignal = z.infer<typeof ContextSignalSchema>;

export const ContextFieldSchema = z
  .object({
    workspaceId: z.string().min(1),
    organizationId: z.string().min(1),
    version: z.number().int().positive(),
    originSignal: z.string().trim().min(1).max(12_000),
    signals: z.array(ContextSignalSchema).min(1).max(100),
    contradictions: z.array(z.string().trim().min(1).max(1_000)).max(50),
    unknowns: z.array(z.string().trim().min(1).max(1_000)).max(50),
    createdAt: z.string().datetime(),
  })
  .strict();

export type ContextField = z.infer<typeof ContextFieldSchema>;

export const LensFindingSchema = z
  .object({
    lens: VisionLensSchema,
    findings: z.array(z.string().trim().min(1).max(1_500)).min(1).max(12),
    evidenceRefs: z.array(z.string().trim().min(1).max(500)).max(30),
    unknowns: z.array(z.string().trim().min(1).max(1_000)).max(12),
  })
  .strict();

export const ResearchBranchSchema = z
  .object({
    id: z.string().min(1).max(120),
    lens: VisionLensSchema,
    question: z.string().trim().min(12).max(1_000),
    decisionCouldChange: z.string().trim().min(12).max(1_000),
    contextGap: z.string().trim().min(12).max(1_000),
    usefulDistance: z.string().trim().min(12).max(1_000),
    supportSignals: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
    weakenSignals: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
    stopCondition: z.string().trim().min(12).max(1_000),
  })
  .strict();

export type ResearchBranch = z.infer<typeof ResearchBranchSchema>;

export const VisionHypothesisSchema = z
  .object({
    id: z.string().min(1).max(120),
    version: z.number().int().positive(),
    title: z.string().trim().min(3).max(200),
    causalMechanism: z.string().trim().min(20).max(2_000),
    desiredChange: z.string().trim().min(12).max(1_000),
    affectedStakeholders: z
      .array(z.string().trim().min(1).max(200))
      .min(1)
      .max(20),
    evidenceFor: z.array(z.string().trim().min(1).max(500)).max(30),
    evidenceAgainst: z.array(z.string().trim().min(1).max(500)).min(1).max(30),
    invalidatingAssumption: z.string().trim().min(12).max(1_000),
    mainRisk: z.string().trim().min(12).max(1_000),
    adjacentValue: z.string().trim().min(12).max(1_000),
    researchBranchIds: z.array(z.string().min(1).max(120)).min(1).max(20),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export type VisionHypothesis = z.infer<typeof VisionHypothesisSchema>;

export const VisionMapSchema = z
  .object({
    contextVersion: z.number().int().positive(),
    lensFindings: z.array(LensFindingSchema).length(VISION_LENSES.length),
    researchBranches: z.array(ResearchBranchSchema).min(1).max(50),
    hypotheses: z.array(VisionHypothesisSchema).min(3).max(8),
    synthesis: z.string().trim().min(20).max(4_000),
  })
  .strict();

export type VisionMap = z.infer<typeof VisionMapSchema>;

export const AnchoringIssueCodeSchema = z.enum([
  'origin-copy',
  'near-copy',
  'source-routed-capability',
  'missing-lens',
  'duplicate-lens',
  'duplicate-mechanism',
  'missing-research-branch',
  'unlinked-research-branch',
  'context-version-mismatch',
]);

export const AnchoringIssueSchema = z
  .object({
    code: AnchoringIssueCodeSchema,
    path: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

export type AnchoringIssue = z.infer<typeof AnchoringIssueSchema>;

export const AnchoringAuditSchema = z
  .object({
    passed: z.boolean(),
    issues: z.array(AnchoringIssueSchema),
    checkedAt: z.string().datetime(),
  })
  .strict();

export type AnchoringAudit = z.infer<typeof AnchoringAuditSchema>;

export const IndependentEvaluationSchema = z
  .object({
    passed: z.boolean(),
    confidence: z.number().min(0).max(1),
    reasons: z.array(z.string().trim().min(1).max(1_000)).min(1).max(20),
  })
  .strict();

export type IndependentEvaluation = z.infer<typeof IndependentEvaluationSchema>;

export const ModelRunMetadataSchema = z
  .object({
    provider: z.string().trim().min(1).max(100),
    model: z.string().trim().min(1).max(200),
    promptTokens: z.number().int().nonnegative(),
    completionTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
    costMicros: z.number().int().nonnegative().optional(),
  })
  .strict();

export type ModelRunMetadata = z.infer<typeof ModelRunMetadataSchema>;

export const GoalApprovalSchema = z
  .object({
    hypothesisId: z.string().min(1).max(120),
    hypothesisVersion: z.number().int().positive(),
    primaryStakeholder: z.string().trim().min(1).max(200),
    acceptanceCriteria: z
      .array(z.string().trim().min(8).max(1_000))
      .min(1)
      .max(20),
    exclusions: z.array(z.string().trim().min(1).max(1_000)).max(20),
    authorityBoundaries: z
      .array(z.string().trim().min(1).max(1_000))
      .min(1)
      .max(20),
    approvedBy: z.string().min(1),
    approvedAt: z.string().datetime(),
  })
  .strict();

export type GoalApproval = z.infer<typeof GoalApprovalSchema>;

export const GoalContractSchema = GoalApprovalSchema.extend({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  organizationId: z.string().min(1),
  contextVersion: z.number().int().positive(),
  desiredChange: z.string().trim().min(12).max(1_000),
  evidenceRefs: z.array(z.string().min(1).max(500)).max(50),
  status: z.literal('approved'),
}).strict();

export type GoalContract = z.infer<typeof GoalContractSchema>;

export const WorkPacketSchema = z
  .object({
    goalContractId: z.string().min(1),
    organizationId: z.string().min(1),
    workspaceId: z.string().min(1),
    goal: z.string().min(1),
    acceptanceCriteria: z.array(z.string().min(1)).min(1),
    exclusions: z.array(z.string().min(1)),
    authorityBoundaries: z.array(z.string().min(1)).min(1),
    evidenceRefs: z.array(z.string().min(1)),
  })
  .strict();

export type WorkPacket = z.infer<typeof WorkPacketSchema>;
