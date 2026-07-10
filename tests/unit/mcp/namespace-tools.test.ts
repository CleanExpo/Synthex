/**
 * SYN-MCP-007 (SYN-1084) + SYN-MCP-007b — new namespace tools: org isolation
 * on EVERY Prisma query AND on the BullMQ-backed tasks_* reads (org-pinning),
 * the v1 risk invariant (zero publish/spend riskClass, approvals_decide
 * machine-enforced ABSENT), and defence-in-depth scope enforcement in
 * executeStudioTool.
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

// SYN-MCP-007b: queue + Linear + retriever registry boundaries. Plain arrow
// wrappers (NOT jest.fn factories) — resetMocks would strip factory
// implementations; the inner jest.fn()s are re-primed in beforeEach.
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

const mockBuildLayeredPrompt = jest.fn();
jest.mock('@/lib/ai/prompt-layer-builder', () => ({
  buildLayeredPrompt: (...a: unknown[]) => mockBuildLayeredPrompt(...a),
}));

import {
  ALL_MCP_TOOLS,
  executeStudioTool,
} from '@/lib/services/ai/studio-tools';

const ctx = {
  userId: 'u1',
  organizationId: 'org1',
  initiatedBy: 'mcp' as const,
};

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
  mockBuildLayeredPrompt.mockResolvedValue({
    systemPrompt: null,
    core: null,
    client: null,
    clientSource: null,
    task: 'video-script',
  });
});

describe('v1 registry invariant (machine-enforced absence)', () => {
  it('registers ZERO publish or spend riskClass tools anywhere', () => {
    for (const t of ALL_MCP_TOOLS) {
      expect(['read', 'draft']).toContain(t.riskClass);
    }
  });

  it('approvals_decide is DELIBERATELY ABSENT — deciding stays human', () => {
    expect(ALL_MCP_TOOLS.map(t => t.name)).not.toContain('approvals_decide');
  });

  it('no *_publish / *_spend / publish_* tool names exist under any scope', () => {
    for (const t of ALL_MCP_TOOLS) {
      expect(t.name).not.toMatch(/_publish$|_spend$|^publish/);
    }
  });

  it('every tool carries the full 4-plane badge (scope/riskClass/costClass)', () => {
    for (const t of ALL_MCP_TOOLS) {
      expect([
        'creative',
        'approvals',
        'context',
        'performance',
        'tasks',
        'research',
      ]).toContain(t.scope);
      expect(['free', 'metered', 'expensive']).toContain(t.costClass);
      expect(t.description.length).toBeGreaterThan(10);
    }
  });

  it('every NEW namespace tool declares a z.object outputSchema; input schemas are z.object for all (route derives .shape)', () => {
    for (const t of ALL_MCP_TOOLS) {
      // route.ts does (schema as z.ZodObject).shape — must hold for all tools
      expect(
        (t.schema as { shape?: Record<string, unknown> }).shape
      ).toBeDefined();
      if (t.scope !== 'creative') {
        expect(t.outputSchema).toBeDefined();
        expect(
          (t.outputSchema as { shape?: Record<string, unknown> }).shape
        ).toBeDefined();
      }
    }
  });

  it('SYN-MCP-007b: tasks_* and research_* exist with the pinned risk/cost planes', () => {
    const byName = new Map(ALL_MCP_TOOLS.map(t => [t.name, t]));
    // tasks_* — reads are read/free, enqueue is draft/free (never spend/publish)
    expect(byName.get('tasks_list')).toMatchObject({
      scope: 'tasks',
      riskClass: 'read',
      costClass: 'free',
    });
    expect(byName.get('tasks_get')).toMatchObject({
      scope: 'tasks',
      riskClass: 'read',
      costClass: 'free',
    });
    expect(byName.get('tasks_enqueue')).toMatchObject({
      scope: 'tasks',
      riskClass: 'draft',
      costClass: 'free',
    });
    // research_* — retrieval is metered, the bundle read is free; all read
    expect(byName.get('research_search')).toMatchObject({
      scope: 'research',
      riskClass: 'read',
      costClass: 'metered',
    });
    expect(byName.get('research_fetch')).toMatchObject({
      scope: 'research',
      riskClass: 'read',
      costClass: 'metered',
    });
    expect(byName.get('research_get_evidence_bundle')).toMatchObject({
      scope: 'research',
      riskClass: 'read',
      costClass: 'free',
    });
  });

  it('no tool mutates claims/evidence state and verify-claim enqueue is NOT exposed', () => {
    const names = ALL_MCP_TOOLS.map(t => t.name);
    expect(names).not.toContain('research_verify_claim');
    expect(names).not.toContain('research_enqueue_verify');
    for (const n of names) {
      expect(n).not.toMatch(/verify[-_]?claim/i);
    }
  });
});

describe('org isolation — every new tool scopes its queries to ctx.organizationId', () => {
  it('approvals_list_pending filters organizationId + approvalStatus=pending', async () => {
    await executeStudioTool('approvals_list_pending', {}, ctx);
    expect(mockClaimFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org1',
          approvalStatus: 'pending',
        }),
      })
    );
  });

  it('approvals_get filters id + organizationId (wrong-org id → claim: null)', async () => {
    const out = await executeStudioTool('approvals_get', { id: 'c1' }, ctx);
    expect(mockClaimFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'c1', organizationId: 'org1' }),
      })
    );
    expect(out).toEqual({ claim: null });
  });

  it('context_get_brand scopes BrandDNA and BrandOperatingSystem lookups to the org', async () => {
    await executeStudioTool('context_get_brand', {}, ctx);
    expect(mockBrandDnaFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org1' } })
    );
    expect(mockBosFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org1' } })
    );
  });

  it('context_get_client_profile scopes the ClientProfile lookup to the org', async () => {
    await executeStudioTool('context_get_client_profile', {}, ctx);
    expect(mockProfileFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org1' } })
    );
  });

  it('context_preview_layered_prompt passes ONLY the caller org to buildLayeredPrompt', async () => {
    await executeStudioTool(
      'context_preview_layered_prompt',
      { taskType: 'video-script' },
      ctx
    );
    expect(mockBuildLayeredPrompt).toHaveBeenCalledWith('org1', 'video-script');
  });

  it('performance_get_outcomes filters organizationId', async () => {
    await executeStudioTool(
      'performance_get_outcomes',
      { eventType: 'conversion' },
      ctx
    );
    expect(mockOutcomeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org1',
          eventType: 'conversion',
        }),
      })
    );
  });

  it('performance_cost_report puts the org filter IN the ledger query (clientId equality — excludes board-level null rows)', async () => {
    await executeStudioTool('performance_cost_report', {}, ctx);
    expect(mockLedgerFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          clientId: 'org1',
          createdAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      })
    );
  });

  it('performance_get_scores is a pure function — touches no org data', async () => {
    await executeStudioTool(
      'performance_get_scores',
      { content: 'Here is a post about our new product launch.' },
      ctx
    );
    expect(mockClaimFindMany).not.toHaveBeenCalled();
    expect(mockOutcomeFindMany).not.toHaveBeenCalled();
    expect(mockLedgerFindMany).not.toHaveBeenCalled();
  });

  it('research_get_evidence_bundle scopes claim AND score-row reads to the org; wrong-org claim → bundle null', async () => {
    const out = await executeStudioTool(
      'research_get_evidence_bundle',
      { claimId: 'c-other-org' },
      ctx
    );
    expect(mockClaimFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'c-other-org',
          organizationId: 'org1',
        }),
      })
    );
    // Claim not found in org → score rows are never read (no error oracle).
    expect(mockScoreFindMany).not.toHaveBeenCalled();
    expect(out).toMatchObject({ bundle: null, persistedEvidenceStatus: null });

    mockClaimFindFirst.mockResolvedValue({
      id: 'c1',
      claimType: 'factual',
      evidenceStatus: 'blocked',
    });
    await executeStudioTool(
      'research_get_evidence_bundle',
      { claimId: 'c1' },
      ctx
    );
    expect(mockScoreFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          claimId: 'c1',
          organizationId: 'org1',
        }),
      })
    );
  });
});

describe('SYN-MCP-007b tasks_* — org-pinning over BullMQ job records', () => {
  const jobFor = (
    org: string | undefined,
    id = 'linear:i1:aaaaaaaaaaaaaaaa'
  ) => ({
    id,
    data: {
      type: 'autonomous:execute-task',
      issueId: 'i1',
      identifier: 'SYN-1',
      title: 'T',
      description: null,
      ...(org ? { organizationId: org } : {}),
    },
    timestamp: 1751500000000,
    processedOn: undefined,
    finishedOn: undefined,
    attemptsMade: 0,
    failedReason: undefined,
    returnvalue: undefined,
    getState: jest.fn().mockResolvedValue('waiting'),
  });

  it('tasks_list returns ONLY jobs stamped with the caller org — org-less webhook/shell jobs are invisible', async () => {
    mockGetJobs.mockResolvedValue([
      jobFor('org1', 'linear:i1:aaaaaaaaaaaaaaaa'),
      jobFor('org2', 'linear:i2:bbbbbbbbbbbbbbbb'),
      jobFor(undefined, 'linear:i3:cccccccccccccccc'), // webhook-produced
    ]);
    const out = (await executeStudioTool(
      'tasks_list',
      { state: 'queued' },
      ctx
    )) as {
      tasks: Array<{ jobId: string }>;
      total: number;
      error: string | null;
    };
    expect(out.error).toBeNull();
    expect(out.total).toBe(1);
    expect(out.tasks.map(t => t.jobId)).toEqual(['linear:i1:aaaaaaaaaaaaaaaa']);
  });

  it('tasks_list scans are bounded (≤100 per state)', async () => {
    mockGetJobs.mockResolvedValue([]);
    await executeStudioTool('tasks_list', { state: 'queued' }, ctx);
    expect(mockGetJobs).toHaveBeenCalledWith(expect.any(Array), 0, 99);
  });

  it('tasks_list degrades to an explicit error payload when Redis is unreachable (never throws)', async () => {
    mockGetJobs.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:6379'));
    const out = await executeStudioTool('tasks_list', {}, ctx);
    expect(out).toMatchObject({ tasks: [], total: 0 });
    expect((out as { error: string }).error).toMatch(/unavailable/i);
  });

  it('tasks_get: wrong-org job → task null (no error oracle); org-less job → task null', async () => {
    mockGetJob.mockResolvedValue(jobFor('org2'));
    await expect(
      executeStudioTool(
        'tasks_get',
        { jobId: 'linear:i1:aaaaaaaaaaaaaaaa' },
        ctx
      )
    ).resolves.toEqual({ task: null, error: null });

    mockGetJob.mockResolvedValue(jobFor(undefined));
    await expect(
      executeStudioTool(
        'tasks_get',
        { jobId: 'linear:i1:aaaaaaaaaaaaaaaa' },
        ctx
      )
    ).resolves.toEqual({ task: null, error: null });
  });

  it('tasks_get returns the org-pinned record with ISO timestamps', async () => {
    mockGetJob.mockResolvedValue(jobFor('org1'));
    const out = (await executeStudioTool(
      'tasks_get',
      { jobId: 'linear:i1:aaaaaaaaaaaaaaaa' },
      ctx
    )) as { task: { state: string; enqueuedAt: string } };
    expect(out.task).toMatchObject({
      state: 'queued',
      identifier: 'SYN-1',
      enqueuedAt: new Date(1751500000000).toISOString(),
    });
  });
});

describe('SYN-MCP-007b tasks_enqueue — Linear-gated, deduped, lifecycle-preserving', () => {
  const linearIssueFixture = (over: Record<string, unknown> = {}) => ({
    id: 'issue-uuid-1',
    identifier: 'SYN-9001',
    title: 'Fix the widget',
    description: 'Body\n- [ ] criterion one',
    labels: jest
      .fn()
      .mockResolvedValue({ nodes: [{ id: 'l1', name: 'autonomous' }] }),
    state: Promise.resolve({ id: 's1', name: 'Todo', type: 'unstarted' }),
    ...over,
  });

  it('fetches issue content server-side and enqueues with the deterministic jobId + org pin + mcp envelope', async () => {
    mockLinearIssue.mockResolvedValue(linearIssueFixture());
    const out = await executeStudioTool(
      'tasks_enqueue',
      { issueId: 'SYN-9001' },
      ctx
    );
    expect(out).toMatchObject({
      enqueued: true,
      deduped: false,
      identifier: 'SYN-9001',
    });
    expect(mockAddJob).toHaveBeenCalledWith(
      'autonomous-tasks',
      expect.objectContaining({
        type: 'autonomous:execute-task',
        issueId: 'issue-uuid-1',
        title: 'Fix the widget',
        organizationId: 'org1',
        envelope: expect.objectContaining({
          source: 'mcp',
          organizationId: 'org1',
          acceptance: ['criterion one'],
        }),
      }),
      { jobId: expect.stringMatching(/^linear:issue-uuid-1:[0-9a-f]{16}$/) }
    );
  });

  it('dedupes via the deterministic jobId: an existing job record → deduped, addJob NOT called', async () => {
    mockLinearIssue.mockResolvedValue(linearIssueFixture());
    mockGetJob.mockResolvedValue({
      id: 'existing',
      data: { envelope: undefined },
    });
    const out = await executeStudioTool(
      'tasks_enqueue',
      { issueId: 'SYN-9001' },
      ctx
    );
    expect(out).toMatchObject({ enqueued: false, deduped: true });
    expect(mockAddJob).not.toHaveBeenCalled();
  });

  it('refuses issues without an autonomous label (same gate as the webhook producer)', async () => {
    mockLinearIssue.mockResolvedValue(
      linearIssueFixture({
        labels: jest
          .fn()
          .mockResolvedValue({ nodes: [{ id: 'l1', name: 'bug' }] }),
      })
    );
    const out = await executeStudioTool(
      'tasks_enqueue',
      { issueId: 'SYN-9001' },
      ctx
    );
    expect(out).toMatchObject({ enqueued: false, deduped: false });
    expect((out as { reason: string }).reason).toMatch(/autonomous label/i);
    expect(mockAddJob).not.toHaveBeenCalled();
  });

  it('refuses issues in ineligible states (completed/canceled never re-queued)', async () => {
    mockLinearIssue.mockResolvedValue(
      linearIssueFixture({
        state: Promise.resolve({ id: 's2', name: 'Done', type: 'completed' }),
      })
    );
    const out = await executeStudioTool(
      'tasks_enqueue',
      { issueId: 'SYN-9001' },
      ctx
    );
    expect(out).toMatchObject({ enqueued: false });
    expect((out as { reason: string }).reason).toMatch(/not eligible/i);
    expect(mockAddJob).not.toHaveBeenCalled();
  });

  it('degrades to an explicit error payload when Linear is unreachable (never throws)', async () => {
    mockLinearIssue.mockRejectedValue(new Error('LINEAR_API_KEY is not set'));
    const out = await executeStudioTool(
      'tasks_enqueue',
      { issueId: 'SYN-9001' },
      ctx
    );
    expect(out).toMatchObject({ enqueued: false, jobId: null });
    expect((out as { reason: string }).reason).toMatch(/linear unavailable/i);
  });
});

describe('SYN-MCP-007b research_* — retriever availability + zero persistence', () => {
  const makeRetriever = (
    id: string,
    caps: { canSearch: boolean; canFetch: boolean },
    impl: Partial<{ search: jest.Mock; fetch: jest.Mock }> = {}
  ) => ({
    id,
    capabilities: caps,
    available: () => true,
    search: impl.search ?? jest.fn().mockResolvedValue([]),
    fetch: impl.fetch ?? jest.fn().mockResolvedValue(null),
  });

  it('research_search with ZERO providers configured → honest empty result', async () => {
    mockGetAvailableRetrievers.mockReturnValue([]);
    const out = await executeStudioTool(
      'research_search',
      { query: 'acme drying time' },
      ctx
    );
    expect(out).toMatchObject({
      sources: [],
      retrieversAvailable: [],
      retrieversUsed: [],
      errors: [],
    });
  });

  it('research_search only invokes canSearch retrievers and dedupes by URL', async () => {
    const evidence = (url: string, provider: string) => ({
      url,
      title: 't',
      publishedAt: null,
      retrievedAt: '2026-07-10T00:00:00.000Z',
      provider,
      contentHash: 'h',
      excerpt: 'e',
      domain: 'example.com',
    });
    const searcher = makeRetriever(
      'firecrawl',
      { canSearch: true, canFetch: true },
      {
        search: jest
          .fn()
          .mockResolvedValue([
            evidence('https://example.com/a', 'firecrawl'),
            evidence('https://example.com/b', 'firecrawl'),
          ]),
      }
    );
    const fetchOnly = makeRetriever('apify', {
      canSearch: false,
      canFetch: true,
    });
    const searcher2 = makeRetriever(
      'exa',
      { canSearch: true, canFetch: true },
      {
        search: jest
          .fn()
          .mockResolvedValue([evidence('https://example.com/a', 'exa')]),
      }
    );
    mockGetAvailableRetrievers.mockReturnValue([
      searcher,
      fetchOnly,
      searcher2,
    ]);
    const out = (await executeStudioTool(
      'research_search',
      { query: 'acme drying time' },
      ctx
    )) as { sources: Array<{ url: string }>; retrieversUsed: string[] };
    expect(fetchOnly.search).not.toHaveBeenCalled();
    expect(out.sources.map(s => s.url)).toEqual([
      'https://example.com/a',
      'https://example.com/b',
    ]);
    expect(out.retrieversUsed).toEqual(['firecrawl', 'exa']);
    // Zero persistence: no Prisma writes exist on this path at all.
    expect(mockClaimFindMany).not.toHaveBeenCalled();
    expect(mockScoreFindMany).not.toHaveBeenCalled();
  });

  it('research_fetch with no fetch-capable provider → source null with an honest error', async () => {
    mockGetAvailableRetrievers.mockReturnValue([]);
    const out = await executeStudioTool(
      'research_fetch',
      { url: 'https://example.com/page' },
      ctx
    );
    expect(out).toMatchObject({
      source: null,
      provider: null,
      error: 'no retrieval providers configured',
    });
  });

  it('research_fetch surfaces an adapter rejection (e.g. SSRF guard) as the error field, never a throw', async () => {
    const fetcher = makeRetriever(
      'firecrawl',
      { canSearch: true, canFetch: true },
      {
        fetch: jest
          .fn()
          .mockRejectedValue(new Error('URL host is not allowed')),
      }
    );
    mockGetAvailableRetrievers.mockReturnValue([fetcher]);
    const out = await executeStudioTool(
      'research_fetch',
      { url: 'https://169.254.169.254.example.com/meta' },
      ctx
    );
    expect(out).toMatchObject({ source: null, provider: 'firecrawl' });
    expect((out as { error: string }).error).toMatch(/not allowed/i);
  });
});

describe('defence-in-depth scope enforcement at execution', () => {
  it('an MCP caller cannot execute a tool outside its scopes even if registration filtering were bypassed', async () => {
    await expect(
      executeStudioTool(
        'approvals_get',
        { id: 'c1' },
        { ...ctx, scopes: ['creative'] }
      )
    ).rejects.toThrow(/not permitted/i);
    expect(mockClaimFindFirst).not.toHaveBeenCalled();
  });

  it('wildcard scopes may execute any registered tool', async () => {
    await expect(
      executeStudioTool(
        'approvals_get',
        { id: 'c1' },
        { ...ctx, scopes: ['*'] }
      )
    ).resolves.toEqual({ claim: null });
  });

  it('non-MCP callers (no scopes field) are unaffected — legacy REST/copilot parity', async () => {
    await expect(
      executeStudioTool('approvals_list_pending', {}, ctx)
    ).resolves.toEqual({ claims: [], total: 0 });
  });
});
