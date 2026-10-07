import { createHash } from 'node:crypto';
import type { CommandPacket, Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  CaptureProposalSchema,
  ProposalRecordSchema,
  ReviewActionSchema,
  NexusExportSchema,
  type NexusExport,
  type ProposalRecord,
} from './schema';

export interface ProposalContext {
  organizationId: string;
  userId: string;
}
type Transaction = Pick<Prisma.TransactionClient, 'commandPacket'>;
export interface ProposalDatabase extends Transaction {
  $transaction<T>(
    operation: (transaction: Transaction) => Promise<T>
  ): Promise<T>;
}
const SOURCE = 'opportunity_review';
const RoutingSchema = z
  .object({
    kind: z.literal(SOURCE),
    version: z.literal(1),
    clientRequestId: z.string().uuid(),
    captureFingerprint: z.string(),
    record: ProposalRecordSchema,
  })
  .strict();

export class ProposalError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}
const scope = (context: ProposalContext) => {
  if (!context.organizationId || !context.userId)
    throw new ProposalError(
      'unauthorised',
      401,
      'Authentication and organisation are required'
    );
  return { organizationId: context.organizationId, source: SOURCE };
};
function record(row: CommandPacket): ProposalRecord {
  const metadata = RoutingSchema.parse(row.routingHints);
  if (
    row.approvalGate !== 'production_blocked' ||
    row.scenarioState !== 'blocked' ||
    row.status !== metadata.record.status
  )
    throw new ProposalError(
      'unsafe_packet',
      409,
      'Proposal execution block is inconsistent'
    );
  return ProposalRecordSchema.parse({
    ...metadata.record,
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export function createOpportunityReviewService(database: ProposalDatabase) {
  async function createProposal(
    context: ProposalContext,
    input: unknown
  ): Promise<{ item: ProposalRecord; created: boolean }> {
    const where = scope(context);
    const capture = CaptureProposalSchema.parse(input);
    const id =
      'op_' +
      createHash('sha256')
        .update(context.organizationId + '\0' + capture.clientRequestId)
        .digest('hex');
    const captureFingerprint = createHash('sha256')
      .update(JSON.stringify(capture.proposal))
      .digest('hex');
    const now = new Date().toISOString();
    const item = ProposalRecordSchema.parse({
      id,
      revision: 1,
      proposal: {
        ...capture.proposal,
        spendBoundary: { currency: 'AUD', maxSpend: 0 },
        demandValidated: false,
        revenueValidated: false,
      },
      review: { state: 'pending', note: '' },
      executionBlocked: true,
      approvalGate: 'production_blocked',
      scenarioState: 'blocked',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    return database.$transaction(async tx => {
      const inserted = await tx.commandPacket.createMany({
        data: {
          id,
          ...where,
          createdById: context.userId,
          speaker: context.userId,
          rawText: JSON.stringify(capture.proposal),
          cleanedText: capture.proposal.customerProblemHypothesis,
          sensitivity: 'confidential',
          boardInputId: id,
          title: item.proposal.title,
          ontologyRefs: [],
          teamRoute: [],
          scenarioState: 'blocked',
          approvalGate: 'production_blocked',
          risks: item.proposal.uncertainties,
          nextAction: item.proposal.nextValidationStep,
          outcomeMetric: item.proposal.kpi.name,
          status: 'pending',
          safetyFlags: [
            'production_blocked',
            'execution_blocked',
            'demand_unvalidated',
            'revenue_unvalidated',
            'zero_spend_aud',
          ],
          evidenceRefs: item.proposal.uniteEvidence.map(e => e.reference),
          routingHints: {
            kind: SOURCE,
            version: 1,
            clientRequestId: capture.clientRequestId,
            captureFingerprint,
            record: item,
          } as Prisma.InputJsonValue,
        },
        skipDuplicates: true,
      });
      const row = await tx.commandPacket.findFirst({ where: { id, ...where } });
      if (!row)
        throw new ProposalError(
          'idempotency_conflict',
          409,
          'Capture identifier conflict'
        );
      if (
        RoutingSchema.parse(row.routingHints).captureFingerprint !==
        captureFingerprint
      )
        throw new ProposalError(
          'idempotency_conflict',
          409,
          'This capture identifier was used for a different proposal'
        );
      return { item: record(row), created: inserted.count === 1 };
    });
  }
  async function listProposals(
    context: ProposalContext
  ): Promise<ProposalRecord[]> {
    const rows = await database.commandPacket.findMany({
      where: scope(context),
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map(record);
  }
  async function reviewProposal(
    context: ProposalContext,
    input: unknown
  ): Promise<ProposalRecord> {
    const where = scope(context);
    const action = ReviewActionSchema.parse(input);
    return database.$transaction(async tx => {
      const row = await tx.commandPacket.findFirst({
        where: { id: action.id, ...where },
      });
      if (!row) throw new ProposalError('not_found', 404, 'Proposal not found');
      const current = record(row);
      if (current.review.state === 'rejected')
        throw new ProposalError(
          'rejected_terminal',
          409,
          'Rejected proposals cannot be reopened'
        );
      if (current.revision !== action.expectedRevision)
        throw new ProposalError(
          'revision_conflict',
          409,
          'Proposal changed; reload before reviewing'
        );
      if (action.action === 'accept' && !current.proposal.uniteEvidence.length)
        throw new ProposalError(
          'unite_evidence_required',
          409,
          'Separate Unite evidence is required for acceptance'
        );
      if (
        action.action === 'accept' &&
        current.review.state === 'evidence_requested'
      )
        throw new ProposalError(
          'new_evidence_required',
          409,
          'Add new evidence before acceptance'
        );
      const evidence = [...current.proposal.uniteEvidence];
      if (action.action === 'add-evidence') {
        const normalise = (value: string) =>
          value.trim().replace(/\s+/g, ' ').toLowerCase();
        const known = new Set(
          evidence.map(value => normalise(value.observation))
        );
        for (const value of action.uniteEvidence!) {
          const key = normalise(value.observation);
          if (known.has(key))
            throw new ProposalError(
              'duplicate_evidence',
              409,
              'Add a new observation, not a duplicate or recaptured evidence'
            );
          known.add(key);
          evidence.push(value);
        }
      }
      const state =
        action.action === 'reject'
          ? 'rejected'
          : action.action === 'request-evidence'
            ? 'evidence_requested'
            : action.action === 'add-evidence'
              ? 'pending'
              : 'accepted';
      const metadata = RoutingSchema.parse(row.routingHints);
      const next = ProposalRecordSchema.parse({
        ...current,
        status: state === 'rejected' ? 'blocked' : 'pending',
        proposal: { ...current.proposal, uniteEvidence: evidence },
        revision: current.revision + 1,
        review: {
          state,
          note: action.note,
          reviewedById: context.userId,
          reviewedAt: new Date().toISOString(),
        },
      });
      const changed = await tx.commandPacket.updateMany({
        where: {
          id: action.id,
          ...where,
          status: current.status,
          approvalGate: 'production_blocked',
          scenarioState: 'blocked',
          routingHints: {
            path: ['record', 'revision'],
            equals: action.expectedRevision,
          },
        },
        data: {
          status: next.status,
          evidenceRefs: evidence.map(value => value.reference),
          routingHints: { ...metadata, record: next } as Prisma.InputJsonValue,
        },
      });
      if (changed.count !== 1)
        throw new ProposalError(
          'revision_conflict',
          409,
          'Proposal changed; reload before reviewing'
        );
      const updated = await tx.commandPacket.findFirst({
        where: { id: action.id, ...where },
      });
      if (!updated)
        throw new ProposalError('not_found', 404, 'Proposal not found');
      return record(updated);
    });
  }
  async function exportProposal(
    context: ProposalContext,
    id: string
  ): Promise<NexusExport> {
    const row = await database.commandPacket.findFirst({
      where: { id, ...scope(context) },
    });
    if (!row) throw new ProposalError('not_found', 404, 'Proposal not found');
    const item = record(row);
    if (item.review.state !== 'accepted')
      throw new ProposalError(
        'review_required',
        409,
        'Explicit acceptance is required before export'
      );
    return NexusExportSchema.parse({
      version: 1,
      packetId: id,
      revision: item.revision,
      executionBlocked: true,
      review: { state: 'accepted' },
      proposal: item.proposal,
      opportunity: {
        name: item.proposal.title,
        stage: 'blocked_review',
        status: 'blocked_review',
        source: 'synthex',
        source_detail: `Synthex proposal ${id} revision ${item.revision}; target ${item.proposal.targetProject.repository}; demand and revenue unvalidated; zero-spend AUD review only.`,
        next_action: item.proposal.nextValidationStep,
      },
    });
  }
  return { createProposal, listProposals, reviewProposal, exportProposal };
}
