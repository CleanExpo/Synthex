/**
 * SYN-MCP-007 (SYN-1084) — structuredContent contract tests.
 *
 * Spike caveat (load-bearing): once a tool declares outputSchema, SDK 1.29.0
 * VALIDATES structuredContent against it at call time and THROWS on mismatch.
 * These tests run each declaring tool's REAL execute() (data mocked at the
 * Prisma boundary) and prove the return parses against its declared
 * outputSchema — the exact validation the SDK performs.
 */

// --- mock the heavy transitive imports of the studio-tools registry ---
jest.mock('@/lib/services/ai/video/generation-service', () => ({
  submitGenerativeVideo: jest.fn(),
}));

const mockClaimFindMany = jest.fn();
const mockClaimFindFirst = jest.fn();
const mockScoreFindMany = jest.fn();
const mockBrandDnaFindUnique = jest.fn();
const mockBosFindUnique = jest.fn();
const mockProfileFindUnique = jest.fn();
const mockOutcomeFindMany = jest.fn();
const mockLedgerFindMany = jest.fn();
const mockOrgFindUnique = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    marketingAgencyClaim: {
      findMany: (...a: unknown[]) => mockClaimFindMany(...a),
      findFirst: (...a: unknown[]) => mockClaimFindFirst(...a),
    },
    claimEvidenceScore: {
      findMany: (...a: unknown[]) => mockScoreFindMany(...a),
    },
    brandDNA: {
      findUnique: (...a: unknown[]) => mockBrandDnaFindUnique(...a),
    },
    brandOperatingSystem: {
      findUnique: (...a: unknown[]) => mockBosFindUnique(...a),
    },
    clientProfile: {
      findUnique: (...a: unknown[]) => mockProfileFindUnique(...a),
    },
    organization: {
      findUnique: (...a: unknown[]) => mockOrgFindUnique(...a),
    },
    marketingAgencyOutcomeEvent: {
      findMany: (...a: unknown[]) => mockOutcomeFindMany(...a),
    },
    pipelineCostLedger: {
      findMany: (...a: unknown[]) => mockLedgerFindMany(...a),
    },
  },
}));

// SYN-MCP-007b boundaries: queue + Linear + retriever registry. The tools'
// REAL execute() runs; only the I/O edges are mocked. Plain arrow wrappers
// (NOT jest.fn factories) — resetMocks would strip factory implementations;
// the inner jest.fn()s are re-primed in beforeEach.
const mockGetJobs = jest.fn();
const mockGetJob = jest.fn();
const mockAddJob = jest.fn();
jest.mock('@/lib/queue/bull-queue', () => ({
  QUEUE_NAMES: { AUTONOMOUS_TASKS: 'autonomous-tasks' },
  getQueue: () => ({
    getJobs: (...a: unknown[]) => mockGetJobs(...a),
    getJob: (...a: unknown[]) => mockGetJob(...a),
  }),
  addJob: (...a: unknown[]) => mockAddJob(...a),
}));
const mockLinearIssue = jest.fn();
jest.mock('@/lib/linear/client', () => ({
  getLinearClient: () => ({
    issue: (...a: unknown[]) => mockLinearIssue(...a),
  }),
}));
const mockGetAvailableRetrievers = jest.fn();
jest.mock('@/lib/evidence/retriever', () => ({
  getAvailableRetrievers: (...a: unknown[]) => mockGetAvailableRetrievers(...a),
}));
jest.mock('@/lib/services/ai/video/cards/brand-cards', () => ({
  getBrandFragment: jest.fn(),
}));
jest.mock('@/lib/video/social-derivation', () => ({
  deriveSocialCut: jest.fn(),
}));
jest.mock('@/lib/services/ai/video/quota', () => ({
  quotaSnapshot: jest.fn(),
}));
jest.mock('@/lib/services/ai/image-generation', () => ({
  generateImage: jest.fn(),
}));
jest.mock('@/lib/services/media-library', () => ({
  mediaLibraryService: {},
}));
jest.mock('@/lib/ai/providers', () => ({ getAIProvider: jest.fn() }));
// NOTE: prompt-layer-builder is intentionally NOT mocked here —
// context_preview_layered_prompt must conform through the REAL builder.

import { z } from 'zod';
import { ALL_MCP_TOOLS, type StudioTool } from '@/lib/services/ai/studio-tools';

const ctx = {
  userId: 'u1',
  organizationId: 'org1',
  initiatedBy: 'mcp' as const,
};

function tool(name: string): StudioTool {
  const t = ALL_MCP_TOOLS.find(x => x.name === name);
  if (!t) throw new Error(`tool ${name} missing from registry`);
  return t;
}

/** Run the tool's real execute() and validate exactly as the SDK would. */
async function executeAndValidate(name: string, args: unknown) {
  const t = tool(name);
  expect(t.outputSchema).toBeDefined();
  const result = await t.execute(args, ctx);
  // SDK builds z.object(rawShape) from the declared shape — identical check.
  const parsed = (t.outputSchema as z.ZodTypeAny).parse(result);
  expect(parsed).toBeDefined();
  return result;
}

beforeEach(() => {
  mockClaimFindMany.mockResolvedValue([]);
  mockClaimFindFirst.mockResolvedValue(null);
  mockScoreFindMany.mockResolvedValue([]);
  mockBrandDnaFindUnique.mockResolvedValue(null);
  mockBosFindUnique.mockResolvedValue(null);
  mockProfileFindUnique.mockResolvedValue(null);
  mockOrgFindUnique.mockResolvedValue(null);
  mockOutcomeFindMany.mockResolvedValue([]);
  mockLedgerFindMany.mockResolvedValue([]);
  mockGetJobs.mockResolvedValue([]);
  mockGetJob.mockResolvedValue(null);
  mockAddJob.mockResolvedValue({ id: 'mock-job' });
  mockLinearIssue.mockResolvedValue(null);
  mockGetAvailableRetrievers.mockReturnValue([]);
});

describe('per-tool structuredContent validates against the declared outputSchema', () => {
  it('approvals_list_pending — populated', async () => {
    mockClaimFindMany.mockResolvedValue([
      {
        id: 'c1',
        campaignId: 'camp1',
        statement: '30% more leads',
        claimType: 'performance',
        approvalStatus: 'pending',
        evidenceStatus: 'blocked',
        createdAt: new Date('2026-07-01T00:00:00Z'),
      },
    ]);
    const out = await executeAndValidate('approvals_list_pending', {});
    expect(out).toMatchObject({
      total: 1,
      claims: [{ id: 'c1', createdAt: '2026-07-01T00:00:00.000Z' }],
    });
  });

  it('approvals_list_pending — empty', async () => {
    await executeAndValidate('approvals_list_pending', {});
  });

  it('approvals_get — found (nullable fields exercised) and null', async () => {
    mockClaimFindFirst.mockResolvedValue({
      id: 'c1',
      campaignId: 'camp1',
      sourceRefId: null,
      statement: '30% more leads',
      claimType: 'performance',
      approvalStatus: 'approved',
      evidenceStatus: 'verified',
      evidenceNotes: null,
      approvedById: 'u9',
      approvedAt: new Date('2026-07-02T00:00:00Z'),
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-02T00:00:00Z'),
    });
    await executeAndValidate('approvals_get', { id: 'c1' });

    mockClaimFindFirst.mockResolvedValue(null);
    const out = await executeAndValidate('approvals_get', { id: 'other' });
    expect(out).toEqual({ claim: null });
  });

  it('context_get_brand — both halves present', async () => {
    mockBrandDnaFindUnique.mockResolvedValue({
      businessName: 'Acme Café',
      vertical: 'café',
      industry: 'hospitality',
      logoUrl: null,
      primaryColour: '#112233',
      secondaryColour: null,
      brandVoice: { tone: 'warm', formality: 2 },
      persona: { ageRange: '25-40' },
      offerings: ['coffee', 'brunch'],
      seoScore: 71,
      sourceUrl: 'https://acme.example',
      lastRefreshedAt: new Date('2026-06-30T00:00:00Z'),
    });
    mockBosFindUnique.mockResolvedValue({
      method: 'hook-first',
      qualityThreshold: 80,
      version: 2,
      systemPromptOverride: null,
      rules: ['no emojis'],
      outputStructure: {},
    });
    await executeAndValidate('context_get_brand', {});
  });

  it('context_get_brand — org with no brand setup (both null)', async () => {
    const out = await executeAndValidate('context_get_brand', {});
    expect(out).toEqual({ brandDna: null, brandOs: null });
  });

  it('context_get_client_profile — present and absent', async () => {
    mockProfileFindUnique.mockResolvedValue({
      budgetTier: 'mid',
      intakeStatus: 'complete',
      intakeSource: 'onboarding-form',
      intakeCompletedAt: new Date('2026-06-01T00:00:00Z'),
      icp: { description: 'local families' },
      offers: ['weekend brunch'],
      proofPoints: [],
      competitors: [],
      toneKeywords: ['warm'],
      antiPatterns: ['clickbait'],
      vocabularyBank: { preferred: [], banned: [] },
      goals: [],
      channels: ['instagram'],
      constraints: {},
      updatedAt: new Date('2026-06-02T00:00:00Z'),
    });
    await executeAndValidate('context_get_client_profile', {});

    mockProfileFindUnique.mockResolvedValue(null);
    const out = await executeAndValidate('context_get_client_profile', {});
    expect(out).toEqual({ profile: null });
  });

  it('context_preview_layered_prompt — REAL builder, disengaged path (all null)', async () => {
    const out = await executeAndValidate('context_preview_layered_prompt', {
      taskType: 'video-script',
    });
    expect(out).toMatchObject({ systemPrompt: null, task: 'video-script' });
  });

  it('context_preview_layered_prompt — REAL builder, engaged via BrandOperatingSystem', async () => {
    mockBosFindUnique.mockResolvedValue({
      method: 'hook-first',
      systemPromptOverride: 'You are the Acme content OS.',
      rules: [],
    });
    const out = await executeAndValidate('context_preview_layered_prompt', {
      taskType: 'caption',
    });
    expect(out).toMatchObject({
      systemPrompt: 'You are the Acme content OS.',
      task: 'caption',
    });
  });

  it('performance_get_outcomes — populated with nullable fields', async () => {
    mockOutcomeFindMany.mockResolvedValue([
      {
        id: 'e1',
        campaignId: null,
        signalId: 's1',
        opportunityId: null,
        eventType: 'conversion',
        status: 'observed',
        outcomeMetric: 'bookings',
        observedValue: '12',
        confidence: 0.7,
        notes: null,
        recordedAt: new Date('2026-07-05T00:00:00Z'),
      },
    ]);
    const out = await executeAndValidate('performance_get_outcomes', {});
    expect(out).toMatchObject({ total: 1 });
  });

  it('performance_get_scores — REAL heuristic scorer, output self-labels method: heuristic', async () => {
    const out = await executeAndValidate('performance_get_scores', {
      content:
        "Here's the truth about our launch: 3 things we learned shipping it. Comment below!",
      platform: 'LinkedIn',
    });
    expect(out).toMatchObject({
      method: 'heuristic',
      scorer: 'content-scorer-heuristic-v1',
      platform: 'linkedin',
    });
    expect(typeof (out as { overall: number }).overall).toBe('number');
  });

  it('performance_cost_report — populated ledger rolls up per pipeline', async () => {
    mockLedgerFindMany.mockResolvedValue([
      {
        pipelineName: 'weekly-digest',
        runId: 'r1',
        model: 'claude-sonnet-4-6',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 0.0105,
        createdAt: new Date('2026-07-08T00:00:00Z'),
      },
      {
        pipelineName: 'weekly-digest',
        runId: 'r2',
        model: 'claude-sonnet-4-6',
        inputTokens: 2000,
        outputTokens: 900,
        costUsd: 0.0195,
        createdAt: new Date('2026-07-09T00:00:00Z'),
      },
    ]);
    const out = await executeAndValidate('performance_cost_report', {
      sinceDays: 14,
    });
    expect(out).toMatchObject({
      sinceDays: 14,
      totalRuns: 2,
      totalCostUsd: 0.03,
      byPipeline: [{ pipelineName: 'weekly-digest', runs: 2, costUsd: 0.03 }],
    });
  });

  it('performance_cost_report — empty ledger', async () => {
    const out = await executeAndValidate('performance_cost_report', {});
    expect(out).toMatchObject({ totalRuns: 0, totalCostUsd: 0, entries: [] });
  });

  // ── SYN-MCP-007b — tasks_* ────────────────────────────────────────────────

  const bullJob = (over: Record<string, unknown> = {}) => ({
    id: 'linear:issue-1:aaaaaaaaaaaaaaaa',
    data: {
      type: 'autonomous:execute-task',
      issueId: 'issue-1',
      identifier: 'SYN-9001',
      title: 'Fix the widget',
      description: 'Body',
      organizationId: 'org1',
      envelope: {
        source: 'mcp',
        issueId: 'issue-1',
        identifier: 'SYN-9001',
        acceptance: ['criterion one'],
        budget: { maxTurns: 50, maxCostUsd: 10 },
        traceId: 'trace-1',
        organizationId: 'org1',
      },
    },
    timestamp: 1751500000000,
    processedOn: 1751500001000,
    finishedOn: 1751500002000,
    attemptsMade: 1,
    failedReason: undefined,
    returnvalue: { turns: 12 },
    getState: jest.fn().mockResolvedValue('completed'),
    ...over,
  });

  it('tasks_list — populated (BullMQ epoch timestamps normalized to ISO) and empty', async () => {
    mockGetJobs.mockResolvedValue([bullJob()]);
    const out = (await executeAndValidate('tasks_list', {
      state: 'queued',
    })) as { tasks: Array<{ enqueuedAt: string }> };
    expect(out.tasks[0].enqueuedAt).toBe(new Date(1751500000000).toISOString());

    mockGetJobs.mockResolvedValue([]);
    const empty = await executeAndValidate('tasks_list', {});
    expect(empty).toMatchObject({ tasks: [], total: 0, error: null });
  });

  it('tasks_list — Redis-degrade error payload still conforms', async () => {
    mockGetJobs.mockRejectedValue(new Error('ECONNREFUSED'));
    const out = await executeAndValidate('tasks_list', {});
    expect(out).toMatchObject({ tasks: [], total: 0 });
  });

  it('tasks_get — found (with result evidence), legacy envelope-less job, and null', async () => {
    mockGetJob.mockResolvedValue(bullJob());
    const found = (await executeAndValidate('tasks_get', {
      jobId: 'linear:issue-1:aaaaaaaaaaaaaaaa',
    })) as { task: { state: string; result: unknown } };
    expect(found.task).toMatchObject({ state: 'completed' });

    // Pre-envelope legacy job stamped with the org (envelope → null).
    mockGetJob.mockResolvedValue(
      bullJob({
        data: {
          type: 'autonomous:execute-task',
          issueId: 'issue-2',
          identifier: 'SYN-9002',
          title: 'Legacy',
          description: null,
          organizationId: 'org1',
        },
        returnvalue: undefined,
        getState: jest.fn().mockResolvedValue('waiting'),
      })
    );
    const legacy = (await executeAndValidate('tasks_get', {
      jobId: 'x',
    })) as { task: { envelope: unknown } };
    expect(legacy.task.envelope).toBeNull();

    mockGetJob.mockResolvedValue(null);
    const missing = await executeAndValidate('tasks_get', { jobId: 'nope' });
    expect(missing).toEqual({ task: null, error: null });
  });

  it('tasks_enqueue — enqueued, deduped, gate-refused and Linear-degrade payloads all conform', async () => {
    const issue = {
      id: 'issue-1',
      identifier: 'SYN-9001',
      title: 'Fix the widget',
      description: '- [ ] criterion one',
      labels: jest
        .fn()
        .mockResolvedValue({ nodes: [{ id: 'l1', name: 'autonomous' }] }),
      state: Promise.resolve({ id: 's1', name: 'Todo', type: 'unstarted' }),
    };
    mockLinearIssue.mockResolvedValue(issue);
    const ok = await executeAndValidate('tasks_enqueue', {
      issueId: 'SYN-9001',
    });
    expect(ok).toMatchObject({ enqueued: true, deduped: false, reason: null });

    mockGetJob.mockResolvedValue(bullJob());
    const dup = await executeAndValidate('tasks_enqueue', {
      issueId: 'SYN-9001',
    });
    expect(dup).toMatchObject({ enqueued: false, deduped: true });

    mockGetJob.mockResolvedValue(null);
    mockLinearIssue.mockResolvedValue({
      ...issue,
      labels: jest.fn().mockResolvedValue({ nodes: [] }),
    });
    const refused = await executeAndValidate('tasks_enqueue', {
      issueId: 'SYN-9001',
    });
    expect(refused).toMatchObject({ enqueued: false });

    mockLinearIssue.mockRejectedValue(new Error('boom'));
    const degraded = await executeAndValidate('tasks_enqueue', {
      issueId: 'SYN-9001',
    });
    expect(degraded).toMatchObject({ enqueued: false, jobId: null });
  });

  // ── SYN-MCP-007b — research_* ─────────────────────────────────────────────

  const sourceEvidence = (url: string) => ({
    url,
    title: 'Field study',
    publishedAt: null,
    retrievedAt: '2026-07-10T00:00:00.000Z',
    provider: 'firecrawl',
    contentHash: 'abc123',
    excerpt: 'Independent field study…',
    domain: 'example.com',
  });

  it('research_search — populated (real retriever shapes) and zero-provider empty', async () => {
    mockGetAvailableRetrievers.mockReturnValue([
      {
        id: 'firecrawl',
        capabilities: { canSearch: true, canFetch: true },
        available: () => true,
        search: jest
          .fn()
          .mockResolvedValue([sourceEvidence('https://example.com/a')]),
        fetch: jest.fn(),
      },
    ]);
    const out = await executeAndValidate('research_search', {
      query: 'acme drying time',
    });
    expect(out).toMatchObject({
      retrieversAvailable: ['firecrawl'],
      retrieversUsed: ['firecrawl'],
    });

    mockGetAvailableRetrievers.mockReturnValue([]);
    const empty = await executeAndValidate('research_search', {
      query: 'acme drying time',
    });
    expect(empty).toMatchObject({ sources: [], retrieversAvailable: [] });
  });

  it('research_fetch — fetched source, provider null-content, and no-provider payloads conform', async () => {
    const retriever = {
      id: 'firecrawl',
      capabilities: { canSearch: true, canFetch: true },
      available: () => true,
      search: jest.fn(),
      fetch: jest
        .fn()
        .mockResolvedValue(sourceEvidence('https://example.com/a')),
    };
    mockGetAvailableRetrievers.mockReturnValue([retriever]);
    const ok = await executeAndValidate('research_fetch', {
      url: 'https://example.com/a',
    });
    expect(ok).toMatchObject({ provider: 'firecrawl', error: null });

    retriever.fetch.mockResolvedValue(null); // provider yielded no content
    const noContent = await executeAndValidate('research_fetch', {
      url: 'https://example.com/a',
    });
    expect(noContent).toMatchObject({ source: null, provider: 'firecrawl' });

    mockGetAvailableRetrievers.mockReturnValue([]);
    const none = await executeAndValidate('research_fetch', {
      url: 'https://example.com/a',
    });
    expect(none).toMatchObject({ source: null, provider: null });
  });

  it('research_get_evidence_bundle — rehydrated rows through the REAL pure policy, plus not-found', async () => {
    mockClaimFindFirst.mockResolvedValue({
      id: 'c1',
      claimType: 'factual',
      evidenceStatus: 'blocked',
    });
    mockScoreFindMany.mockResolvedValue([
      {
        sourceRefId: 'sr1',
        stance: 'supports',
        confidence: 0.9,
        scorer: 'llm-judge-v1',
        rationale: 'Directly supports.',
        scoredAt: new Date('2026-07-09T00:00:00Z'),
        sourceRef: {
          id: 'sr1',
          url: 'https://example.com/a',
          label: 'Source A',
          contentHash: 'h1',
          retrievedAt: new Date('2026-07-08T00:00:00Z'),
          provider: 'firecrawl',
          excerpt: 'excerpt A',
        },
      },
      {
        // Null-URL row — must be SKIPPED and recorded in aggregate.reasons.
        sourceRefId: 'sr2',
        stance: 'supports',
        confidence: 0.9,
        scorer: 'llm-judge-v1',
        rationale: null,
        scoredAt: new Date('2026-07-09T00:00:00Z'),
        sourceRef: {
          id: 'sr2',
          url: null,
          label: 'No URL',
          contentHash: null,
          retrievedAt: null,
          provider: null,
          excerpt: null,
        },
      },
    ]);
    const out = (await executeAndValidate('research_get_evidence_bundle', {
      claimId: 'c1',
    })) as {
      bundle: { sources: unknown[]; aggregate: { reasons: string[] } };
      persistedEvidenceStatus: string;
      scoreRowCount: number;
    };
    expect(out.persistedEvidenceStatus).toBe('blocked');
    expect(out.scoreRowCount).toBe(2);
    expect(out.bundle.sources).toHaveLength(1);
    expect(out.bundle.aggregate.reasons.join(' ')).toMatch(/skipped/i);

    mockClaimFindFirst.mockResolvedValue(null);
    const missing = await executeAndValidate('research_get_evidence_bundle', {
      claimId: 'other-org-claim',
    });
    expect(missing).toEqual({
      claimId: 'other-org-claim',
      bundle: null,
      persistedEvidenceStatus: null,
      freshEvidenceStatus: null,
      scoreRowCount: 0,
    });
  });
});

describe('outputSchema declaration discipline (spike caveat)', () => {
  it('every declared outputSchema is a z.object whose .shape the route can register', () => {
    for (const t of ALL_MCP_TOOLS) {
      if (!t.outputSchema) continue;
      const shape = (t.outputSchema as z.ZodObject<z.ZodRawShape>).shape;
      expect(shape && typeof shape).toBe('object');
      expect(Object.keys(shape).length).toBeGreaterThan(0);
    }
  });

  it('creative tools do NOT declare outputSchema yet (returns embed Dates/provider passthroughs — never blanket-add)', () => {
    for (const t of ALL_MCP_TOOLS.filter(x => x.scope === 'creative')) {
      expect(t.outputSchema).toBeUndefined();
    }
  });

  it('a schema violation would throw exactly as the SDK does at call time (negative control)', () => {
    const t = tool('approvals_list_pending');
    expect(() =>
      (t.outputSchema as z.ZodTypeAny).parse({ claims: 'not-an-array' })
    ).toThrow();
  });
});
