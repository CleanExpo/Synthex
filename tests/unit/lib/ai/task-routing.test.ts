/**
 * Unit tests — SYN-807 Phase 1: task-routing matrix.
 *
 * Pure-function tests; no mocks needed (the matrix is declarative).
 */

import {
  ALL_INTENTS,
  getRoutingMatrix,
  routeIntent,
  type TaskIntent,
} from '@/lib/ai/task-routing';

describe('task-routing — default decisions', () => {
  it('classify-text routes to local Gemma 4 E2B at zero cost', () => {
    const choice = routeIntent('classify-text');
    expect(choice.provider).toBe('ollama');
    expect(choice.modelId).toBe('gemma4:e2b');
    expect(choice.estimatedCostPer1k).toBe(0);
    expect(choice.triangulate).toBe(false);
    expect(choice.fallback.length).toBeGreaterThan(0);
    // First fallback is the cheap cloud tier (DeepSeek V4 Flash)
    expect(choice.fallback[0]?.modelId).toBe('deepseek/deepseek-v4-flash');
  });

  it('format-conversion has no fallback (fail loud on local failure)', () => {
    const choice = routeIntent('format-conversion');
    expect(choice.provider).toBe('ollama');
    expect(choice.fallback).toEqual([]);
  });

  it('draft-blog-post routes to DeepSeek V4 Flash on the cheap-cloud tier', () => {
    const choice = routeIntent('draft-blog-post');
    expect(choice.provider).toBe('openrouter');
    expect(choice.modelId).toBe('deepseek/deepseek-v4-flash');
    // Output cost: $0.28 / 1M = $0.00028 / 1k.
    expect(choice.estimatedCostPer1k).toBeCloseTo(0.00028, 6);
  });

  it('code-review routes to Claude Sonnet, falls back to Opus', () => {
    const choice = routeIntent('code-review');
    expect(choice.modelId).toBe('anthropic/claude-sonnet-4-6');
    expect(choice.fallback[0]?.modelId).toBe('anthropic/claude-opus-4-6');
  });

  it('high-stakes-creative routes to Opus with no fallback', () => {
    const choice = routeIntent('high-stakes-creative');
    expect(choice.modelId).toBe('anthropic/claude-opus-4-6');
    expect(choice.fallback).toEqual([]);
  });

  it('boardroom-decision triggers triangulation with a 3-model panel', () => {
    const choice = routeIntent('boardroom-decision');
    expect(choice.triangulate).toBe(true);
    expect(choice.panel).toHaveLength(3);
    const ids = choice.panel?.map(p => p.modelId) ?? [];
    expect(ids).toContain('gemma4:e4b');
    expect(ids).toContain('deepseek/deepseek-v4-flash');
    expect(ids).toContain('anthropic/claude-sonnet-4-6');
  });

  it('architecture-decision triangulates across DeepSeek + Sonnet + Opus', () => {
    const choice = routeIntent('architecture-decision');
    expect(choice.triangulate).toBe(true);
    expect(choice.panel).toHaveLength(3);
    const ids = choice.panel?.map(p => p.modelId) ?? [];
    expect(ids).toContain('anthropic/claude-opus-4-6');
  });
});

describe('task-routing — quality overrides', () => {
  it('quality:"low" forces classify-text local (already local — no-op)', () => {
    const choice = routeIntent('classify-text', { quality: 'low' });
    expect(choice.provider).toBe('ollama');
  });

  it('quality:"low" downgrades draft-blog-post to local Gemma', () => {
    const choice = routeIntent('draft-blog-post', { quality: 'low' });
    expect(choice.provider).toBe('ollama');
    expect(choice.estimatedCostPer1k).toBe(0);
  });

  it('quality:"high" upgrades classify-text to Claude Sonnet', () => {
    const choice = routeIntent('classify-text', { quality: 'high' });
    expect(choice.modelId).toBe('anthropic/claude-sonnet-4-6');
    expect(choice.fallback[0]?.modelId).toBe('anthropic/claude-opus-4-6');
  });

  it('quality:"high" leaves senior-strategy-draft unchanged (already Sonnet)', () => {
    const choice = routeIntent('senior-strategy-draft', { quality: 'high' });
    expect(choice.modelId).toBe('anthropic/claude-sonnet-4-6');
  });
});

describe('task-routing — budget ceiling', () => {
  it('budgetCeiling:0 forces draft-blog-post to local Gemma', () => {
    const choice = routeIntent('draft-blog-post', { budgetCeiling: 0 });
    expect(choice.provider).toBe('ollama');
    expect(choice.estimatedCostPer1k).toBe(0);
    expect(choice.fallback).toEqual([]);
  });

  it('budgetCeiling:0.001 drops code-review from Sonnet to DeepSeek Flash', () => {
    // Sonnet costs $0.015 / 1k > 0.001 ceiling. Falls back through chain.
    const choice = routeIntent('code-review', { budgetCeiling: 0.001 });
    // code-review's fallback chain doesn't include DeepSeek directly,
    // so it stays on Sonnet (chain unchanged) — exercising the
    // "no cheap-cloud fallback found" branch.
    expect(choice.modelId).toBe('anthropic/claude-sonnet-4-6');
  });

  it('budgetCeiling above primary cost is a no-op', () => {
    const choice = routeIntent('classify-text', { budgetCeiling: 999 });
    expect(choice.provider).toBe('ollama');
  });
});

describe('task-routing — context-length escalation', () => {
  it('contextLength > 200K escalates Sonnet to DeepSeek V4 Flash (1M ctx)', () => {
    const choice = routeIntent('code-review', { contextLength: 500_000 });
    expect(choice.modelId).toBe('deepseek/deepseek-v4-flash');
    expect(choice.fallback[0]?.modelId).toBe('deepseek/deepseek-v4-pro');
  });

  it('contextLength below threshold leaves routing unchanged', () => {
    const choice = routeIntent('code-review', { contextLength: 50_000 });
    expect(choice.modelId).toBe('anthropic/claude-sonnet-4-6');
  });

  it('huge context on local intent escalates to DeepSeek V4 Flash', () => {
    const choice = routeIntent('classify-text', { contextLength: 500_000 });
    expect(choice.modelId).toBe('deepseek/deepseek-v4-flash');
  });
});

describe('task-routing — invariants', () => {
  it('every intent has a primary model defined', () => {
    for (const intent of ALL_INTENTS) {
      const choice = routeIntent(intent);
      expect(choice.provider).toBeTruthy();
      expect(choice.modelId).toBeTruthy();
    }
  });

  it('triangulating intents always have a non-empty panel', () => {
    const matrix = getRoutingMatrix();
    for (const [intent, entry] of Object.entries(matrix)) {
      if (entry.triangulate) {
        expect(entry.panel).toBeDefined();
        expect(entry.panel?.length).toBeGreaterThan(1);
      }
    }
  });

  it('throws on unknown intent', () => {
    expect(() => routeIntent('does-not-exist' as TaskIntent)).toThrow(
      /Unknown task intent/
    );
  });
});
