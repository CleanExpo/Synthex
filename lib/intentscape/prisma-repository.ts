import { createHash, randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  ContextFieldSchema,
  type ContextField,
  type GoalContract,
  type WorkPacket,
} from './contracts';
import type {
  AcceptedVisionRecord,
  IntentScapeRepository,
  VisionAttemptRecord,
} from './engine';
import { IntentScapeNotFoundError } from './engine';
import {
  parseAcceptedVisionMarkdown,
  parseContextFieldMarkdown,
  parseGoalContractMarkdown,
  renderAcceptedVisionMarkdown,
  renderContextFieldMarkdown,
  renderGoalContractMarkdown,
  renderOriginSignalMarkdown,
  renderVisionAttemptMarkdown,
  renderWorkPacketMarkdown,
} from './markdown-codec';
import type {
  MarkdownArtifactStore,
  StoredMarkdownArtifact,
} from './markdown-store';

const CreateWorkspaceInputSchema = z
  .object({
    organizationId: z.string().min(1).max(128),
    createdById: z.string().min(1).max(128),
    title: z.string().trim().min(3).max(200),
    originSignal: z.string().trim().min(3).max(12_000),
    retentionClass: z
      .enum(['standard', 'prospect', 'legal_hold'])
      .default('standard'),
  })
  .strict();

export type CreateIntentScapeWorkspaceInput = z.input<
  typeof CreateWorkspaceInputSchema
>;

export interface CreatedIntentScapeWorkspace {
  id: string;
  organizationId: string;
  title: string;
  state: 'context_ready';
  contextField: ContextField;
}

export interface IntentScapeWorkspaceListItem {
  id: string;
  organizationId: string;
  title: string;
  state: string;
  activeContextVersion: number;
  updatedAt: string;
}

export interface IntentScapeWorkspaceSnapshot {
  workspace: IntentScapeWorkspaceListItem & {
    retentionClass: string;
    createdById: string;
    createdAt: string;
  };
  contextField: ContextField | null;
  acceptedVision: AcceptedVisionRecord | null;
  goalContract: GoalContract | null;
  runs: Array<{
    id: string;
    contextVersion: number;
    attempt: number;
    status: string;
    generatorProvider: string | null;
    generatorModel: string | null;
    evaluatorProvider: string | null;
    evaluatorModel: string | null;
    confidence: number | null;
    totalTokens: number;
    costMicros: number | null;
    rejectionReasons: Prisma.JsonValue;
    createdAt: string;
  }>;
  artifacts: Array<{
    id: string;
    kind: string;
    logicalPath: string;
    version: number;
    evidenceState: string;
    contentHash: string;
    createdAt: string;
  }>;
  events: Array<{
    id: string;
    eventType: string;
    entityType: string;
    entityId: string;
    artifactId: string | null;
    payload: Prisma.JsonValue;
    createdAt: string;
  }>;
}

type ArtifactKind =
  | 'origin-signal'
  | 'context-field'
  | 'vision-attempt'
  | 'accepted-vision'
  | 'goal-contract'
  | 'work-packet';

interface PersistArtifactInput {
  organizationId: string;
  workspaceId: string;
  kind: ArtifactKind;
  logicalPath: string;
  version: number;
  parentVersion?: number;
  evidenceState:
    | 'verified'
    | 'inferred'
    | 'opinion'
    | 'assumption'
    | 'contradicted'
    | 'missing'
    | 'unverified';
  lineage: Prisma.InputJsonValue;
  markdown: string;
}

interface ArtifactMetadata {
  id: string;
  organizationId: string;
  workspaceId: string;
  storagePath: string;
  contentHash: string;
  byteSize: number;
  logicalPath: string;
  version: number;
}

export class IntentScapeStaleContextError extends Error {
  constructor(expectedVersion: number, actualVersion: number) {
    super(
      `Context Field version is stale: expected next version ${expectedVersion}, received ${actualVersion}.`
    );
    this.name = 'IntentScapeStaleContextError';
  }
}

export class IntentScapeExpansionConflictError extends Error {
  constructor() {
    super('This workspace is already expanding or awaiting a human decision.');
    this.name = 'IntentScapeExpansionConflictError';
  }
}

function canonicalTextHash(value: string): string {
  return createHash('sha256')
    .update(value.trim().replace(/\r\n?/g, '\n'), 'utf8')
    .digest('hex');
}

function idFactory(kind: string): string {
  return `${kind}-${randomUUID()}`;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class PrismaIntentScapeRepository implements IntentScapeRepository {
  constructor(
    private readonly client: PrismaClient,
    private readonly markdownStore: MarkdownArtifactStore,
    private readonly actorId: string,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly createId: (kind: string) => string = idFactory
  ) {}

  private async assertWorkspace(input: {
    organizationId: string;
    workspaceId: string;
  }) {
    const workspace = await this.client.intentScapeWorkspace.findFirst({
      where: {
        id: input.workspaceId,
        organizationId: input.organizationId,
      },
    });
    if (!workspace) throw new IntentScapeNotFoundError('IntentScape Workspace');
    return workspace;
  }

  private async persistArtifact(
    input: PersistArtifactInput
  ): Promise<ArtifactMetadata> {
    await this.assertWorkspace(input);
    const stored: StoredMarkdownArtifact =
      await this.markdownStore.writeVersion({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        logicalPath: input.logicalPath,
        version: input.version,
        markdown: input.markdown,
      });

    return this.client.intentScapeArtifact.create({
      data: {
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        kind: input.kind,
        logicalPath: input.logicalPath,
        storagePath: stored.storagePath,
        contentHash: stored.contentHash,
        byteSize: stored.byteSize,
        version: input.version,
        parentVersion: input.parentVersion,
        evidenceState: input.evidenceState,
        lineage: input.lineage,
        createdById: this.actorId,
      },
      select: {
        id: true,
        organizationId: true,
        workspaceId: true,
        storagePath: true,
        contentHash: true,
        byteSize: true,
        logicalPath: true,
        version: true,
      },
    });
  }

  private async readArtifact(input: {
    organizationId: string;
    workspaceId: string;
    artifactId: string;
  }): Promise<StoredMarkdownArtifact | null> {
    const artifact = await this.client.intentScapeArtifact.findFirst({
      where: {
        id: input.artifactId,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
      },
      select: { storagePath: true, contentHash: true },
    });
    if (!artifact) return null;
    return this.markdownStore.readVersion({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      storagePath: artifact.storagePath,
      expectedHash: artifact.contentHash,
    });
  }

  async createWorkspace(
    rawInput: CreateIntentScapeWorkspaceInput
  ): Promise<CreatedIntentScapeWorkspace> {
    const input = CreateWorkspaceInputSchema.parse(rawInput);
    if (input.createdById !== this.actorId) {
      throw new IntentScapeNotFoundError('Active IntentScape User');
    }

    const workspaceId = this.createId('workspace');
    const capturedAt = this.now();
    const contextField = ContextFieldSchema.parse({
      workspaceId,
      organizationId: input.organizationId,
      version: 1,
      originSignal: input.originSignal,
      signals: [
        {
          id: this.createId('signal'),
          kind: 'origin-signal',
          label: 'Initial human signal',
          content: input.originSignal,
          evidenceState: 'opinion',
          capturedAt,
          provenance: 'Authenticated human intake',
        },
      ],
      contradictions: [],
      unknowns: [
        'The causal mechanism and highest-value intervention are not yet established.',
      ],
      createdAt: capturedAt,
    });

    await this.client.intentScapeWorkspace.create({
      data: {
        id: workspaceId,
        organizationId: input.organizationId,
        createdById: input.createdById,
        title: input.title,
        state: 'draft',
        retentionClass: input.retentionClass,
        originSignalHash: canonicalTextHash(input.originSignal),
        activeContextVersion: 0,
      },
    });

    const originArtifact = await this.persistArtifact({
      organizationId: input.organizationId,
      workspaceId,
      kind: 'origin-signal',
      logicalPath: 'context/origin-signal.md',
      version: 1,
      evidenceState: 'opinion',
      lineage: { source: 'authenticated-human-intake' },
      markdown: renderOriginSignalMarkdown({
        workspaceId,
        organizationId: input.organizationId,
        originSignal: input.originSignal,
        capturedAt,
        provenance: 'Authenticated human intake',
      }),
    });

    const contextArtifact = await this.persistArtifact({
      organizationId: input.organizationId,
      workspaceId,
      kind: 'context-field',
      logicalPath: 'context/field.md',
      version: 1,
      evidenceState: 'unverified',
      lineage: {
        originArtifactId: originArtifact.id,
        sourceSignalIds: contextField.signals.map(signal => signal.id),
      },
      markdown: renderContextFieldMarkdown(contextField),
    });

    await this.client.$transaction([
      this.client.intentScapeWorkspace.update({
        where: { id: workspaceId },
        data: { state: 'context_ready', activeContextVersion: 1 },
      }),
      this.client.intentScapeEvent.create({
        data: {
          organizationId: input.organizationId,
          workspaceId,
          eventType: 'workspace.created',
          actorId: this.actorId,
          entityType: 'workspace',
          entityId: workspaceId,
          artifactId: contextArtifact.id,
          payload: {
            contextVersion: 1,
            originSignalHash: canonicalTextHash(input.originSignal),
          },
        },
      }),
    ]);

    return {
      id: workspaceId,
      organizationId: input.organizationId,
      title: input.title,
      state: 'context_ready',
      contextField,
    };
  }

  async saveContextField(context: ContextField): Promise<void> {
    const validated = ContextFieldSchema.parse(context);
    const workspace = await this.assertWorkspace({
      organizationId: validated.organizationId,
      workspaceId: validated.workspaceId,
    });
    const expectedVersion = workspace.activeContextVersion + 1;
    if (validated.version !== expectedVersion) {
      throw new IntentScapeStaleContextError(
        expectedVersion,
        validated.version
      );
    }

    const artifact = await this.persistArtifact({
      organizationId: validated.organizationId,
      workspaceId: validated.workspaceId,
      kind: 'context-field',
      logicalPath: 'context/field.md',
      version: validated.version,
      parentVersion: workspace.activeContextVersion || undefined,
      evidenceState: 'unverified',
      lineage: {
        sourceSignalIds: validated.signals.map(signal => signal.id),
        contradictionCount: validated.contradictions.length,
        unknownCount: validated.unknowns.length,
      },
      markdown: renderContextFieldMarkdown(validated),
    });

    const updated = await this.client.intentScapeWorkspace.updateMany({
      where: {
        id: validated.workspaceId,
        organizationId: validated.organizationId,
        activeContextVersion: workspace.activeContextVersion,
      },
      data: {
        activeContextVersion: validated.version,
        state: 'context_ready',
      },
    });
    if (updated.count !== 1) {
      throw new IntentScapeStaleContextError(
        workspace.activeContextVersion + 1,
        validated.version
      );
    }

    await this.client.intentScapeEvent.create({
      data: {
        organizationId: validated.organizationId,
        workspaceId: validated.workspaceId,
        eventType: 'context.versioned',
        actorId: this.actorId,
        entityType: 'context-field',
        entityId: `${validated.workspaceId}:${validated.version}`,
        artifactId: artifact.id,
        payload: {
          version: validated.version,
          signalCount: validated.signals.length,
          contentHash: artifact.contentHash,
        },
      },
    });
  }

  async getContextField(input: {
    organizationId: string;
    workspaceId: string;
  }): Promise<ContextField | null> {
    const workspace = await this.client.intentScapeWorkspace.findFirst({
      where: { id: input.workspaceId, organizationId: input.organizationId },
      select: { activeContextVersion: true },
    });
    if (!workspace || workspace.activeContextVersion < 1) return null;

    const artifact = await this.client.intentScapeArtifact.findFirst({
      where: {
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        logicalPath: 'context/field.md',
        version: workspace.activeContextVersion,
      },
      select: { storagePath: true, contentHash: true },
    });
    if (!artifact) return null;

    const stored = await this.markdownStore.readVersion({
      ...input,
      storagePath: artifact.storagePath,
      expectedHash: artifact.contentHash,
    });
    return parseContextFieldMarkdown(stored.markdown);
  }

  async beginExpansion(input: {
    organizationId: string;
    workspaceId: string;
    contextVersion: number;
  }): Promise<void> {
    const acquired = await this.client.intentScapeWorkspace.updateMany({
      where: {
        id: input.workspaceId,
        organizationId: input.organizationId,
        activeContextVersion: input.contextVersion,
        state: { in: ['context_ready', 'blocked', 'failed'] },
      },
      data: { state: 'expanding' },
    });
    if (acquired.count !== 1) throw new IntentScapeExpansionConflictError();
    await this.client.intentScapeEvent.create({
      data: {
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        eventType: 'vision.expansion_started',
        actorId: this.actorId,
        entityType: 'context-field',
        entityId: `${input.workspaceId}:${input.contextVersion}`,
        payload: { contextVersion: input.contextVersion },
      },
    });
  }

  async markExpansionFailed(input: {
    organizationId: string;
    workspaceId: string;
    errorType: string;
  }): Promise<void> {
    await this.client.intentScapeWorkspace.updateMany({
      where: {
        id: input.workspaceId,
        organizationId: input.organizationId,
        state: 'expanding',
      },
      data: { state: 'failed' },
    });
    await this.client.intentScapeEvent.create({
      data: {
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        eventType: 'vision.expansion_failed',
        actorId: this.actorId,
        entityType: 'workspace',
        entityId: input.workspaceId,
        payload: { errorType: input.errorType.slice(0, 100) },
      },
    });
  }

  async listWorkspaces(
    organizationId: string
  ): Promise<IntentScapeWorkspaceListItem[]> {
    const workspaces = await this.client.intentScapeWorkspace.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        organizationId: true,
        title: true,
        state: true,
        activeContextVersion: true,
        updatedAt: true,
      },
    });
    return workspaces.map(workspace => ({
      ...workspace,
      updatedAt: workspace.updatedAt.toISOString(),
    }));
  }

  async getWorkspaceSnapshot(input: {
    organizationId: string;
    workspaceId: string;
  }): Promise<IntentScapeWorkspaceSnapshot | null> {
    const workspace = await this.client.intentScapeWorkspace.findFirst({
      where: { id: input.workspaceId, organizationId: input.organizationId },
      select: {
        id: true,
        organizationId: true,
        title: true,
        state: true,
        retentionClass: true,
        activeContextVersion: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!workspace) return null;

    const [contextField, acceptedVision, latestGoal, runs, artifacts, events] =
      await Promise.all([
        this.getContextField(input),
        this.getAcceptedVision(input),
        this.client.intentScapeGoalContract.findFirst({
          where: {
            organizationId: input.organizationId,
            workspaceId: input.workspaceId,
            status: 'approved',
          },
          orderBy: { approvedAt: 'desc' },
          select: { id: true },
        }),
        this.client.intentScapeVisionRun.findMany({
          where: {
            organizationId: input.organizationId,
            workspaceId: input.workspaceId,
          },
          orderBy: [{ contextVersion: 'desc' }, { attempt: 'desc' }],
          select: {
            id: true,
            contextVersion: true,
            attempt: true,
            status: true,
            generatorProvider: true,
            generatorModel: true,
            evaluatorProvider: true,
            evaluatorModel: true,
            confidence: true,
            totalTokens: true,
            costMicros: true,
            rejectionReasons: true,
            createdAt: true,
          },
        }),
        this.client.intentScapeArtifact.findMany({
          where: {
            organizationId: input.organizationId,
            workspaceId: input.workspaceId,
          },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            kind: true,
            logicalPath: true,
            version: true,
            evidenceState: true,
            contentHash: true,
            createdAt: true,
          },
        }),
        this.client.intentScapeEvent.findMany({
          where: {
            organizationId: input.organizationId,
            workspaceId: input.workspaceId,
          },
          orderBy: { createdAt: 'asc' },
          take: 200,
          select: {
            id: true,
            eventType: true,
            entityType: true,
            entityId: true,
            artifactId: true,
            payload: true,
            createdAt: true,
          },
        }),
      ]);

    const goalContract = latestGoal
      ? await this.getGoalContract({
          ...input,
          goalContractId: latestGoal.id,
        })
      : null;
    return {
      workspace: {
        ...workspace,
        createdAt: workspace.createdAt.toISOString(),
        updatedAt: workspace.updatedAt.toISOString(),
      },
      contextField,
      acceptedVision,
      goalContract,
      runs: runs.map(run => ({
        ...run,
        createdAt: run.createdAt.toISOString(),
      })),
      artifacts: artifacts.map(artifact => ({
        ...artifact,
        createdAt: artifact.createdAt.toISOString(),
      })),
      events: events.map(event => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }

  async saveVisionAttempt(record: VisionAttemptRecord): Promise<void> {
    await this.assertWorkspace(record);
    const artifact = await this.persistArtifact({
      organizationId: record.organizationId,
      workspaceId: record.workspaceId,
      kind: 'vision-attempt',
      logicalPath: `vision/attempt-${record.contextVersion}-${record.attempt}.md`,
      version: 1,
      evidenceState: record.status === 'accepted' ? 'inferred' : 'contradicted',
      lineage: {
        contextVersion: record.contextVersion,
        attempt: record.attempt,
        status: record.status,
      },
      markdown: renderVisionAttemptMarkdown(record),
    });

    const runId = this.createId('vision-run');
    const status =
      record.status === 'accepted' ? 'awaiting_approval' : 'rejected';
    const workspaceState =
      record.status === 'accepted'
        ? 'awaiting_approval'
        : record.attempt >= 2
          ? 'blocked'
          : 'expanding';
    const promptTokens =
      record.generatorMetadata.promptTokens +
      (record.evaluatorMetadata?.promptTokens ?? 0);
    const completionTokens =
      record.generatorMetadata.completionTokens +
      (record.evaluatorMetadata?.completionTokens ?? 0);
    const totalTokens =
      record.generatorMetadata.totalTokens +
      (record.evaluatorMetadata?.totalTokens ?? 0);
    const costMicros =
      record.generatorMetadata.costMicros !== undefined &&
      (!record.evaluatorMetadata ||
        record.evaluatorMetadata.costMicros !== undefined)
        ? record.generatorMetadata.costMicros +
          (record.evaluatorMetadata?.costMicros ?? 0)
        : undefined;
    await this.client.$transaction([
      this.client.intentScapeVisionRun.create({
        data: {
          id: runId,
          organizationId: record.organizationId,
          workspaceId: record.workspaceId,
          contextVersion: record.contextVersion,
          attempt: record.attempt,
          status,
          generatorProvider: record.generatorMetadata.provider,
          generatorModel: record.generatorMetadata.model,
          evaluatorProvider: record.evaluatorMetadata?.provider,
          evaluatorModel: record.evaluatorMetadata?.model,
          promptTokens,
          completionTokens,
          totalTokens,
          costMicros,
          confidence: record.independentEvaluation?.confidence,
          visionArtifactId: artifact.id,
          anchoringArtifactId: record.deterministicAudit ? artifact.id : null,
          evaluationArtifactId: record.independentEvaluation
            ? artifact.id
            : null,
          rejectionReasons: toJson(record.rejectionReasons),
          startedAt: new Date(record.createdAt),
          completedAt: new Date(record.createdAt),
        },
      }),
      this.client.intentScapeWorkspace.updateMany({
        where: {
          id: record.workspaceId,
          organizationId: record.organizationId,
        },
        data: { state: workspaceState },
      }),
      this.client.intentScapeEvent.create({
        data: {
          organizationId: record.organizationId,
          workspaceId: record.workspaceId,
          eventType: `vision.${record.status}`,
          actorId: this.actorId,
          entityType: 'vision-run',
          entityId: runId,
          artifactId: artifact.id,
          payload: {
            attempt: record.attempt,
            contextVersion: record.contextVersion,
            rejectionCount: record.rejectionReasons.length,
          },
        },
      }),
    ]);
  }

  async saveAcceptedVision(record: AcceptedVisionRecord): Promise<void> {
    const run = await this.client.intentScapeVisionRun.findFirst({
      where: {
        organizationId: record.organizationId,
        workspaceId: record.workspaceId,
        contextVersion: record.contextField.version,
        status: 'awaiting_approval',
      },
      orderBy: { attempt: 'desc' },
    });
    if (!run) throw new IntentScapeNotFoundError('Accepted Vision Run');

    const artifact = await this.persistArtifact({
      organizationId: record.organizationId,
      workspaceId: record.workspaceId,
      kind: 'accepted-vision',
      logicalPath: 'vision/accepted.md',
      version: record.contextField.version,
      evidenceState: 'inferred',
      lineage: {
        visionRunId: run.id,
        contextVersion: record.contextField.version,
        deterministicAuditPassed: record.deterministicAudit.passed,
        independentConfidence: record.independentEvaluation.confidence,
      },
      markdown: renderAcceptedVisionMarkdown(record),
    });

    await this.client.$transaction([
      this.client.intentScapeVisionRun.update({
        where: { id: run.id },
        data: {
          visionArtifactId: artifact.id,
          confidence: record.independentEvaluation.confidence,
          status: 'awaiting_approval',
          completedAt: new Date(record.acceptedAt),
        },
      }),
      this.client.intentScapeHypothesis.createMany({
        data: record.visionMap.hypotheses.map((hypothesis, index) => ({
          organizationId: record.organizationId,
          workspaceId: record.workspaceId,
          visionRunId: run.id,
          hypothesisId: hypothesis.id,
          version: hypothesis.version,
          title: hypothesis.title,
          causalMechanism: hypothesis.causalMechanism,
          desiredChange: hypothesis.desiredChange,
          affectedStakeholders: toJson(hypothesis.affectedStakeholders),
          evidenceFor: toJson(hypothesis.evidenceFor),
          evidenceAgainst: toJson(hypothesis.evidenceAgainst),
          invalidatingAssumption: hypothesis.invalidatingAssumption,
          mainRisk: hypothesis.mainRisk,
          adjacentValue: hypothesis.adjacentValue,
          researchBranchIds: toJson(hypothesis.researchBranchIds),
          rank: index + 1,
          confidence: hypothesis.confidence,
        })),
        skipDuplicates: true,
      }),
      this.client.intentScapeWorkspace.updateMany({
        where: {
          id: record.workspaceId,
          organizationId: record.organizationId,
        },
        data: { state: 'awaiting_approval' },
      }),
      this.client.intentScapeEvent.create({
        data: {
          organizationId: record.organizationId,
          workspaceId: record.workspaceId,
          eventType: 'vision.awaiting_approval',
          actorId: this.actorId,
          entityType: 'vision-run',
          entityId: run.id,
          artifactId: artifact.id,
          payload: {
            contextVersion: record.contextField.version,
            hypothesisCount: record.visionMap.hypotheses.length,
            contentHash: artifact.contentHash,
          },
        },
      }),
    ]);
  }

  async getAcceptedVision(input: {
    organizationId: string;
    workspaceId: string;
  }): Promise<AcceptedVisionRecord | null> {
    const run = await this.client.intentScapeVisionRun.findFirst({
      where: {
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        status: { in: ['awaiting_approval', 'approved'] },
        visionArtifactId: { not: null },
      },
      orderBy: [{ contextVersion: 'desc' }, { attempt: 'desc' }],
      select: { visionArtifactId: true },
    });
    if (!run?.visionArtifactId) return null;
    const artifact = await this.readArtifact({
      ...input,
      artifactId: run.visionArtifactId,
    });
    return artifact ? parseAcceptedVisionMarkdown(artifact.markdown) : null;
  }

  async saveGoalContract(contract: GoalContract): Promise<void> {
    const hypothesis = await this.client.intentScapeHypothesis.findFirst({
      where: {
        organizationId: contract.organizationId,
        workspaceId: contract.workspaceId,
        hypothesisId: contract.hypothesisId,
        version: contract.hypothesisVersion,
      },
      select: { visionRunId: true },
    });
    if (!hypothesis) {
      throw new IntentScapeNotFoundError('Approved Hypothesis Version');
    }

    const latest = await this.client.intentScapeGoalContract.aggregate({
      where: {
        organizationId: contract.organizationId,
        workspaceId: contract.workspaceId,
      },
      _max: { version: true },
    });
    const version = (latest._max.version ?? 0) + 1;
    const artifact = await this.persistArtifact({
      organizationId: contract.organizationId,
      workspaceId: contract.workspaceId,
      kind: 'goal-contract',
      logicalPath: 'decisions/goal-contract.md',
      version,
      parentVersion: version > 1 ? version - 1 : undefined,
      evidenceState: 'verified',
      lineage: {
        visionRunId: hypothesis.visionRunId,
        hypothesisId: contract.hypothesisId,
        hypothesisVersion: contract.hypothesisVersion,
      },
      markdown: renderGoalContractMarkdown(contract),
    });

    await this.client.$transaction([
      this.client.intentScapeGoalContract.create({
        data: {
          id: contract.id,
          organizationId: contract.organizationId,
          workspaceId: contract.workspaceId,
          visionRunId: hypothesis.visionRunId,
          hypothesisId: contract.hypothesisId,
          hypothesisVersion: contract.hypothesisVersion,
          version,
          contextVersion: contract.contextVersion,
          desiredChange: contract.desiredChange,
          primaryStakeholder: contract.primaryStakeholder,
          acceptanceCriteria: toJson(contract.acceptanceCriteria),
          exclusions: toJson(contract.exclusions),
          authorityBoundaries: toJson(contract.authorityBoundaries),
          evidenceRefs: toJson(contract.evidenceRefs),
          status: 'approved',
          approvedBy: contract.approvedBy,
          approvedAt: new Date(contract.approvedAt),
          artifactId: artifact.id,
        },
      }),
      this.client.intentScapeVisionRun.update({
        where: { id: hypothesis.visionRunId },
        data: { status: 'approved' },
      }),
      this.client.intentScapeWorkspace.updateMany({
        where: {
          id: contract.workspaceId,
          organizationId: contract.organizationId,
        },
        data: { state: 'approved' },
      }),
      this.client.intentScapeEvent.create({
        data: {
          organizationId: contract.organizationId,
          workspaceId: contract.workspaceId,
          eventType: 'goal.approved',
          actorId: contract.approvedBy,
          entityType: 'goal-contract',
          entityId: contract.id,
          artifactId: artifact.id,
          payload: {
            version,
            hypothesisId: contract.hypothesisId,
            hypothesisVersion: contract.hypothesisVersion,
          },
        },
      }),
    ]);
  }

  async getGoalContract(input: {
    organizationId: string;
    workspaceId: string;
    goalContractId: string;
  }): Promise<GoalContract | null> {
    const contract = await this.client.intentScapeGoalContract.findFirst({
      where: {
        id: input.goalContractId,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        status: 'approved',
      },
      select: { artifactId: true },
    });
    if (!contract) return null;
    const artifact = await this.readArtifact({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      artifactId: contract.artifactId,
    });
    return artifact ? parseGoalContractMarkdown(artifact.markdown) : null;
  }

  async saveWorkPacket(packet: WorkPacket): Promise<void> {
    const contract = await this.client.intentScapeGoalContract.findFirst({
      where: {
        id: packet.goalContractId,
        organizationId: packet.organizationId,
        workspaceId: packet.workspaceId,
        status: 'approved',
      },
      select: { id: true },
    });
    if (!contract) throw new IntentScapeNotFoundError('Approved Goal Contract');

    const artifact = await this.persistArtifact({
      organizationId: packet.organizationId,
      workspaceId: packet.workspaceId,
      kind: 'work-packet',
      logicalPath: `execution/work-packet-${packet.goalContractId}.md`,
      version: 1,
      evidenceState: 'verified',
      lineage: { goalContractId: packet.goalContractId },
      markdown: renderWorkPacketMarkdown(packet),
    });
    await this.client.intentScapeEvent.create({
      data: {
        organizationId: packet.organizationId,
        workspaceId: packet.workspaceId,
        eventType: 'work-packet.created',
        actorId: this.actorId,
        entityType: 'work-packet',
        entityId: packet.goalContractId,
        artifactId: artifact.id,
        payload: { goalContractId: packet.goalContractId },
      },
    });
  }
}
