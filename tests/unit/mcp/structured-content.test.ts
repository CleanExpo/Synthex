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
const mockSubmitGenerativeVideo = jest.fn();
jest.mock('@/lib/services/ai/video/generation-service', () => ({
  submitGenerativeVideo: (...a: unknown[]) => mockSubmitGenerativeVideo(...a),
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
const mockLedgerGroupBy = jest.fn();
const mockMediaSpendGroupBy = jest.fn();
const mockVideoFindFirst = jest.fn();
const mockVideoFindMany = jest.fn();
const mockCheckDatabaseHealth = jest.fn();

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
      groupBy: (...a: unknown[]) => mockLedgerGroupBy(...a),
    },
    mediaSpendEvent: {
      groupBy: (...a: unknown[]) => mockMediaSpendGroupBy(...a),
    },
    videoGeneration: {
      findFirst: (...a: unknown[]) => mockVideoFindFirst(...a),
      findMany: (...a: unknown[]) => mockVideoFindMany(...a),
    },
  },
  checkDatabaseHealth: (...a: unknown[]) => mockCheckDatabaseHealth(...a),
}));
const mockCacheHealth = jest.fn();
jest.mock('@/lib/redis-unified', () => ({
  healthCheck: (...a: unknown[]) => mockCacheHealth(...a),
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
// Creative/media boundaries (P5): the tools' REAL execute() runs; only the
// provider, queue, storage and network edges are doubled.
const mockGetBrandFragment = jest.fn();
jest.mock('@/lib/services/ai/video/cards/brand-cards', () => ({
  getBrandFragment: (...a: unknown[]) => mockGetBrandFragment(...a),
}));
const mockDeriveSocialCut = jest.fn();
jest.mock('@/lib/video/social-derivation', () => ({
  deriveSocialCut: (...a: unknown[]) => mockDeriveSocialCut(...a),
}));
const mockQuotaSnapshot = jest.fn();
jest.mock('@/lib/services/ai/video/quota', () => ({
  quotaSnapshot: (...a: unknown[]) => mockQuotaSnapshot(...a),
}));
const mockGenerateImage = jest.fn();
jest.mock('@/lib/services/ai/image-generation', () => ({
  generateImage: (...a: unknown[]) => mockGenerateImage(...a),
}));
const mockGetAssets = jest.fn();
jest.mock('@/lib/services/media-library', () => ({
  mediaLibraryService: {
    getAssets: (...a: unknown[]) => mockGetAssets(...a),
  },
}));
const mockComplete = jest.fn();
jest.mock('@/lib/ai/providers', () => ({
  getAIProvider: () => ({ complete: (...a: unknown[]) => mockComplete(...a) }),
}));
const mockGenerateSiteForOrg = jest.fn();
jest.mock('@/lib/ai-websites/generate-for-org', () => {
  class GbpConnectionMissingError extends Error {}
  return {
    generateSiteForOrg: (...a: unknown[]) => mockGenerateSiteForOrg(...a),
    GbpConnectionMissingError,
  };
});
jest.mock('@/lib/security/validate-url', () => ({
  assertExternalUrlSafe: async (u: string) => {
    if (u.includes('169.254')) throw new Error('private address');
  },
}));
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
  mockLedgerGroupBy.mockResolvedValue([]);
  mockMediaSpendGroupBy.mockResolvedValue([]);
  mockVideoFindFirst.mockResolvedValue(null);
  mockVideoFindMany.mockResolvedValue([]);
  mockCheckDatabaseHealth.mockResolvedValue({ healthy: true, latency: 5 });
  mockCacheHealth.mockResolvedValue({ status: 'healthy', connection: 'redis' });
  mockQuotaSnapshot.mockResolvedValue({
    spentUsd: 12.5,
    monthlyBudgetUsd: 75,
    spentTodayUsd: 1.2,
    dailyBudgetUsd: 10,
    warning: false,
  });
  mockGetBrandFragment.mockResolvedValue(null);
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

  it('P5: every registered tool declares an outputSchema that converts to an object JSON Schema (as tools/list does)', () => {
    for (const t of ALL_MCP_TOOLS) {
      expect([t.name, Boolean(t.outputSchema)]).toEqual([t.name, true]);
      const json = z.toJSONSchema(t.outputSchema as z.ZodTypeAny, {
        io: 'output',
      });
      expect([t.name, json.type]).toEqual([t.name, 'object']);
    }
  });

  it('a schema violation would throw exactly as the SDK does at call time (negative control)', () => {
    const t = tool('approvals_list_pending');
    expect(() =>
      (t.outputSchema as z.ZodTypeAny).parse({ claims: 'not-an-array' })
    ).toThrow();
  });
});

/**
 * P5 — creative_* and media_* outputs.
 * SEAM: each tool's real execute() through ALL_MCP_TOOLS, validated with its
 * declared outputSchema exactly as the SDK validates structuredContent, and
 * JSON round-tripped (what crosses the wire). Catches: Date / Decimal leaking
 * into structuredContent, a schema that rejects a real return (success and
 * honest-failure paths). Misses: provider internals (doubled at the edge).
 */
describe('P5 creative + media tools: real returns validate against outputSchema', () => {
  /** Validate the raw return AND prove it is JSON-stable (no Date/Decimal). */
  async function validateWire(name: string, args: unknown) {
    const out = await executeAndValidate(name, args);
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
    return out;
  }
  const decimal = (v: string) => ({ toString: () => v, toJSON: () => v });

  it('derive_cuts — one entry per cut, publish stays human-gated', async () => {
    mockDeriveSocialCut
      .mockResolvedValueOnce({ assetId: 'a1', subjectLost: false })
      .mockResolvedValueOnce({ assetId: 'a2', subjectLost: true });
    const cut = {
      target: '9:16',
      maxSec: 30,
      captionPlacement: 'upper',
      caption: 'c',
    };
    const out = await validateWire('derive_cuts', {
      heroAssetId: 'h1',
      cuts: [
        { ...cut, platform: 'tiktok' },
        { ...cut, platform: 'youtube', youtube: { title: 't' } },
      ],
    });
    expect(out).toEqual({
      heroAssetId: 'h1',
      cuts: [
        {
          platform: 'tiktok',
          assetId: 'a1',
          subjectLost: false,
          publishState: 'queued_human_gated',
        },
        {
          platform: 'youtube',
          assetId: 'a2',
          subjectLost: true,
          publishState: 'queued_human_gated',
        },
      ],
    });
  });

  it('list_cards — REAL catalogs, with and without a brand card', async () => {
    const out = await validateWire('list_cards', {});
    expect(out).toMatchObject({ brandCard: null, quota: { warning: false } });
    mockGetBrandFragment.mockResolvedValue('brand fragment');
    await expect(validateWire('list_cards', {})).resolves.toMatchObject({
      brandCard: { organizationId: 'org1' },
    });
  });

  it('generate_video — submitted jobs (grounded and not) plus budgetWarning', async () => {
    mockSubmitGenerativeVideo.mockResolvedValue([
      {
        id: 'v1',
        providerJobId: 'p1',
        batchGroupId: 'b1',
        model: 'm',
        estimatedCostUsd: 0.42,
        status: 'generating',
      },
      {
        id: 'v2',
        providerJobId: 'p2',
        batchGroupId: 'b1',
        model: 'm',
        estimatedCostUsd: 0.42,
        status: 'generating',
        grounded: true,
        referenceSet: 'restoration',
        groundedSubject: 'mould',
        groundedVendor: 'own',
      },
    ]);
    const out = await validateWire('generate_video', {
      prompt: 'water damage reveal',
      methodCardId: 'product-reveal',
    });
    expect(out).toMatchObject({
      budgetWarning: false,
      jobs: [{ id: 'v1' }, { id: 'v2' }],
    });
  });

  it('generate_image — success, blocked and ungrounded results all conform', async () => {
    for (const result of [
      {
        success: true,
        imageUrl: 'https://x/i.png',
        provider: 'gemini',
        grounded: true,
        referenceSet: 'restoration',
        refCount: 3,
        metadata: { model: 'm', width: 1024, height: 1024, loraApplied: true },
        estimatedCostUsd: 0.04,
        warnings: ['w'],
      },
      {
        success: false,
        provider: 'gemini',
        blocked: true,
        error: 'no owned reference covers "boat"',
        estimatedCostUsd: 0.04,
      },
      {
        success: false,
        provider: 'stability',
        error: 'missing key',
        neverReachedProvider: true,
      },
    ]) {
      mockGenerateImage.mockResolvedValue(result);
      await expect(
        validateWire('generate_image', { prompt: 'a mould treatment' })
      ).resolves.toEqual({ result });
    }
  });

  it('get_job — Date and Decimal columns normalised to ISO string / number; null when absent', async () => {
    mockVideoFindFirst.mockResolvedValue({
      id: 'v1',
      status: 'rendered',
      videoUrl: 'https://x/v.mp4',
      errorMessage: null,
      model: 'fal-ai/wan-25',
      batchGroupId: null,
      estimatedCostUsd: decimal('0.4200'),
      actualCostUsd: null,
      createdAt: new Date('2026-10-01T00:00:00Z'),
    });
    await expect(validateWire('get_job', { id: 'v1' })).resolves.toEqual({
      job: {
        id: 'v1',
        status: 'rendered',
        videoUrl: 'https://x/v.mp4',
        errorMessage: null,
        model: 'fal-ai/wan-25',
        batchGroupId: null,
        estimatedCostUsd: 0.42,
        actualCostUsd: null,
        createdAt: '2026-10-01T00:00:00.000Z',
      },
    });
    mockVideoFindFirst.mockResolvedValue(null);
    await expect(validateWire('get_job', { id: 'nope' })).resolves.toEqual({
      job: null,
    });
  });

  it('list_jobs — createdAt as ISO string', async () => {
    mockVideoFindMany.mockResolvedValue([
      {
        id: 'v1',
        status: 'generating',
        videoUrl: null,
        methodCardId: 'product-reveal',
        batchGroupId: 'b1',
        createdAt: new Date('2026-10-02T00:00:00Z'),
      },
    ]);
    await expect(validateWire('list_jobs', {})).resolves.toEqual({
      jobs: [
        {
          id: 'v1',
          status: 'generating',
          videoUrl: null,
          methodCardId: 'product-reveal',
          batchGroupId: 'b1',
          createdAt: '2026-10-02T00:00:00.000Z',
        },
      ],
    });
  });

  it('search_media_library — asset shape conforms', async () => {
    mockGetAssets.mockResolvedValue({
      assets: [
        {
          id: 'm1',
          userId: 'u1',
          type: 'image',
          provider: 'fal',
          status: 'completed',
          url: 'https://x/m.png',
          metadata: {},
          tags: ['a'],
          isFavorite: false,
          isArchived: false,
          usageCount: 0,
          createdAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-01T00:00:00.000Z',
        },
      ],
      total: 1,
    });
    await expect(
      validateWire('search_media_library', { search: 'mould' })
    ).resolves.toMatchObject({ total: 1 });
  });

  it('list_reference_sets — REAL manifest', async () => {
    const out = await validateWire('list_reference_sets', {});
    expect(Array.isArray(out.sets)).toBe(true);
  });

  it('draft_caption — drafted, empty completion and job-not-found conform', async () => {
    mockVideoFindFirst.mockResolvedValue({
      inputPrompt: 'p',
      enhancedPrompt: null,
      methodCardId: null,
    });
    mockComplete.mockResolvedValue({
      choices: [{ message: { content: ' A caption ' } }],
    });
    await expect(
      validateWire('draft_caption', { jobId: 'v1', platform: 'linkedin' })
    ).resolves.toEqual({ caption: 'A caption' });
    mockComplete.mockResolvedValue({ choices: [] });
    await expect(
      validateWire('draft_caption', { jobId: 'v1', platform: 'linkedin' })
    ).resolves.toEqual({ caption: null });
    mockVideoFindFirst.mockResolvedValue(null);
    await expect(
      validateWire('draft_caption', { jobId: 'v9', platform: 'linkedin' })
    ).resolves.toEqual({ caption: null, error: 'job not found' });
  });

  it('generate_site_from_gbp — generated section and missing-GBP refusal conform', async () => {
    mockGenerateSiteForOrg.mockResolvedValue({
      profile: { name: 'Acme', services: [{}, {}], reviews: [] },
      result: {
        ok: true,
        slug: 'water-damage',
        canonicalUrl: 'https://acme.example/water-damage',
        html: '<section></section>',
        jsonLd: { '@context': 'https://schema.org', '@graph': [] },
        copy: {
          headline: 'h',
          intro: 'i',
          bodyParagraphs: ['b'],
          faqs: [{ question: 'q', answer: 'a' }],
        },
        validations: [{ rule: 'aid-rule', severity: 'warn', message: 'm' }],
      },
    });
    await expect(
      validateWire('generate_site_from_gbp', { locationId: 'l1' })
    ).resolves.toMatchObject({
      ok: true,
      profile: { name: 'Acme', servicesCount: 2, hasReviews: false },
    });
    const { GbpConnectionMissingError } = jest.requireMock(
      '@/lib/ai-websites/generate-for-org'
    );
    mockGenerateSiteForOrg.mockRejectedValue(
      new GbpConnectionMissingError('no GBP connected')
    );
    await expect(
      validateWire('generate_site_from_gbp', { locationId: 'l1' })
    ).resolves.toEqual({ ok: false, error: 'no GBP connected' });
  });

  describe('media_* over the worker', () => {
    const realFetch = global.fetch;
    const worker = (status: number, body: unknown) => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: status < 400,
        status,
        json: async () => body,
      }) as never;
    };
    beforeEach(() => {
      process.env.MEDIA_WORKER_URL = 'https://worker.test';
    });
    afterEach(() => {
      global.fetch = realFetch;
      delete process.env.MEDIA_WORKER_URL;
    });
    const url = { videoUrl: 'https://cdn.example/v.mp4' };

    it('media_probe — ffprobe JSON, worker error, unconfigured worker and SSRF rejection conform', async () => {
      worker(200, {
        format: { duration: '6.0', format_name: 'mp4' },
        streams: [{ codec_name: 'h264', width: 1080 }],
      });
      await expect(validateWire('media_probe', url)).resolves.toMatchObject({
        format: { duration: '6.0' },
      });
      worker(500, { error: 'ffprobe failed' });
      await expect(validateWire('media_probe', url)).resolves.toEqual({
        error: 'ffprobe failed',
      });
      await expect(
        validateWire('media_probe', { videoUrl: 'http://169.254.169.254/x' })
      ).resolves.toMatchObject({ error: expect.stringMatching(/rejected/) });
      delete process.env.MEDIA_WORKER_URL;
      await expect(validateWire('media_probe', url)).resolves.toMatchObject({
        error: expect.stringMatching(/not configured/),
      });
    });

    it('media_extract_frames — frames and not-provisioned upload conform', async () => {
      worker(200, {
        success: true,
        count: 1,
        frames: [{ name: 'frame_001.jpg', base64: 'AAAA' }],
      });
      await expect(
        validateWire('media_extract_frames', url)
      ).resolves.toMatchObject({ count: 1 });
      worker(503, {
        error: 'FEATURE_NOT_PROVISIONED',
        message: 'bucket missing',
      });
      await expect(
        validateWire('media_extract_frames', {
          ...url,
          upload: { industry: 'restoration', subjectKey: 'mould' },
        })
      ).resolves.toEqual({ error: 'FEATURE_NOT_PROVISIONED' });
    });

    it('media_transcode — bytes conform', async () => {
      worker(200, { success: true, bytes: 3, base64: 'AAAA' });
      await expect(validateWire('media_transcode', url)).resolves.toEqual({
        success: true,
        bytes: 3,
        base64: 'AAAA',
      });
    });
  });

  it('a creative schema violation throws as the SDK would (control: planted failure is caught)', () => {
    // A get_job return that still carries a raw Date must be rejected.
    const schema = tool('get_job').outputSchema as z.ZodTypeAny;
    expect(schema).toBeDefined();
    expect(() =>
      schema.parse({
        job: {
          id: 'v1',
          status: 's',
          videoUrl: null,
          errorMessage: null,
          model: null,
          batchGroupId: null,
          estimatedCostUsd: null,
          actualCostUsd: null,
          createdAt: new Date(),
        },
      })
    ).toThrow(z.ZodError);
  });
});

describe('M11 ops_* outputs validate against outputSchema', () => {
  it('ops_get_platform_health — healthy and degraded', async () => {
    await executeAndValidate('ops_get_platform_health', {});
    mockCheckDatabaseHealth.mockResolvedValue({
      healthy: false,
      latency: 1,
      error: 'x',
    });
    mockCacheHealth.mockResolvedValue({ status: 'weird', connection: 'redis' });
    await expect(
      executeAndValidate('ops_get_platform_health', {})
    ).resolves.toMatchObject({ status: 'unhealthy' });
  });

  it('ops_get_org_spend_totals — populated, empty and not-provisioned sources', async () => {
    mockLedgerGroupBy.mockResolvedValue([
      {
        provider: 'openai',
        pipelineName: 'content',
        _sum: { costUsd: 0.3 },
        _count: { _all: 2 },
      },
    ]);
    mockMediaSpendGroupBy.mockResolvedValue([
      {
        mediaType: 'image',
        _sum: { deltaUsd: { toString: () => '0.04' } },
        _count: { _all: 1 },
      },
    ]);
    await executeAndValidate('ops_get_org_spend_totals', {});
    mockLedgerGroupBy.mockResolvedValue([]);
    mockMediaSpendGroupBy.mockRejectedValue(
      Object.assign(new Error('missing'), { code: 'P2021' })
    );
    await expect(
      executeAndValidate('ops_get_org_spend_totals', {})
    ).resolves.toMatchObject({
      totalUsd: 0,
      pipelineLedger: { available: true, runs: 0 },
      mediaSpend: { available: false },
    });
  });

  it('ops_list_cron_outcomes — not provisioned', async () => {
    await executeAndValidate('ops_list_cron_outcomes', {});
  });
});
