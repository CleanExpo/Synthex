/**
 * SYN-MCP-003 — GenerationContext sandbox integration (Docker sandbox,
 * SYN-MCP-000 profile: Postgres :5499 + Redis :6399, LLM provider MOCKED —
 * never live keys).
 *
 * Proves against a REAL database:
 *  - AC1: with the seeded BrandOperatingSystem (itest-bos, method
 *    'itest-method'), the layered brand prompt engages on the VARIATIONS
 *    path too (defect-D regression, real prompt-layer-builder + real rows).
 *  - AC4: a generation writes a pipeline_cost_ledger row with
 *    clientId = ctx.organizationId (org attribution, real Prisma).
 *
 * Run: npm run sandbox:up && npm run test:integration
 */

// The app's lib/prisma singleton is Supabase-tuned (forces SSL) and rejects
// the local sandbox Postgres — swap it for the sandbox client so the REAL
// content-generator + prompt-layer-builder code paths hit the sandbox DB.
jest.mock('@/lib/prisma', () => {
  const { createSandboxPrismaClient } = require('./setup/seed');
  const { prisma } = createSandboxPrismaClient();
  return { __esModule: true, default: prisma, prisma };
});

// LLM calls are mocked in every sandbox test (live keys are L3 human-gated).
jest.mock('@/lib/ai/providers', () => ({
  getAIProvider: jest.fn(),
}));

jest.mock('@/lib/obsidian/client-knowledge-base', () => ({
  buildContextForGeneration: jest.fn().mockResolvedValue(''),
}));

import prisma from '@/lib/prisma';
import { getAIProvider, type AIProvider } from '@/lib/ai/providers';
import { AIContentGenerator } from '@/lib/ai/content-generator';
import {
  DEFAULT_CORE_SYSTEM_PROMPT,
  buildLayeredPrompt,
} from '@/lib/ai/prompt-layer-builder';
import type { GenerationContext } from '@/lib/ai/generation-context';
import { assertSandboxDatabaseUrl } from './setup/sandbox-guard';

// Belt-and-braces: hard-fail off-sandbox even though global-setup guards too.
assertSandboxDatabaseUrl(process.env.DATABASE_URL);

interface CapturedCall {
  system: string;
  user: string;
}

function makeCapturingClient(): { client: AIProvider; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  const client = {
    models: {
      fast: 'itest-fast',
      balanced: 'itest-balanced',
      creative: 'itest-creative',
    },
    async complete(req: {
      messages: Array<{ role: string; content: string }>;
    }) {
      calls.push({
        system: req.messages.find(m => m.role === 'system')?.content ?? '',
        user: req.messages.find(m => m.role === 'user')?.content ?? '',
      });
      return { choices: [{ message: { content: 'sandbox content #itest' } }] };
    },
  } as unknown as AIProvider;
  return { client, calls };
}

const TRACE_ID = `itest-trace-${Date.now()}`;

const CTX: GenerationContext = {
  organizationId: 'itest-org',
  userId: 'itest-user',
  traceId: TRACE_ID,
  autonomyLevel: 'manual',
};

describe('SYN-MCP-003 — GenerationContext against the sandbox', () => {
  let capturing: ReturnType<typeof makeCapturingClient>;

  beforeEach(() => {
    capturing = makeCapturingClient();
    (getAIProvider as jest.Mock).mockImplementation(() => capturing.client);
  });

  afterAll(async () => {
    await prisma.pipelineCostLedger.deleteMany({
      where: { runId: { startsWith: 'itest-trace-' } },
    });
    await prisma.$disconnect();
  });

  it('buildLayeredPrompt engages for the seeded org (sanity)', async () => {
    const layered = await buildLayeredPrompt('itest-org', 'post');
    expect(layered.systemPrompt).not.toBeNull();
    expect(layered.systemPrompt).toContain('itest-method');
  });

  it('AC1: the variations path carries the layered brand prompt (defect-D, real DB)', async () => {
    const gen = new AIContentGenerator();
    const result = await gen.generateContent(
      {
        type: 'post',
        platform: 'instagram',
        topic: 'sandbox topic',
        orgId: 'itest-org',
      },
      CTX
    );

    expect(result.content).toBe('sandbox content #itest');

    // main + 2 variations — ALL must carry the seeded brand layer.
    expect(capturing.calls.length).toBe(3);
    const variationCalls = capturing.calls.filter(c =>
      c.user.includes('Rewrite this content')
    );
    expect(variationCalls.length).toBe(2);
    for (const call of variationCalls) {
      expect(call.system).toContain('itest-method');
    }
    // And the main call too (parity — no regression on the main path).
    expect(capturing.calls[0].system).toContain('itest-method');

    // Heuristic renames + shims present end-to-end.
    expect(result.heuristicViralScore).toBe(result.viralScore);
    expect(result.heuristicEngagement).toBe(result.estimatedEngagement);
  });

  it('AC4: generation writes a pipeline_cost_ledger row with clientId = ctx.organizationId', async () => {
    const gen = new AIContentGenerator();
    await gen.generateContent(
      {
        type: 'post',
        platform: 'twitter',
        topic: 'ledger topic',
        orgId: 'itest-org',
      },
      CTX
    );

    // The ledger write is fire-and-forget — poll briefly.
    let rows: Array<{
      clientId: string | null;
      pipelineName: string;
      runId: string;
      costUsd: number;
    }> = [];
    for (let attempt = 0; attempt < 20; attempt++) {
      rows = await prisma.pipelineCostLedger.findMany({
        where: { runId: TRACE_ID },
      });
      if (rows.length > 0) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.clientId).toBe('itest-org');
      expect(row.pipelineName).toBe('content-generation');
      expect(row.runId).toBe(TRACE_ID);
      expect(row.costUsd).toBeGreaterThanOrEqual(0);
    }
  });

  it('system-sentinel contexts write clientId = null (board-level convention)', async () => {
    const { systemGenerationContext, recordGenerationCost } =
      await import('@/lib/ai/generation-context');
    const sysCtx = systemGenerationContext(undefined, {
      traceId: `itest-trace-sys-${Date.now()}`,
    });
    await recordGenerationCost(sysCtx, {
      pipelineName: 'content-generation',
      model: 'claude-sonnet-4-6',
      inputTokens: 10,
      outputTokens: 10,
    });

    const rows = await prisma.pipelineCostLedger.findMany({
      where: { runId: sysCtx.traceId },
    });
    expect(rows.length).toBe(1);
    expect(rows[0].clientId).toBeNull();
  });
});

// Silence the unused-import lint for DEFAULT_CORE_SYSTEM_PROMPT if the brand
// assertion evolves; keeping the negative check explicit:
describe('layered prompt is NOT the generic default for the seeded org', () => {
  it('differs from DEFAULT_CORE_SYSTEM_PROMPT alone', async () => {
    const layered = await buildLayeredPrompt('itest-org', 'post');
    expect(layered.systemPrompt).not.toBe(DEFAULT_CORE_SYSTEM_PROMPT);
  });
});
