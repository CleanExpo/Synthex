/**
 * SYN-MCP-007 (SYN-1084) — new namespace tools: org isolation on EVERY
 * Prisma query, the v1 risk invariant (zero publish/spend riskClass,
 * approvals_decide machine-enforced ABSENT), and defence-in-depth scope
 * enforcement in executeStudioTool.
 */

// --- mock the heavy transitive imports of the studio-tools registry ---
jest.mock('@/lib/services/ai/video/generation-service', () => ({
  submitGenerativeVideo: jest.fn(),
}));

const mockClaimFindMany = jest.fn();
const mockClaimFindFirst = jest.fn();
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
  mockBrandDnaFindUnique.mockResolvedValue(null);
  mockBosFindUnique.mockResolvedValue(null);
  mockProfileFindUnique.mockResolvedValue(null);
  mockOrgFindUnique.mockResolvedValue(null);
  mockOutcomeFindMany.mockResolvedValue([]);
  mockLedgerFindMany.mockResolvedValue([]);
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
      expect(['creative', 'approvals', 'context', 'performance']).toContain(
        t.scope
      );
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

  it('tasks_* is deferred (007b) and research_* not yet wired — neither exists', () => {
    for (const t of ALL_MCP_TOOLS) {
      expect(t.name).not.toMatch(/^tasks_|^research_/);
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
