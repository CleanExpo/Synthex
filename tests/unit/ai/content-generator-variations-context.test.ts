/**
 * SYN-MCP-003 — defect-D regression + heuristic-rename contract for
 * AIContentGenerator (lib/ai/content-generator.ts).
 *
 * Defect D (vs 2bd24eb5, content-generator.ts:636-684): the A/B variations
 * path called callAI(prompt, model, client) with org/taskType UNDEFINED, so
 * buildLayeredPrompt never engaged and every variation silently degraded to
 * the generic "viral content expert" prompt while the main call carried the
 * 3-layer brand context.
 *
 * Contract now:
 *  1. generateVariations threads orgId + taskType into callAI (spy proof).
 *  2. With a seeded BrandOperatingSystem, the VARIATION calls' system prompts
 *     contain the layered brand prompt — not the generic default.
 *  3. requireGenerationContext guards the entry points at runtime.
 *  4. heuristicViralScore/heuristicEngagement are populated AND the legacy
 *     viralScore/estimatedEngagement aliases carry the same values (shims).
 *  5. The org-attributed cost-ledger write fires with clientId = ctx org.
 */

// jsdom does not provide crypto.randomUUID — patch before imports.
let _uuidCounter = 0;
if (
  typeof crypto === 'undefined' ||
  typeof (crypto as Crypto).randomUUID !== 'function'
) {
  Object.defineProperty(global, 'crypto', {
    value: {
      randomUUID: () =>
        `00000000-0000-4000-8000-${String(++_uuidCounter).padStart(12, '0')}`,
    },
    writable: true,
    configurable: true,
  });
}

// --- Mocks (resetMocks:true — implementations installed in beforeEach) ----
const mockPrisma = {
  persona: { findUnique: jest.fn() },
  trendInsight: { findMany: jest.fn() },
  contentTopicSuggestion: { findFirst: jest.fn(), update: jest.fn() },
  organization: { findUnique: jest.fn() },
  brandOperatingSystem: { findUnique: jest.fn() },
  clientProfile: { findUnique: jest.fn() },
  brandDNA: { findUnique: jest.fn() },
  modelMetric: { upsert: jest.fn() },
  pipelineCostLedger: { create: jest.fn() },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

jest.mock('@/lib/ai/providers', () => ({
  getAIProvider: jest.fn(),
}));

jest.mock('@/lib/obsidian/client-knowledge-base', () => ({
  buildContextForGeneration: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import {
  AIContentGenerator,
  type ContentRequest,
} from '@/lib/ai/content-generator';
import {
  GenerationContextError,
  type GenerationContext,
} from '@/lib/ai/generation-context';
import { DEFAULT_CORE_SYSTEM_PROMPT } from '@/lib/ai/prompt-layer-builder';
import type { AIProvider } from '@/lib/ai/providers';

const BRAND_CORE = 'You are the Acme Plumbing brand operating system.';

interface CapturedCall {
  system: string;
  user: string;
}

/** Fake provider capturing every call's system + user message. */
function makeCapturingClient(): { client: AIProvider; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  const client = {
    models: {
      fast: 'fast-model',
      balanced: 'balanced-model',
      creative: 'creative-model',
    },
    async complete(req: {
      messages: Array<{ role: string; content: string }>;
    }) {
      calls.push({
        system: req.messages.find(m => m.role === 'system')?.content ?? '',
        user: req.messages.find(m => m.role === 'user')?.content ?? '',
      });
      return { choices: [{ message: { content: 'generated! #ok' } }] };
    },
  } as unknown as AIProvider;
  return { client, calls };
}

function makeCtx(
  overrides: Partial<GenerationContext> = {}
): GenerationContext {
  return {
    organizationId: 'org-brand-1',
    userId: 'user-1',
    traceId: 'trace-brand-1',
    autonomyLevel: 'manual',
    ...overrides,
  };
}

function makeRequest(overrides: Partial<ContentRequest> = {}): ContentRequest {
  return {
    type: 'post',
    platform: 'instagram',
    topic: 'winter pipe maintenance',
    orgId: 'org-brand-1',
    ...overrides,
  };
}

let capturing: { client: AIProvider; calls: CapturedCall[] };

beforeEach(() => {
  capturing = makeCapturingClient();
  const { getAIProvider } = require('@/lib/ai/providers');
  (getAIProvider as jest.Mock).mockImplementation(() => capturing.client);
  const {
    buildContextForGeneration,
  } = require('@/lib/obsidian/client-knowledge-base');
  (buildContextForGeneration as jest.Mock).mockResolvedValue('');

  mockPrisma.persona.findUnique.mockResolvedValue(null);
  mockPrisma.trendInsight.findMany.mockResolvedValue([]);
  mockPrisma.contentTopicSuggestion.findFirst.mockResolvedValue(null);
  mockPrisma.organization.findUnique.mockResolvedValue({
    name: 'Acme Plumbing',
    industry: 'plumbing',
    aiGeneratedData: null,
  });
  // Seeded BrandOperatingSystem → buildLayeredPrompt ENGAGES.
  mockPrisma.brandOperatingSystem.findUnique.mockResolvedValue({
    method: 'brand-method',
    systemPromptOverride: BRAND_CORE,
    rules: [],
  });
  mockPrisma.clientProfile.findUnique.mockResolvedValue(null);
  mockPrisma.brandDNA.findUnique.mockResolvedValue(null);
  mockPrisma.modelMetric.upsert.mockResolvedValue({});
  mockPrisma.pipelineCostLedger.create.mockResolvedValue({ id: 'ledger-row' });
});

describe('defect-D regression — variations thread org/taskType into callAI', () => {
  it('generateVariations passes orgId + taskType to callAI (spy proof)', async () => {
    const gen = new AIContentGenerator();
    const spy = jest.spyOn(
      gen as unknown as { callAI: (...a: unknown[]) => Promise<string> },
      'callAI'
    );

    await gen.generateContent(makeRequest(), makeCtx());

    // Call 0 = main content; calls 1..2 = the two style variations.
    expect(spy.mock.calls.length).toBe(3);
    for (const call of spy.mock.calls.slice(1)) {
      // callAI(prompt, model, client, thinking, orgContext, orgId, taskType)
      expect(call[5]).toBe('org-brand-1'); // orgId — was undefined pre-fix
      expect(call[6]).toBe('post'); // taskType — was undefined pre-fix
    }
  });

  it('variation calls carry the LAYERED brand prompt, not the generic default', async () => {
    const gen = new AIContentGenerator();
    await gen.generateContent(makeRequest(), makeCtx());

    // main + 2 variations, all through the capturing client.
    expect(capturing.calls.length).toBe(3);
    const variationCalls = capturing.calls.filter(c =>
      c.user.includes('Rewrite this content')
    );
    expect(variationCalls.length).toBe(2);
    for (const call of variationCalls) {
      expect(call.system).toContain(BRAND_CORE);
      expect(call.system).not.toContain(DEFAULT_CORE_SYSTEM_PROMPT);
    }
  });

  it('adopts ctx.organizationId when the request carries no orgId', async () => {
    const gen = new AIContentGenerator();
    const spy = jest.spyOn(
      gen as unknown as { callAI: (...a: unknown[]) => Promise<string> },
      'callAI'
    );
    await gen.generateContent(
      makeRequest({ orgId: undefined }),
      makeCtx({ organizationId: 'org-from-ctx' })
    );
    for (const call of spy.mock.calls) {
      expect(call[5]).toBe('org-from-ctx');
    }
  });
});

describe('ctx runtime guard (requireGenerationContext)', () => {
  it('generateContent rejects without a GenerationContext', async () => {
    const gen = new AIContentGenerator();
    await expect(
      gen.generateContent(
        makeRequest(),
        undefined as unknown as GenerationContext
      )
    ).rejects.toThrow(GenerationContextError);
  });

  it('generateContent rejects a ctx without organizationId', async () => {
    const gen = new AIContentGenerator();
    await expect(
      gen.generateContent(makeRequest(), makeCtx({ organizationId: '' }))
    ).rejects.toThrow(GenerationContextError);
  });

  it('batchGenerate and generateContentCalendar reject without ctx', async () => {
    const gen = new AIContentGenerator();
    await expect(
      gen.batchGenerate(
        [makeRequest()],
        undefined as unknown as GenerationContext
      )
    ).rejects.toThrow(GenerationContextError);
    await expect(
      gen.generateContentCalendar(
        1,
        ['twitter'],
        1,
        undefined as unknown as GenerationContext
      )
    ).rejects.toThrow(GenerationContextError);
  });
});

describe('heuristic renames + deprecation shims (SYN-MCP-003)', () => {
  it('populates heuristic* fields AND keeps the legacy aliases equal', async () => {
    const gen = new AIContentGenerator();
    const result = await gen.generateContent(makeRequest(), makeCtx());

    expect(typeof result.heuristicViralScore).toBe('number');
    expect(typeof result.heuristicEngagement).toBe('number');
    expect(result.heuristicViralScore).toBeGreaterThanOrEqual(0);
    expect(result.heuristicViralScore).toBeLessThanOrEqual(100);

    // Deprecation shims: legacy consumers keep working, byte-for-byte.
    expect(result.viralScore).toBe(result.heuristicViralScore);
    expect(result.estimatedEngagement).toBe(result.heuristicEngagement);
  });
});

describe('org-attributed cost ledger write', () => {
  it('records a pipelineCostLedger row with clientId = ctx.organizationId', async () => {
    const gen = new AIContentGenerator();
    await gen.generateContent(makeRequest(), makeCtx());

    // Fire-and-forget — flush microtasks.
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockPrisma.pipelineCostLedger.create).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.pipelineCostLedger.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data).toMatchObject({
      pipelineName: 'content-generation',
      clientId: 'org-brand-1',
      runId: 'trace-brand-1',
    });
  });
});
