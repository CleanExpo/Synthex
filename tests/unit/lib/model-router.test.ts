/**
 * ModelRouter unit tests — SYN-652
 *
 * Verifies routing decisions, quality-floor enforcement, fallback escalation,
 * cost logging integration, and runtime override mechanism.
 */

import { routeTask, routedCall, AITask } from '@/lib/ai/model-router';
import { TIER_MODELS } from '@/lib/ai/routing-config';
import * as trackCostModule from '@/lib/pipelines/track-cost';

jest.mock('@/lib/pipelines/track-cost', () => ({
  trackPipelineCost: jest.fn().mockResolvedValue(undefined),
  calculatePipelineCost: jest.requireActual('@/lib/pipelines/track-cost').calculatePipelineCost,
}));

const mockTrackCost = trackCostModule.trackPipelineCost as jest.MockedFunction<typeof trackCostModule.trackPipelineCost>;

// ---------------------------------------------------------------------------
// routeTask — basic routing
// ---------------------------------------------------------------------------

describe('routeTask — tier assignment', () => {
  it('routes hashtag_scoring to simple tier', () => {
    const result = routeTask({
      taskType: 'hashtag_scoring',
      inputTokenEstimate: 200,
      qualityThreshold: 'medium',
    });
    expect(result.tier).toBe('simple');
    expect(result.model).toBe(TIER_MODELS.simple.modelId);
  });

  it('routes caption_generation to standard tier', () => {
    const result = routeTask({
      taskType: 'caption_generation',
      inputTokenEstimate: 500,
      qualityThreshold: 'medium',
    });
    expect(result.tier).toBe('standard');
    expect(result.model).toBe(TIER_MODELS.standard.modelId);
  });

  it('routes advisor_synthesis to complex tier', () => {
    const result = routeTask({
      taskType: 'advisor_synthesis',
      inputTokenEstimate: 2000,
      qualityThreshold: 'medium',
    });
    expect(result.tier).toBe('complex');
    expect(result.model).toBe(TIER_MODELS.complex.modelId);
  });

  it('routes knowledge_graph_inference to complex tier', () => {
    const result = routeTask({
      taskType: 'knowledge_graph_inference',
      inputTokenEstimate: 1500,
      qualityThreshold: 'medium',
    });
    expect(result.tier).toBe('complex');
  });
});

// ---------------------------------------------------------------------------
// routeTask — quality floor
// ---------------------------------------------------------------------------

describe('routeTask — qualityThreshold enforcement', () => {
  it('elevates simple → standard when qualityThreshold is "high"', () => {
    const result = routeTask({
      taskType: 'hashtag_scoring',
      inputTokenEstimate: 200,
      qualityThreshold: 'high',
    });
    expect(result.tier).toBe('standard');
    expect(result.reason).toMatch(/quality floor/);
  });

  it('does not elevate standard → complex for qualityThreshold "high"', () => {
    const result = routeTask({
      taskType: 'caption_generation',
      inputTokenEstimate: 500,
      qualityThreshold: 'high',
    });
    expect(result.tier).toBe('standard');
  });

  it('does not downgrade complex tasks for qualityThreshold "low"', () => {
    const result = routeTask({
      taskType: 'advisor_synthesis',
      inputTokenEstimate: 2000,
      qualityThreshold: 'low',
    });
    expect(result.tier).toBe('complex');
  });
});

// ---------------------------------------------------------------------------
// routeTask — cost estimation
// ---------------------------------------------------------------------------

describe('routeTask — cost estimation', () => {
  it('returns a non-negative estimated cost', () => {
    const result = routeTask({
      taskType: 'caption_generation',
      inputTokenEstimate: 1000,
      qualityThreshold: 'medium',
    });
    expect(result.estimatedCost).toBeGreaterThan(0);
  });

  it('simple tier is cheaper than standard for same token count', () => {
    const simple = routeTask({ taskType: 'hashtag_scoring', inputTokenEstimate: 1000, qualityThreshold: 'medium' });
    const standard = routeTask({ taskType: 'caption_generation', inputTokenEstimate: 1000, qualityThreshold: 'medium' });
    expect(simple.estimatedCost).toBeLessThan(standard.estimatedCost);
  });

  it('standard tier is cheaper than complex for same token count', () => {
    const standard = routeTask({ taskType: 'caption_generation', inputTokenEstimate: 1000, qualityThreshold: 'medium' });
    const complex = routeTask({ taskType: 'advisor_synthesis', inputTokenEstimate: 1000, qualityThreshold: 'medium' });
    expect(standard.estimatedCost).toBeLessThan(complex.estimatedCost);
  });
});

// ---------------------------------------------------------------------------
// routeTask — runtime overrides
// ---------------------------------------------------------------------------

describe('routeTask — ROUTING_OVERRIDES env var', () => {
  const origEnv = process.env.ROUTING_OVERRIDES;

  afterEach(() => {
    process.env.ROUTING_OVERRIDES = origEnv;
  });

  it('respects a valid JSON override', () => {
    process.env.ROUTING_OVERRIDES = JSON.stringify({ hashtag_scoring: 'complex' });
    const result = routeTask({ taskType: 'hashtag_scoring', inputTokenEstimate: 200, qualityThreshold: 'medium' });
    expect(result.tier).toBe('complex');
    expect(result.reason).toMatch(/runtime override/);
  });

  it('falls back to routing table on malformed JSON', () => {
    process.env.ROUTING_OVERRIDES = 'NOT_VALID_JSON';
    const result = routeTask({ taskType: 'hashtag_scoring', inputTokenEstimate: 200, qualityThreshold: 'medium' });
    expect(result.tier).toBe('simple');
  });
});

// ---------------------------------------------------------------------------
// routedCall — success path
// ---------------------------------------------------------------------------

describe('routedCall — success path', () => {
  beforeEach(() => mockTrackCost.mockClear());

  it('calls execute with the correct model ID', async () => {
    const execute = jest.fn().mockResolvedValue('output');
    const task: AITask = { taskType: 'caption_generation', inputTokenEstimate: 500, qualityThreshold: 'medium' };
    await routedCall({ task, execute });
    expect(execute).toHaveBeenCalledWith(TIER_MODELS.standard.modelId);
  });

  it('logs cost to pipeline_cost_ledger on success', async () => {
    const execute = jest.fn().mockResolvedValue('result');
    const task: AITask = {
      taskType: 'caption_generation',
      inputTokenEstimate: 500,
      qualityThreshold: 'medium',
      clientId: 'org-123',
      runId: 'run-abc',
    };
    await routedCall({ task, execute });

    // Allow the non-fatal async log to settle
    await Promise.resolve();

    expect(mockTrackCost).toHaveBeenCalledWith(
      expect.objectContaining({
        pipeline_name: 'caption_generation',
        client_id: 'org-123',
        run_id: 'run-abc',
        model: TIER_MODELS.standard.modelId,
      })
    );
  });
});

// ---------------------------------------------------------------------------
// routedCall — fallback escalation
// ---------------------------------------------------------------------------

describe('routedCall — tier escalation on failure', () => {
  beforeEach(() => mockTrackCost.mockClear());

  it('escalates simple → standard → complex until success', async () => {
    const calls: string[] = [];
    const execute = jest.fn().mockImplementation((modelId: string) => {
      calls.push(modelId);
      if (modelId !== TIER_MODELS.complex.modelId) throw new Error('rate limited');
      return Promise.resolve('ok');
    });

    const task: AITask = { taskType: 'hashtag_scoring', inputTokenEstimate: 100, qualityThreshold: 'medium' };
    const result = await routedCall({ task, execute });

    expect(result).toBe('ok');
    expect(calls).toEqual([
      TIER_MODELS.simple.modelId,
      TIER_MODELS.standard.modelId,
      TIER_MODELS.complex.modelId,
    ]);
  });

  it('throws after all tiers exhausted', async () => {
    const execute = jest.fn().mockRejectedValue(new Error('always fails'));
    const task: AITask = { taskType: 'hashtag_scoring', inputTokenEstimate: 100, qualityThreshold: 'medium' };
    await expect(routedCall({ task, execute })).rejects.toThrow('all tiers exhausted');
  });

  it('does not escalate beyond complex (null sentinel)', async () => {
    const execute = jest.fn().mockRejectedValue(new Error('fail'));
    const task: AITask = { taskType: 'advisor_synthesis', inputTokenEstimate: 100, qualityThreshold: 'medium' };
    await expect(routedCall({ task, execute })).rejects.toThrow();
    expect(execute).toHaveBeenCalledTimes(1); // complex only, no escalation
  });
});

// ---------------------------------------------------------------------------
// Savings projection (documented in spec, not enforced — informational)
// ---------------------------------------------------------------------------

describe('cost distribution — 60/30/10 projection', () => {
  it('simple tier costs at least 10x less per token than complex', () => {
    const simpleCost = TIER_MODELS.simple.costPerMTokInput;
    const complexCost = TIER_MODELS.complex.costPerMTokInput;
    expect(complexCost / simpleCost).toBeGreaterThanOrEqual(10);
  });
});
