import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  ContextFieldSchema,
  ContextSignalKindSchema,
  GoalApprovalSchema,
  type ContextField,
} from './contracts';
import {
  createIntentScapeEngine,
  IntentScapeNotFoundError,
  VisionExpansionRejectedError,
} from './engine';
import {
  createProductionVisionEvaluator,
  createProductionVisionGenerator,
  type IntentScapeModelPricing,
} from './model-adapters';
import { createProductionMarkdownArtifactStore } from './markdown-store';
import { PrismaIntentScapeRepository } from './prisma-repository';

export const CreateWorkspaceRequestSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    originSignal: z.string().trim().min(3).max(12_000),
    retentionClass: z
      .enum(['standard', 'prospect', 'legal_hold'])
      .default('standard'),
  })
  .strict();

export const IntentScapeWorkspaceIdSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/);

const AdditionalSignalKindSchema = ContextSignalKindSchema.exclude([
  'origin-signal',
]);

export const AddSignalsRequestSchema = z
  .object({
    expectedContextVersion: z.number().int().positive(),
    signals: z
      .array(
        z
          .object({
            kind: AdditionalSignalKindSchema,
            label: z.string().trim().min(1).max(200),
            content: z.string().trim().min(1).max(20_000),
            sourceUrl: z.string().url().max(2_000).optional(),
            evidenceState: z.enum(['opinion', 'assumption']).default('opinion'),
            provenance: z.string().trim().min(1).max(500).optional(),
          })
          .strict()
      )
      .min(1)
      .max(20),
    contradictions: z
      .array(z.string().trim().min(1).max(1_000))
      .max(20)
      .default([]),
    unknowns: z.array(z.string().trim().min(1).max(1_000)).max(20).default([]),
  })
  .strict();

export const ApproveGoalRequestSchema = GoalApprovalSchema.omit({
  approvedBy: true,
  approvedAt: true,
}).strict();

export const BuildWorkPacketRequestSchema = z
  .object({ goalContractId: z.string().min(1).max(200) })
  .strict();

export class IntentScapeContextVersionConflictError extends Error {
  constructor() {
    super(
      'The Context Field changed. Reload the workspace before adding evidence.'
    );
    this.name = 'IntentScapeContextVersionConflictError';
  }
}

function configuredPricing(): IntentScapeModelPricing | undefined {
  const input = Number.parseFloat(
    process.env.INTENTSCAPE_AI_INPUT_USD_PER_MILLION ?? ''
  );
  const output = Number.parseFloat(
    process.env.INTENTSCAPE_AI_OUTPUT_USD_PER_MILLION ?? ''
  );
  if (
    !Number.isFinite(input) ||
    !Number.isFinite(output) ||
    input < 0 ||
    output < 0
  ) {
    return undefined;
  }
  return {
    inputUsdPerMillionTokens: input,
    outputUsdPerMillionTokens: output,
  };
}

function nextId(kind: string): string {
  return `${kind}-${randomUUID()}`;
}

export function createIntentScapeRuntime(input: {
  userId: string;
  organizationId: string;
}) {
  const repository = new PrismaIntentScapeRepository(
    prisma,
    createProductionMarkdownArtifactStore(),
    input.userId
  );
  const modelOptions = { pricing: configuredPricing() };
  const engine = createIntentScapeEngine({
    repository,
    generator: createProductionVisionGenerator(modelOptions),
    evaluator: createProductionVisionEvaluator(modelOptions),
  });

  return {
    async createWorkspace(raw: unknown) {
      const request = CreateWorkspaceRequestSchema.parse(raw);
      return repository.createWorkspace({
        ...request,
        organizationId: input.organizationId,
        createdById: input.userId,
      });
    },

    async listWorkspaces() {
      return repository.listWorkspaces(input.organizationId);
    },

    async getWorkspace(workspaceId: string) {
      return repository.getWorkspaceSnapshot({
        organizationId: input.organizationId,
        workspaceId,
      });
    },

    async addSignals(workspaceId: string, raw: unknown): Promise<ContextField> {
      const request = AddSignalsRequestSchema.parse(raw);
      const current = await repository.getContextField({
        organizationId: input.organizationId,
        workspaceId,
      });
      if (!current) throw new IntentScapeNotFoundError('Context Field');
      if (current.version !== request.expectedContextVersion) {
        throw new IntentScapeContextVersionConflictError();
      }

      const capturedAt = new Date().toISOString();
      const next = ContextFieldSchema.parse({
        ...current,
        version: current.version + 1,
        signals: [
          ...current.signals,
          ...request.signals.map(signal => ({
            ...signal,
            id: nextId('signal'),
            capturedAt,
            provenance:
              signal.provenance ?? 'Authenticated human evidence intake',
          })),
        ],
        contradictions: [
          ...new Set([...current.contradictions, ...request.contradictions]),
        ],
        unknowns: [...new Set([...current.unknowns, ...request.unknowns])],
        createdAt: capturedAt,
      });
      await repository.saveContextField(next);
      return next;
    },

    async expandVision(workspaceId: string) {
      const context = await repository.getContextField({
        organizationId: input.organizationId,
        workspaceId,
      });
      if (!context) throw new IntentScapeNotFoundError('Context Field');
      await repository.beginExpansion({
        organizationId: input.organizationId,
        workspaceId,
        contextVersion: context.version,
      });
      try {
        return await engine.expandVision({
          organizationId: input.organizationId,
          workspaceId,
        });
      } catch (error) {
        if (!(error instanceof VisionExpansionRejectedError)) {
          await repository.markExpansionFailed({
            organizationId: input.organizationId,
            workspaceId,
            errorType: error instanceof Error ? error.name : 'UnknownError',
          });
        }
        throw error;
      }
    },

    async approveGoal(workspaceId: string, raw: unknown) {
      const request = ApproveGoalRequestSchema.parse(raw);
      return engine.approveGoal({
        organizationId: input.organizationId,
        workspaceId,
        approval: {
          ...request,
          approvedBy: input.userId,
          approvedAt: new Date().toISOString(),
        },
      });
    },

    async buildWorkPacket(workspaceId: string, raw: unknown) {
      const request = BuildWorkPacketRequestSchema.parse(raw);
      return engine.buildWorkPacket({
        organizationId: input.organizationId,
        workspaceId,
        goalContractId: request.goalContractId,
      });
    },
  };
}
