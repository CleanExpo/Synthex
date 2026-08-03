import type {
  AnchoringAudit,
  ContextField,
  GoalContract,
  IndependentEvaluation,
  VisionMap,
  WorkPacket,
} from '@/lib/intentscape/contracts';

export interface IntentScapeWorkspaceListItem {
  id: string;
  organizationId: string;
  title: string;
  state: string;
  activeContextVersion: number;
  updatedAt: string;
}

export interface AcceptedVision {
  organizationId: string;
  workspaceId: string;
  contextField: ContextField;
  visionMap: VisionMap;
  deterministicAudit: AnchoringAudit;
  independentEvaluation: IndependentEvaluation;
  acceptedAt: string;
}

export interface IntentScapeWorkspaceSnapshot {
  workspace: IntentScapeWorkspaceListItem & {
    retentionClass: string;
    createdById: string;
    createdAt: string;
  };
  contextField: ContextField | null;
  acceptedVision: AcceptedVision | null;
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
    rejectionReasons: unknown;
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
    payload: unknown;
    createdAt: string;
  }>;
}

export interface IntentScapeCreatedWorkspace {
  id: string;
  organizationId: string;
  title: string;
  state: 'context_ready';
  contextField: ContextField;
}

export type IntentScapeWorkPacket = WorkPacket;
