import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import {
  createIntentScapeEngine,
  IntentScapeStaleContextError,
  PrismaIntentScapeRepository,
  VISION_LENSES,
  type MarkdownArtifactStore,
  type StoredMarkdownArtifact,
  type VisionMap,
} from '@/lib/intentscape';

const NOW = '2026-08-03T00:00:00.000Z';

function matches(
  row: Record<string, any>,
  where: Record<string, any>
): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('in' in expected) return expected.in.includes(actual);
      if ('not' in expected) return actual !== expected.not;
    }
    return actual === expected;
  });
}

function select<T extends Record<string, any>>(
  row: T,
  selection?: Record<string, boolean>
) {
  if (!selection) return row;
  return Object.fromEntries(Object.keys(selection).map(key => [key, row[key]]));
}

class MemoryPrisma {
  workspaces: Array<Record<string, any>> = [];
  artifacts: Array<Record<string, any>> = [];
  runs: Array<Record<string, any>> = [];
  hypotheses: Array<Record<string, any>> = [];
  goals: Array<Record<string, any>> = [];
  events: Array<Record<string, any>> = [];

  intentScapeWorkspace = {
    create: jest.fn(async ({ data }: any) => {
      const row = {
        ...data,
        createdAt: new Date(NOW),
        updatedAt: new Date(NOW),
      };
      this.workspaces.push(row);
      return row;
    }),
    findFirst: jest.fn(async ({ where, select: selection }: any) => {
      const row = this.workspaces.find(candidate => matches(candidate, where));
      return row ? select(row, selection) : null;
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const row = this.workspaces.find(candidate => matches(candidate, where));
      if (!row) throw new Error('workspace not found');
      Object.assign(row, data);
      return row;
    }),
    updateMany: jest.fn(async ({ where, data }: any) => {
      const rows = this.workspaces.filter(candidate =>
        matches(candidate, where)
      );
      rows.forEach(row => Object.assign(row, data));
      return { count: rows.length };
    }),
  };

  intentScapeArtifact = {
    create: jest.fn(async ({ data, select: selection }: any) => {
      const row = {
        id: `artifact-${this.artifacts.length + 1}`,
        ...data,
        createdAt: new Date(NOW),
      };
      this.artifacts.push(row);
      return select(row, selection);
    }),
    findFirst: jest.fn(async ({ where, select: selection }: any) => {
      const row = this.artifacts.find(candidate => matches(candidate, where));
      return row ? select(row, selection) : null;
    }),
  };

  intentScapeVisionRun = {
    create: jest.fn(async ({ data }: any) => {
      const row = {
        ...data,
        createdAt: new Date(NOW),
        updatedAt: new Date(NOW),
      };
      this.runs.push(row);
      return row;
    }),
    findFirst: jest.fn(async ({ where, select: selection }: any) => {
      const candidates = this.runs.filter(candidate =>
        matches(candidate, where)
      );
      const row = candidates.at(-1);
      return row ? select(row, selection) : null;
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const row = this.runs.find(candidate => matches(candidate, where));
      if (!row) throw new Error('vision run not found');
      Object.assign(row, data);
      return row;
    }),
  };

  intentScapeHypothesis = {
    createMany: jest.fn(async ({ data }: any) => {
      data.forEach((candidate: Record<string, any>) => {
        this.hypotheses.push({
          id: `hypothesis-row-${this.hypotheses.length + 1}`,
          ...candidate,
        });
      });
      return { count: data.length };
    }),
    findFirst: jest.fn(async ({ where, select: selection }: any) => {
      const row = this.hypotheses.find(candidate => matches(candidate, where));
      return row ? select(row, selection) : null;
    }),
  };

  intentScapeGoalContract = {
    aggregate: jest.fn(async ({ where }: any) => {
      const versions = this.goals
        .filter(candidate => matches(candidate, where))
        .map(candidate => candidate.version as number);
      return {
        _max: { version: versions.length ? Math.max(...versions) : null },
      };
    }),
    create: jest.fn(async ({ data }: any) => {
      const row = { ...data, createdAt: new Date(NOW) };
      this.goals.push(row);
      return row;
    }),
    findFirst: jest.fn(async ({ where, select: selection }: any) => {
      const row = this.goals.find(candidate => matches(candidate, where));
      return row ? select(row, selection) : null;
    }),
  };

  intentScapeEvent = {
    create: jest.fn(async ({ data }: any) => {
      const row = {
        id: `event-${this.events.length + 1}`,
        ...data,
        createdAt: new Date(NOW),
      };
      this.events.push(row);
      return row;
    }),
  };

  $transaction = jest.fn(async (operations: Array<Promise<unknown>>) =>
    Promise.all(operations)
  );
}

class MemoryMarkdownStore implements MarkdownArtifactStore {
  objects = new Map<string, StoredMarkdownArtifact>();
  reads = jest.fn();

  async writeVersion(input: {
    organizationId: string;
    workspaceId: string;
    logicalPath: string;
    version: number;
    markdown: string;
  }): Promise<StoredMarkdownArtifact> {
    const markdown = input.markdown.endsWith('\n')
      ? input.markdown
      : `${input.markdown}\n`;
    const contentHash = createHash('sha256')
      .update(markdown, 'utf8')
      .digest('hex');
    const storagePath = `${input.organizationId}/${input.workspaceId}/${input.logicalPath}/v${input.version}-${contentHash.slice(0, 8)}.md`;
    const stored = {
      storagePath,
      contentHash,
      byteSize: Buffer.byteLength(markdown),
      markdown,
    };
    this.objects.set(storagePath, stored);
    return stored;
  }

  async readVersion(input: {
    organizationId: string;
    workspaceId: string;
    storagePath: string;
    expectedHash: string;
  }): Promise<StoredMarkdownArtifact> {
    this.reads(input);
    const prefix = `${input.organizationId}/${input.workspaceId}/`;
    const stored = this.objects.get(input.storagePath);
    if (!input.storagePath.startsWith(prefix) || !stored) {
      throw new Error('cross-organisation artifact read');
    }
    if (stored.contentHash !== input.expectedHash) {
      throw new Error('hash mismatch');
    }
    return stored;
  }
}

function visionMap(): VisionMap {
  const branches = VISION_LENSES.map((lens, index) => ({
    id: `branch-${index + 1}`,
    lens,
    question: `Which observed condition would confirm or weaken ${lens} as the intervention point?`,
    decisionCouldChange: `Whether the direction derived from ${lens} should be prioritised.`,
    contextGap: `The current evidence does not isolate the contribution of ${lens}.`,
    usefulDistance:
      'This tests a causal condition rather than searching for the named deliverable.',
    supportSignals: ['The outcome changes when the condition is present.'],
    weakenSignals: ['The outcome stays stable when the condition changes.'],
    stopCondition: 'Stop when two independent sources converge or conflict.',
  }));
  const mechanisms = [
    {
      id: 'hypothesis-trust',
      title: 'Resolve comparison uncertainty',
      causalMechanism:
        'Missing comparison evidence prevents qualified customers from resolving uncertainty.',
      desiredChange:
        'Increase qualified-customer confidence by closing decision-critical evidence gaps.',
      stakeholder: 'Prospective customer',
    },
    {
      id: 'hypothesis-offer',
      title: 'Repair outcome alignment',
      causalMechanism:
        'The active promise attracts attention but does not match the frequent customer job.',
      desiredChange:
        'Align the offer around an observed customer job before adding acquisition assets.',
      stakeholder: 'Target buyer',
    },
    {
      id: 'hypothesis-delivery',
      title: 'Remove delivery friction',
      causalMechanism:
        'Slow operational hand-offs weaken the experienced outcome and downstream advocacy.',
      desiredChange:
        'Shorten the delivery hand-off cycle before increasing demand generation.',
      stakeholder: 'Existing customer',
    },
  ];
  return {
    contextVersion: 1,
    lensFindings: VISION_LENSES.map(lens => ({
      lens,
      findings: [`A material condition was found through ${lens}.`],
      evidenceRefs: ['context/field.md#signal-1'],
      unknowns: [`The measured contribution of ${lens} remains unknown.`],
    })),
    researchBranches: branches,
    hypotheses: mechanisms.map((item, index) => ({
      id: item.id,
      version: 1,
      title: item.title,
      causalMechanism: item.causalMechanism,
      desiredChange: item.desiredChange,
      affectedStakeholders: [item.stakeholder],
      evidenceFor: ['One context signal supports the mechanism.'],
      evidenceAgainst: ['One context signal could weaken the mechanism.'],
      invalidatingAssumption:
        'The outcome remains unchanged after the mechanism is removed.',
      mainRisk: 'Capacity may be spent without changing the target outcome.',
      adjacentValue: 'The learning can strengthen a reusable capability.',
      researchBranchIds: [`branch-${index + 1}`],
      confidence: 0.61,
    })),
    synthesis:
      'Three causally distinct intervention points should be compared before action.',
  };
}

function harness() {
  const memory = new MemoryPrisma();
  const markdown = new MemoryMarkdownStore();
  let id = 0;
  const repository = new PrismaIntentScapeRepository(
    memory as unknown as PrismaClient,
    markdown,
    'user-1',
    () => NOW,
    kind => `${kind}-${++id}`
  );
  return { memory, markdown, repository };
}

describe('Prisma IntentScape repository', () => {
  it('creates canonical context without storing raw origin text in workspace metadata', async () => {
    const { markdown, memory, repository } = harness();
    const created = await repository.createWorkspace({
      organizationId: 'org-1',
      createdById: 'user-1',
      title: 'Explore the real growth constraint',
      originSignal: 'Build us a product image tool.',
    });

    expect(created.state).toBe('context_ready');
    expect(memory.workspaces[0]).not.toHaveProperty('originSignal');
    expect(memory.workspaces[0].originSignalHash).toMatch(/^[0-9a-f]{64}$/);
    expect(memory.artifacts.map(item => item.kind)).toEqual([
      'origin-signal',
      'context-field',
    ]);
    expect(
      await repository.getContextField({
        organizationId: 'org-1',
        workspaceId: created.id,
      })
    ).toEqual(created.contextField);

    const readsBeforeCrossOrg = markdown.reads.mock.calls.length;
    await expect(
      repository.getContextField({
        organizationId: 'org-2',
        workspaceId: created.id,
      })
    ).resolves.toBeNull();
    expect(markdown.reads).toHaveBeenCalledTimes(readsBeforeCrossOrg);
  });

  it('uses optimistic context versions and rejects stale saves', async () => {
    const { memory, repository } = harness();
    const created = await repository.createWorkspace({
      organizationId: 'org-1',
      createdById: 'user-1',
      title: 'Versioned context',
      originSignal: 'We need more leads.',
    });
    const versionTwo = {
      ...created.contextField,
      version: 2,
      unknowns: [...created.contextField.unknowns, 'Lead quality is unknown.'],
    };
    await repository.saveContextField(versionTwo);
    await expect(
      repository.saveContextField(versionTwo)
    ).rejects.toBeInstanceOf(IntentScapeStaleContextError);
    expect(memory.workspaces[0].activeContextVersion).toBe(2);
    expect(memory.events.map(event => event.eventType)).toContain(
      'context.versioned'
    );
  });

  it('persists, reloads, approves and gates the full engine loop', async () => {
    const { memory, repository } = harness();
    const created = await repository.createWorkspace({
      organizationId: 'org-1',
      createdById: 'user-1',
      title: 'Durable expansion',
      originSignal: 'Build us a product image tool.',
    });
    const engine = createIntentScapeEngine({
      repository,
      generator: {
        generate: async () => ({
          output: visionMap(),
          metadata: {
            provider: 'TestProvider',
            model: 'generator-model',
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
            costMicros: 10,
          },
        }),
      },
      evaluator: {
        evaluate: async () => ({
          output: {
            passed: true,
            confidence: 0.92,
            reasons: ['The mechanisms are independently distinguishable.'],
          },
          metadata: {
            provider: 'TestProvider',
            model: 'evaluator-model',
            promptTokens: 60,
            completionTokens: 20,
            totalTokens: 80,
            costMicros: 4,
          },
        }),
      },
      now: () => NOW,
      createId: () => 'goal-1',
    });

    await engine.expandVision({
      organizationId: 'org-1',
      workspaceId: created.id,
    });
    expect(memory.hypotheses).toHaveLength(3);
    expect(memory.runs[0]).toMatchObject({
      generatorModel: 'generator-model',
      evaluatorModel: 'evaluator-model',
      totalTokens: 230,
      costMicros: 14,
    });
    expect(memory.workspaces[0].state).toBe('awaiting_approval');

    const contract = await engine.approveGoal({
      organizationId: 'org-1',
      workspaceId: created.id,
      approval: {
        hypothesisId: 'hypothesis-trust',
        hypothesisVersion: 1,
        primaryStakeholder: 'Prospective customer',
        acceptanceCriteria: ['Qualified comparison completion increases.'],
        exclusions: ['No external publishing.'],
        authorityBoundaries: ['Research and drafting only.'],
        approvedBy: 'user-1',
        approvedAt: NOW,
      },
    });
    expect(memory.goals).toHaveLength(1);
    expect(memory.workspaces[0].state).toBe('approved');
    expect(memory.events.map(event => event.eventType)).toEqual([
      'workspace.created',
      'vision.accepted',
      'vision.awaiting_approval',
      'goal.approved',
    ]);

    await expect(
      engine.buildWorkPacket({
        organizationId: 'org-1',
        workspaceId: created.id,
        goalContractId: contract.id,
      })
    ).resolves.toMatchObject({
      goalContractId: 'goal-1',
      goal: 'Increase qualified-customer confidence by closing decision-critical evidence gaps.',
    });
    await expect(
      repository.getGoalContract({
        organizationId: 'org-2',
        workspaceId: created.id,
        goalContractId: contract.id,
      })
    ).resolves.toBeNull();
  });
});
