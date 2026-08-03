import { z } from 'zod';
import { auditGoalCandidate, auditVisionMap } from './anchoring-guard';
import {
  type AnchoringAudit,
  type ContextField,
  type GoalContract,
  GoalApprovalSchema,
  GoalContractSchema,
  type IndependentEvaluation,
  IndependentEvaluationSchema,
  type VisionMap,
  VisionMapSchema,
  type WorkPacket,
  WorkPacketSchema,
  VISION_LENSES,
} from './contracts';

const MAX_EXPANSION_ATTEMPTS = 2;
const MINIMUM_EVALUATOR_CONFIDENCE = 0.7;

export interface VisionGeneratorInput {
  contextField: ContextField;
  requiredLenses: typeof VISION_LENSES;
  rejectionReasons: string[];
  attempt: number;
}

export interface VisionGenerator {
  generate(input: VisionGeneratorInput): Promise<unknown>;
}

export interface VisionEvaluator {
  evaluate(input: {
    contextField: ContextField;
    visionMap: VisionMap;
    deterministicAudit: AnchoringAudit;
  }): Promise<unknown>;
}

export interface VisionAttemptRecord {
  organizationId: string;
  workspaceId: string;
  contextVersion: number;
  attempt: number;
  status: 'accepted' | 'rejected';
  visionMap: VisionMap | null;
  deterministicAudit: AnchoringAudit | null;
  independentEvaluation: IndependentEvaluation | null;
  rejectionReasons: string[];
  createdAt: string;
}

export interface AcceptedVisionRecord {
  organizationId: string;
  workspaceId: string;
  contextField: ContextField;
  visionMap: VisionMap;
  deterministicAudit: AnchoringAudit;
  independentEvaluation: IndependentEvaluation;
  acceptedAt: string;
}

export interface IntentScapeRepository {
  getContextField(input: {
    organizationId: string;
    workspaceId: string;
  }): Promise<ContextField | null>;
  saveVisionAttempt(record: VisionAttemptRecord): Promise<void>;
  saveAcceptedVision(record: AcceptedVisionRecord): Promise<void>;
  getAcceptedVision(input: {
    organizationId: string;
    workspaceId: string;
  }): Promise<AcceptedVisionRecord | null>;
  saveGoalContract(contract: GoalContract): Promise<void>;
  getGoalContract(input: {
    organizationId: string;
    workspaceId: string;
    goalContractId: string;
  }): Promise<GoalContract | null>;
}

export interface IntentScapeEngineDependencies {
  repository: IntentScapeRepository;
  generator: VisionGenerator;
  evaluator: VisionEvaluator;
  now?: () => string;
  createId?: (kind: 'goal-contract') => string;
}

export interface ExpandVisionInput {
  organizationId: string;
  workspaceId: string;
}

export interface ApproveGoalInput extends ExpandVisionInput {
  approval: unknown;
}

export interface BuildWorkPacketInput extends ExpandVisionInput {
  goalContractId: string;
}

export class IntentScapeNotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} was not found in the active organisation.`);
    this.name = 'IntentScapeNotFoundError';
  }
}

export class VisionExpansionRejectedError extends Error {
  readonly attempts: VisionAttemptRecord[];

  constructor(attempts: VisionAttemptRecord[]) {
    super('Vision expansion failed the anchoring gate after two attempts.');
    this.name = 'VisionExpansionRejectedError';
    this.attempts = attempts;
  }
}

export class GoalApprovalRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoalApprovalRejectedError';
  }
}

function zodReasons(error: z.ZodError): string[] {
  return error.issues.map(issue => {
    const path = issue.path.length ? issue.path.join('.') : 'root';
    return `${path}: ${issue.message}`;
  });
}

function addContextVersionIssue(
  audit: AnchoringAudit,
  expected: number,
  actual: number
): AnchoringAudit {
  if (expected === actual) return audit;
  return {
    ...audit,
    passed: false,
    issues: [
      ...audit.issues,
      {
        code: 'context-version-mismatch',
        path: 'contextVersion',
        message: `Vision map used context version ${actual}; expected ${expected}.`,
      },
    ],
  };
}

function uniqueEvidenceRefs(record: AcceptedVisionRecord): string[] {
  return [
    ...new Set(
      record.visionMap.lensFindings.flatMap(finding => finding.evidenceRefs)
    ),
  ];
}

export function createIntentScapeEngine(
  dependencies: IntentScapeEngineDependencies
) {
  const now = dependencies.now ?? (() => new Date().toISOString());
  const createId =
    dependencies.createId ?? (() => `goal-${crypto.randomUUID()}`);

  return {
    async expandVision(
      input: ExpandVisionInput
    ): Promise<AcceptedVisionRecord> {
      const contextField = await dependencies.repository.getContextField(input);
      if (!contextField) throw new IntentScapeNotFoundError('Context Field');

      const attempts: VisionAttemptRecord[] = [];
      let rejectionReasons: string[] = [];

      for (let attempt = 1; attempt <= MAX_EXPANSION_ATTEMPTS; attempt += 1) {
        const generated = await dependencies.generator.generate({
          contextField,
          requiredLenses: VISION_LENSES,
          rejectionReasons,
          attempt,
        });
        const parsedVision = VisionMapSchema.safeParse(generated);

        if (!parsedVision.success) {
          rejectionReasons = zodReasons(parsedVision.error);
          const record: VisionAttemptRecord = {
            ...input,
            contextVersion: contextField.version,
            attempt,
            status: 'rejected',
            visionMap: null,
            deterministicAudit: null,
            independentEvaluation: null,
            rejectionReasons,
            createdAt: now(),
          };
          attempts.push(record);
          await dependencies.repository.saveVisionAttempt(record);
          continue;
        }

        let deterministicAudit = auditVisionMap(
          contextField.originSignal,
          parsedVision.data,
          now()
        );
        deterministicAudit = addContextVersionIssue(
          deterministicAudit,
          contextField.version,
          parsedVision.data.contextVersion
        );

        if (!deterministicAudit.passed) {
          rejectionReasons = deterministicAudit.issues.map(
            issue => `${issue.path}: ${issue.message}`
          );
          const record: VisionAttemptRecord = {
            ...input,
            contextVersion: contextField.version,
            attempt,
            status: 'rejected',
            visionMap: parsedVision.data,
            deterministicAudit,
            independentEvaluation: null,
            rejectionReasons,
            createdAt: now(),
          };
          attempts.push(record);
          await dependencies.repository.saveVisionAttempt(record);
          continue;
        }

        const evaluationResult = IndependentEvaluationSchema.safeParse(
          await dependencies.evaluator.evaluate({
            contextField,
            visionMap: parsedVision.data,
            deterministicAudit,
          })
        );
        const independentEvaluation = evaluationResult.success
          ? evaluationResult.data
          : null;
        const evaluationPassed = Boolean(
          independentEvaluation?.passed &&
          independentEvaluation.confidence >= MINIMUM_EVALUATOR_CONFIDENCE
        );

        if (!evaluationPassed) {
          rejectionReasons = evaluationResult.success
            ? independentEvaluation!.reasons
            : zodReasons(evaluationResult.error);
          const record: VisionAttemptRecord = {
            ...input,
            contextVersion: contextField.version,
            attempt,
            status: 'rejected',
            visionMap: parsedVision.data,
            deterministicAudit,
            independentEvaluation,
            rejectionReasons,
            createdAt: now(),
          };
          attempts.push(record);
          await dependencies.repository.saveVisionAttempt(record);
          continue;
        }

        const acceptedAt = now();
        const accepted: AcceptedVisionRecord = {
          ...input,
          contextField,
          visionMap: parsedVision.data,
          deterministicAudit,
          independentEvaluation: independentEvaluation!,
          acceptedAt,
        };
        const record: VisionAttemptRecord = {
          ...input,
          contextVersion: contextField.version,
          attempt,
          status: 'accepted',
          visionMap: parsedVision.data,
          deterministicAudit,
          independentEvaluation: independentEvaluation!,
          rejectionReasons: [],
          createdAt: acceptedAt,
        };
        attempts.push(record);
        await dependencies.repository.saveVisionAttempt(record);
        await dependencies.repository.saveAcceptedVision(accepted);
        return accepted;
      }

      throw new VisionExpansionRejectedError(attempts);
    },

    async approveGoal(input: ApproveGoalInput): Promise<GoalContract> {
      const approvalResult = GoalApprovalSchema.safeParse(input.approval);
      if (!approvalResult.success) {
        throw new GoalApprovalRejectedError(
          `Goal approval validation failed: ${zodReasons(approvalResult.error).join('; ')}`
        );
      }

      const accepted = await dependencies.repository.getAcceptedVision(input);
      if (!accepted) throw new IntentScapeNotFoundError('Accepted Vision Map');

      const hypothesis = accepted.visionMap.hypotheses.find(
        candidate =>
          candidate.id === approvalResult.data.hypothesisId &&
          candidate.version === approvalResult.data.hypothesisVersion
      );
      if (!hypothesis) {
        throw new GoalApprovalRejectedError(
          'The selected hypothesis version is missing or stale.'
        );
      }

      if (
        !hypothesis.affectedStakeholders.includes(
          approvalResult.data.primaryStakeholder
        )
      ) {
        throw new GoalApprovalRejectedError(
          'The primary stakeholder must come from the selected hypothesis.'
        );
      }

      const audit = auditGoalCandidate(
        accepted.contextField.originSignal,
        hypothesis.desiredChange,
        now()
      );
      if (!audit.passed) {
        throw new GoalApprovalRejectedError(
          `The selected hypothesis is anchored to the origin signal: ${audit.issues.map(issue => issue.message).join('; ')}`
        );
      }

      const contract = GoalContractSchema.parse({
        id: createId('goal-contract'),
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        ...approvalResult.data,
        contextVersion: accepted.contextField.version,
        desiredChange: hypothesis.desiredChange,
        evidenceRefs: uniqueEvidenceRefs(accepted),
        status: 'approved',
      });
      await dependencies.repository.saveGoalContract(contract);
      return contract;
    },

    async buildWorkPacket(input: BuildWorkPacketInput): Promise<WorkPacket> {
      const contract = await dependencies.repository.getGoalContract(input);
      if (!contract)
        throw new IntentScapeNotFoundError('Approved Goal Contract');

      return WorkPacketSchema.parse({
        goalContractId: contract.id,
        organizationId: contract.organizationId,
        workspaceId: contract.workspaceId,
        goal: contract.desiredChange,
        acceptanceCriteria: contract.acceptanceCriteria,
        exclusions: contract.exclusions,
        authorityBoundaries: contract.authorityBoundaries,
        evidenceRefs: contract.evidenceRefs,
      });
    },
  };
}

export type IntentScapeEngine = ReturnType<typeof createIntentScapeEngine>;

export const INTENTSCAPE_LIMITS = {
  maximumExpansionAttempts: MAX_EXPANSION_ATTEMPTS,
  minimumEvaluatorConfidence: MINIMUM_EVALUATOR_CONFIDENCE,
} as const;
