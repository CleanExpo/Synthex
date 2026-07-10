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
  mockBrandDnaFindUnique.mockResolvedValue(null);
  mockBosFindUnique.mockResolvedValue(null);
  mockProfileFindUnique.mockResolvedValue(null);
  mockOrgFindUnique.mockResolvedValue(null);
  mockOutcomeFindMany.mockResolvedValue([]);
  mockLedgerFindMany.mockResolvedValue([]);
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
