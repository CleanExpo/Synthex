/**
 * SYN-MCP-003 — GenerationContext unit contract (lib/ai/generation-context.ts).
 *
 * Covers:
 *  - requireGenerationContext runtime guard (throws on missing ctx / orgId)
 *  - systemGenerationContext factory defaults + overrides
 *  - budget preflight (estimate + enforceBudgetPreflight → 402-mapped error)
 *  - tenant-scoped idempotency (acquire / pending / replay / release;
 *    different user with the same key is NEVER deduped together)
 *  - recordGenerationCost → prisma.pipelineCostLedger with org attribution,
 *    system sentinel → clientId null, and never-throws on ledger failure
 */

const mockLedgerCreate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    pipelineCostLedger: { create: (...a: unknown[]) => mockLedgerCreate(...a) },
  },
  prisma: {
    pipelineCostLedger: { create: (...a: unknown[]) => mockLedgerCreate(...a) },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import {
  acquireIdempotencyKey,
  enforceBudgetPreflight,
  estimateContentGenerationCostUsd,
  GenerationBudgetExceededError,
  GenerationContextError,
  isSystemOrganization,
  recordGenerationCost,
  releaseIdempotencyKey,
  requireGenerationContext,
  storeIdempotentResponse,
  SYSTEM_ORGANIZATION_ID,
  systemGenerationContext,
  type GenerationContext,
} from '@/lib/ai/generation-context';
import { resetRedisClient } from '@/lib/redis-client';

function makeCtx(
  overrides: Partial<GenerationContext> = {}
): GenerationContext {
  return {
    organizationId: 'org-1',
    userId: 'user-1',
    traceId: 'trace-1',
    autonomyLevel: 'manual',
    ...overrides,
  };
}

afterAll(async () => {
  await resetRedisClient();
});

describe('requireGenerationContext', () => {
  it('throws GenerationContextError when ctx is missing', () => {
    expect(() => requireGenerationContext(undefined, 'testSource')).toThrow(
      GenerationContextError
    );
    expect(() => requireGenerationContext(null, 'testSource')).toThrow(
      /testSource/
    );
  });

  it('throws when organizationId is absent/empty', () => {
    expect(() =>
      requireGenerationContext(makeCtx({ organizationId: '' }), 'testSource')
    ).toThrow(GenerationContextError);
  });

  it('returns the ctx when valid (including the system sentinel)', () => {
    const ctx = makeCtx();
    expect(requireGenerationContext(ctx, 't')).toBe(ctx);
    const sys = systemGenerationContext();
    expect(requireGenerationContext(sys, 't')).toBe(sys);
  });
});

describe('systemGenerationContext', () => {
  it('defaults to the system sentinel org + system user + a traceId', () => {
    const ctx = systemGenerationContext();
    expect(ctx.organizationId).toBe(SYSTEM_ORGANIZATION_ID);
    expect(isSystemOrganization(ctx.organizationId)).toBe(true);
    expect(ctx.userId).toBe('system');
    expect(ctx.autonomyLevel).toBe('system');
    expect(typeof ctx.traceId).toBe('string');
    expect(ctx.traceId.length).toBeGreaterThan(0);
  });

  it('accepts a real org + overrides', () => {
    const ctx = systemGenerationContext('org-77', {
      userId: 'user-9',
      traceId: 'job-1',
      taskId: 'job-1',
    });
    expect(ctx.organizationId).toBe('org-77');
    expect(isSystemOrganization(ctx.organizationId)).toBe(false);
    expect(ctx.userId).toBe('user-9');
    expect(ctx.traceId).toBe('job-1');
  });
});

describe('budget preflight', () => {
  it('estimates article requests as more expensive than posts, both > 0', () => {
    const post = estimateContentGenerationCostUsd({ type: 'post' });
    const article = estimateContentGenerationCostUsd({ type: 'article' });
    expect(post).toBeGreaterThan(0);
    expect(article).toBeGreaterThan(post);
  });

  it('is a no-op when no maxCostUsd was supplied', () => {
    expect(() => enforceBudgetPreflight(undefined, 999)).not.toThrow();
  });

  it('passes when the estimate is within budget', () => {
    expect(() => enforceBudgetPreflight(1.0, 0.05)).not.toThrow();
  });

  it('throws GenerationBudgetExceededError (pre-spend) when over budget', () => {
    try {
      enforceBudgetPreflight(0.001, 0.06);
      throw new Error('expected GenerationBudgetExceededError');
    } catch (err) {
      expect(err).toBeInstanceOf(GenerationBudgetExceededError);
      const budgetErr = err as GenerationBudgetExceededError;
      expect(budgetErr.estimatedCostUsd).toBe(0.06);
      expect(budgetErr.maxCostUsd).toBe(0.001);
      expect(budgetErr.message).toMatch(/remaining request budget/);
    }
  });
});

describe('idempotency (tenant-scoped, Redis memory fallback)', () => {
  it('first acquire wins; an in-flight duplicate reports pending', async () => {
    const first = await acquireIdempotencyKey('t-scope', 'user-a', 'key-0001');
    expect(first.state).toBe('acquired');

    const dup = await acquireIdempotencyKey('t-scope', 'user-a', 'key-0001');
    expect(dup.state).toBe('pending');
  });

  it('replays the stored payload after completion', async () => {
    const acq = await acquireIdempotencyKey('t-scope', 'user-b', 'key-0002');
    expect(acq.state).toBe('acquired');

    const envelope = JSON.stringify({ success: true, data: { id: 'gen-1' } });
    await storeIdempotentResponse('t-scope', 'user-b', 'key-0002', envelope);

    const replay = await acquireIdempotencyKey('t-scope', 'user-b', 'key-0002');
    expect(replay.state).toBe('replayed');
    if (replay.state === 'replayed') {
      expect(JSON.parse(replay.payload)).toEqual({
        success: true,
        data: { id: 'gen-1' },
      });
    }
  });

  it('NEVER dedupes across users — same key, different user acquires fresh', async () => {
    const a = await acquireIdempotencyKey('t-scope', 'user-c', 'shared-key-1');
    expect(a.state).toBe('acquired');
    await storeIdempotentResponse(
      't-scope',
      'user-c',
      'shared-key-1',
      JSON.stringify({ secret: 'user-c-data' })
    );

    // user-d re-using user-c's key must NOT see user-c's cached response.
    const b = await acquireIdempotencyKey('t-scope', 'user-d', 'shared-key-1');
    expect(b.state).toBe('acquired');
  });

  it('release makes the key re-acquirable (failed-generation retry path)', async () => {
    const acq = await acquireIdempotencyKey('t-scope', 'user-e', 'key-0003');
    expect(acq.state).toBe('acquired');

    await releaseIdempotencyKey('t-scope', 'user-e', 'key-0003');

    const retry = await acquireIdempotencyKey('t-scope', 'user-e', 'key-0003');
    expect(retry.state).toBe('acquired');
  });
});

describe('recordGenerationCost (org-attributed ledger)', () => {
  beforeEach(() => {
    mockLedgerCreate.mockResolvedValue({ id: 'row-1' });
  });

  it('writes a PipelineCostLedger row with clientId = ctx.organizationId', async () => {
    await recordGenerationCost(makeCtx({ organizationId: 'org-42' }), {
      pipelineName: 'content-generation',
      model: 'claude-sonnet-4-6',
      inputTokens: 1000,
      outputTokens: 2000,
    });

    expect(mockLedgerCreate).toHaveBeenCalledTimes(1);
    const arg = mockLedgerCreate.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data).toMatchObject({
      pipelineName: 'content-generation',
      clientId: 'org-42',
      runId: 'trace-1',
      model: 'claude-sonnet-4-6',
      inputTokens: 1000,
      outputTokens: 2000,
    });
    // (1000/1M)*3 + (2000/1M)*15 = 0.033 (MODEL_RATES sonnet pricing)
    expect(arg.data.costUsd).toBeCloseTo(0.033, 6);
  });

  it('maps the system sentinel to clientId null (board-level convention)', async () => {
    await recordGenerationCost(systemGenerationContext(), {
      pipelineName: 'content-generation',
      model: 'claude-sonnet-4-6',
      inputTokens: 10,
      outputTokens: 10,
    });
    const arg = mockLedgerCreate.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data.clientId).toBeNull();
  });

  it('never throws when the ledger write fails', async () => {
    mockLedgerCreate.mockRejectedValue(new Error('db down'));
    await expect(
      recordGenerationCost(makeCtx(), {
        pipelineName: 'content-generation',
        model: 'claude-sonnet-4-6',
        inputTokens: 1,
        outputTokens: 1,
      })
    ).resolves.toBeUndefined();
  });
});
