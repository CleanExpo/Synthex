import {
  createIntentScapeEngine,
  GoalApprovalRejectedError,
  type AcceptedVisionRecord,
  type ContextField,
  type GoalContract,
  type IntentScapeRepository,
  IntentScapeNotFoundError,
  type VisionAttemptRecord,
  VisionExpansionRejectedError,
  type WorkPacket,
} from '@/lib/intentscape';
import {
  type VisionHypothesis,
  type VisionMap,
  VISION_LENSES,
} from '@/lib/intentscape/contracts';

const ORIGIN = 'I think we need better product images for our skincare range';
const NOW = '2026-08-03T00:00:00.000Z';
const MODEL_METADATA = {
  provider: 'TestProvider',
  model: 'test-model',
  promptTokens: 100,
  completionTokens: 50,
  totalTokens: 150,
  costMicros: 12,
};

function contextField(organizationId = 'org-1'): ContextField {
  return {
    workspaceId: 'workspace-1',
    organizationId,
    version: 1,
    originSignal: ORIGIN,
    signals: [
      {
        id: 'signal-1',
        kind: 'origin-signal',
        label: 'Initial thought',
        content: ORIGIN,
        evidenceState: 'opinion',
        capturedAt: NOW,
        provenance: 'Human intake',
      },
    ],
    contradictions: [],
    unknowns: ['The purchase barrier has not been established.'],
    createdAt: NOW,
  };
}

const hypothesisInputs: Array<
  Pick<
    VisionHypothesis,
    | 'id'
    | 'title'
    | 'causalMechanism'
    | 'desiredChange'
    | 'affectedStakeholders'
  >
> = [
  {
    id: 'hypothesis-trust',
    title: 'Reduce buyer uncertainty',
    causalMechanism:
      'Incomplete comparison proof prevents qualified buyers from resolving uncertainty and progressing to purchase.',
    desiredChange:
      'Increase qualified buyer confidence by resolving the evidence gaps that block comparison.',
    affectedStakeholders: ['Prospective customer', 'Sales operator'],
  },
  {
    id: 'hypothesis-offer',
    title: 'Repair offer alignment',
    causalMechanism:
      'The active audience prioritises a different outcome, so the current promise attracts attention without intent.',
    desiredChange:
      'Align the offer with a frequent customer job before producing additional acquisition assets.',
    affectedStakeholders: ['Target buyer', 'Product owner'],
  },
  {
    id: 'hypothesis-workflow',
    title: 'Remove fulfilment friction',
    causalMechanism:
      'Operational hand-offs delay the outcome and weaken advocacy, reducing the quality of downstream demand.',
    desiredChange:
      'Shorten the delivery hand-off cycle so customers experience the promised outcome and advocate for it.',
    affectedStakeholders: ['Existing customer', 'Operations team'],
  },
];

function validVisionMap(): VisionMap {
  const researchBranches = VISION_LENSES.map((lens, index) => ({
    id: `branch-${index + 1}`,
    lens,
    question: `Which observed condition would confirm or weaken ${lens} as the main intervention point?`,
    decisionCouldChange: `Whether the team should prioritise the intervention derived from ${lens}.`,
    contextGap: `The current evidence does not establish the contribution of ${lens}.`,
    usefulDistance:
      'This tests a causal condition rather than searching for the named deliverable.',
    supportSignals: ['Behaviour changes when the condition is present.'],
    weakenSignals: ['Outcomes stay unchanged when the condition is removed.'],
    stopCondition:
      'Stop when two independent sources agree or directly conflict.',
  }));

  return {
    contextVersion: 1,
    lensFindings: VISION_LENSES.map(lens => ({
      lens,
      findings: [`A material finding produced through the ${lens} lens.`],
      evidenceRefs: ['context/field.md#signal-1'],
      unknowns: [`The measured contribution of ${lens} is unknown.`],
    })),
    researchBranches,
    hypotheses: hypothesisInputs.map((input, index) => ({
      ...input,
      version: 1,
      evidenceFor: ['One context signal supports this mechanism.'],
      evidenceAgainst: ['One context signal could weaken this mechanism.'],
      invalidatingAssumption:
        'The expected outcome remains unchanged after the mechanism is removed.',
      mainRisk:
        'The intervention may consume capacity without changing the outcome.',
      adjacentValue:
        'The learning can improve a reusable operating capability.',
      researchBranchIds: [`branch-${index + 2}`],
      confidence: 0.6,
    })),
    synthesis:
      'The context supports three different intervention points: buyer uncertainty, offer alignment and operational delivery.',
  };
}

class MemoryRepository implements IntentScapeRepository {
  context: ContextField | null = contextField();
  attempts: VisionAttemptRecord[] = [];
  accepted: AcceptedVisionRecord | null = null;
  goals = new Map<string, GoalContract>();
  workPackets: WorkPacket[] = [];

  async getContextField(input: {
    organizationId: string;
    workspaceId: string;
  }): Promise<ContextField | null> {
    if (
      this.context?.organizationId !== input.organizationId ||
      this.context.workspaceId !== input.workspaceId
    ) {
      return null;
    }
    return this.context;
  }

  async saveVisionAttempt(record: VisionAttemptRecord): Promise<void> {
    this.attempts.push(record);
  }

  async saveAcceptedVision(record: AcceptedVisionRecord): Promise<void> {
    this.accepted = record;
  }

  async getAcceptedVision(input: {
    organizationId: string;
    workspaceId: string;
  }): Promise<AcceptedVisionRecord | null> {
    if (
      this.accepted?.organizationId !== input.organizationId ||
      this.accepted.workspaceId !== input.workspaceId
    ) {
      return null;
    }
    return this.accepted;
  }

  async saveGoalContract(contract: GoalContract): Promise<void> {
    this.goals.set(contract.id, contract);
  }

  async getGoalContract(input: {
    organizationId: string;
    workspaceId: string;
    goalContractId: string;
  }): Promise<GoalContract | null> {
    const contract = this.goals.get(input.goalContractId);
    if (
      contract?.organizationId !== input.organizationId ||
      contract.workspaceId !== input.workspaceId
    ) {
      return null;
    }
    return contract;
  }

  async saveWorkPacket(packet: WorkPacket): Promise<void> {
    this.workPackets.push(packet);
  }
}

function approval(overrides: Record<string, unknown> = {}) {
  return {
    hypothesisId: 'hypothesis-trust',
    hypothesisVersion: 1,
    primaryStakeholder: 'Prospective customer',
    acceptanceCriteria: [
      'Qualified comparison completion increases from baseline.',
    ],
    exclusions: ['No external publishing without separate approval.'],
    authorityBoundaries: ['Draft and research only.'],
    approvedBy: 'user-1',
    approvedAt: NOW,
    ...overrides,
  };
}

function harness(options?: {
  generated?: unknown[];
  evaluations?: unknown[];
  repository?: MemoryRepository;
}) {
  const repository = options?.repository ?? new MemoryRepository();
  const generated = [...(options?.generated ?? [validVisionMap()])];
  const evaluations = [
    ...(options?.evaluations ?? [
      {
        passed: true,
        confidence: 0.9,
        reasons: ['Independent distance confirmed.'],
      },
    ]),
  ];
  const generator = {
    generate: jest.fn(async () => ({
      output: generated.shift(),
      metadata: MODEL_METADATA,
    })),
  };
  const evaluator = {
    evaluate: jest.fn(async () => ({
      output: evaluations.shift(),
      metadata: MODEL_METADATA,
    })),
  };
  const engine = createIntentScapeEngine({
    repository,
    generator,
    evaluator,
    now: () => NOW,
    createId: () => 'goal-1',
  });
  return { engine, evaluator, generator, repository };
}

describe('IntentScape production engine', () => {
  it('accepts a schema-valid, independently evaluated Vision Map', async () => {
    const { engine, repository } = harness();
    const result = await engine.expandVision({
      organizationId: 'org-1',
      workspaceId: 'workspace-1',
    });
    expect(result.visionMap.hypotheses).toHaveLength(3);
    expect(repository.attempts).toHaveLength(1);
    expect(repository.attempts[0]?.status).toBe('accepted');
  });

  it('retries once after a schema-invalid capability-routing response', async () => {
    const unsafe = {
      ...validVisionMap(),
      selectedCapabilities: ['image-generation'],
    };
    const { engine, generator, repository } = harness({
      generated: [unsafe, validVisionMap()],
    });
    await engine.expandVision({
      organizationId: 'org-1',
      workspaceId: 'workspace-1',
    });
    expect(generator.generate).toHaveBeenCalledTimes(2);
    expect(repository.attempts.map(item => item.status)).toEqual([
      'rejected',
      'accepted',
    ]);
  });

  it('fails closed after two anchored responses without calling the evaluator', async () => {
    const anchored = validVisionMap();
    anchored.researchBranches[0]!.question = ORIGIN;
    const { engine, evaluator, repository } = harness({
      generated: [anchored, anchored],
    });
    await expect(
      engine.expandVision({
        organizationId: 'org-1',
        workspaceId: 'workspace-1',
      })
    ).rejects.toBeInstanceOf(VisionExpansionRejectedError);
    expect(repository.attempts).toHaveLength(2);
    expect(evaluator.evaluate).not.toHaveBeenCalled();
  });

  it('retries when the independent evaluator fails or lacks confidence', async () => {
    const { engine, evaluator, repository } = harness({
      generated: [validVisionMap(), validVisionMap()],
      evaluations: [
        {
          passed: false,
          confidence: 0.8,
          reasons: ['Options remain anchored.'],
        },
        {
          passed: true,
          confidence: 0.91,
          reasons: ['Causal distance confirmed.'],
        },
      ],
    });
    await engine.expandVision({
      organizationId: 'org-1',
      workspaceId: 'workspace-1',
    });
    expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
    expect(repository.attempts.map(item => item.status)).toEqual([
      'rejected',
      'accepted',
    ]);
  });

  it('does not disclose another organisation context as an existence oracle', async () => {
    const { engine } = harness();
    await expect(
      engine.expandVision({
        organizationId: 'org-2',
        workspaceId: 'workspace-1',
      })
    ).rejects.toEqual(new IntentScapeNotFoundError('Context Field'));
  });

  it('creates a Goal Contract only from the selected audited hypothesis version', async () => {
    const { engine } = harness();
    await engine.expandVision({
      organizationId: 'org-1',
      workspaceId: 'workspace-1',
    });
    const contract = await engine.approveGoal({
      organizationId: 'org-1',
      workspaceId: 'workspace-1',
      approval: approval(),
    });
    expect(contract.desiredChange).toBe(
      validVisionMap().hypotheses[0]!.desiredChange
    );
    expect(contract.status).toBe('approved');
  });

  it('rejects approval payloads that try to inject new free-text mission authority', async () => {
    const { engine } = harness();
    await engine.expandVision({
      organizationId: 'org-1',
      workspaceId: 'workspace-1',
    });
    await expect(
      engine.approveGoal({
        organizationId: 'org-1',
        workspaceId: 'workspace-1',
        approval: approval({ desiredChange: ORIGIN }),
      })
    ).rejects.toBeInstanceOf(GoalApprovalRejectedError);
  });

  it('rejects stale or missing hypothesis versions', async () => {
    const { engine } = harness();
    await engine.expandVision({
      organizationId: 'org-1',
      workspaceId: 'workspace-1',
    });
    await expect(
      engine.approveGoal({
        organizationId: 'org-1',
        workspaceId: 'workspace-1',
        approval: approval({ hypothesisVersion: 2 }),
      })
    ).rejects.toThrow('missing or stale');
  });

  it('refuses to build a Work Packet without an approved Goal Contract', async () => {
    const { engine } = harness();
    await expect(
      engine.buildWorkPacket({
        organizationId: 'org-1',
        workspaceId: 'workspace-1',
        goalContractId: 'missing',
      })
    ).rejects.toBeInstanceOf(IntentScapeNotFoundError);
  });

  it('builds a bounded Work Packet from the stored approved Goal Contract', async () => {
    const { engine, repository } = harness();
    await engine.expandVision({
      organizationId: 'org-1',
      workspaceId: 'workspace-1',
    });
    const contract = await engine.approveGoal({
      organizationId: 'org-1',
      workspaceId: 'workspace-1',
      approval: approval(),
    });
    const packet = await engine.buildWorkPacket({
      organizationId: 'org-1',
      workspaceId: 'workspace-1',
      goalContractId: contract.id,
    });
    expect(packet.goal).toBe(contract.desiredChange);
    expect(packet).not.toHaveProperty('originSignal');
    expect(packet).not.toHaveProperty('selectedCapabilities');
    expect(repository.workPackets).toEqual([packet]);
  });
});
