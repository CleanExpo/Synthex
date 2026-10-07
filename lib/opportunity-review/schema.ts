import { z } from 'zod';

export const MAX_PROPOSAL_BYTES = 240000;
export const MAX_EXPORT_BYTES = 250000;
const jsonBytes = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;
const text = (max = 2000) => z.string().trim().min(1).max(max);
const timestamp = z.string().datetime({ offset: true });
const url = z
  .string()
  .trim()
  .max(2000)
  .url()
  .refine(value => {
    try {
      const parsed = new URL(value);
      return (
        ['http:', 'https:'].includes(parsed.protocol) &&
        !parsed.username &&
        !parsed.password
      );
    } catch {
      return false;
    }
  }, 'Use an HTTP or HTTPS source URL');
export const UniteEvidenceSchema = z
  .object({ reference: text(500), observation: text(), capturedAt: timestamp })
  .strict();
export const ProposalInputSchema = z
  .object({
    title: text(200),
    targetProject: z
      .object({
        name: text(200),
        repository: text(200).regex(
          /^[\w.-]+\/[\w.-]+$/,
          'Use an owner/repository reference'
        ),
      })
      .strict(),
    targetBusiness: text(200),
    customerProblemHypothesis: text(),
    sources: z
      .array(
        z
          .object({
            url,
            capturedAt: timestamp,
            publishedAt: timestamp.optional(),
            claims: z.array(text()).min(1).max(20),
          })
          .strict()
      )
      .min(1)
      .max(20),
    uniteEvidence: z.array(UniteEvidenceSchema).max(50),
    confidence: z.number().finite().min(0).max(1),
    assumptions: z.array(text()).min(1).max(20),
    uncertainties: z.array(text()).min(1).max(20),
    suggestedOwner: text(200),
    kpi: z
      .object({ name: text(200), unit: text(100), baselineRequirement: text() })
      .strict(),
    successCriteria: text(),
    stopCriteria: text(),
    nextValidationStep: text(),
  })
  .strict()
  .refine(
    value => jsonBytes(value) <= MAX_PROPOSAL_BYTES,
    'Proposal exceeds the 240000-byte review limit'
  );

export const CaptureProposalSchema = z
  .object({ clientRequestId: z.string().uuid(), proposal: ProposalInputSchema })
  .strict();
export const ReviewActionSchema = z
  .object({
    id: text(100),
    expectedRevision: z.number().int().min(1),
    action: z.enum(['accept', 'reject', 'request-evidence', 'add-evidence']),
    note: text(),
    uniteEvidence: z.array(UniteEvidenceSchema).min(1).max(50).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.action === 'add-evidence' && !value.uniteEvidence)
      ctx.addIssue({
        code: 'custom',
        path: ['uniteEvidence'],
        message: 'New Unite evidence is required',
      });
    if (value.action !== 'add-evidence' && value.uniteEvidence)
      ctx.addIssue({
        code: 'custom',
        path: ['uniteEvidence'],
        message: 'Evidence is only allowed with add-evidence',
      });
  });

export const ProposalSchema = ProposalInputSchema.safeExtend({
  spendBoundary: z
    .object({ currency: z.literal('AUD'), maxSpend: z.literal(0) })
    .strict(),
  demandValidated: z.literal(false),
  revenueValidated: z.literal(false),
}).strict();
export const ProposalRecordSchema = z
  .object({
    id: text(100),
    revision: z.number().int().min(1),
    proposal: ProposalSchema,
    review: z
      .object({
        state: z.enum([
          'pending',
          'accepted',
          'rejected',
          'evidence_requested',
        ]),
        note: z.string().max(2000),
        reviewedById: text(200).optional(),
        reviewedAt: timestamp.optional(),
      })
      .strict(),
    executionBlocked: z.literal(true),
    approvalGate: z.literal('production_blocked'),
    scenarioState: z.literal('blocked'),
    status: z.enum(['pending', 'blocked']),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict();
export const NexusExportSchema = z
  .object({
    version: z.literal(1),
    packetId: text(100),
    revision: z.number().int().min(1),
    executionBlocked: z.literal(true),
    review: z.object({ state: z.literal('accepted') }).strict(),
    proposal: ProposalSchema,
    opportunity: z
      .object({
        name: text(200),
        stage: z.literal('blocked_review'),
        status: z.literal('blocked_review'),
        source: z.literal('synthex'),
        source_detail: text(1000),
        next_action: text(),
      })
      .strict(),
  })
  .strict()
  .refine(
    value => jsonBytes(value) <= MAX_EXPORT_BYTES,
    'Export exceeds the 250000-byte import limit'
  );
export type ProposalInput = z.infer<typeof ProposalInputSchema>;
export type CaptureProposal = z.infer<typeof CaptureProposalSchema>;
export type ReviewAction = z.infer<typeof ReviewActionSchema>;
export type ProposalRecord = z.infer<typeof ProposalRecordSchema>;
export type NexusExport = z.infer<typeof NexusExportSchema>;
export type UniteEvidence = z.infer<typeof UniteEvidenceSchema>;
