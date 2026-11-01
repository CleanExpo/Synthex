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
  it('classify-text routes to DeepSeek V4 Flash on the cheap-cloud tier', () => {
    const choice = routeIntent('classify-text');
    expect(choice.provider).toBe('openrouter');
    expect(choice.modelId).toBe('deepseek/deepseek-v4-flash');
    expect(choice.estimatedCostPer1k).toBeCloseTo(0.00028, 6);
    expect(choice.triangulate).toBe(false);
    // First fallback is a second cheap vendor (Gemini 3.1 Flash)
    expect(choice.fallback[0]?.modelId).toBe('google/gemini-3.1-flash');
  });

  it('format-conversion has no fallback (fail loud on cheap-tier failure)', () => {
    const choice = routeIntent('format-conversion');
    expect(choice.modelId).toBe('deepseek/deepseek-v4-flash');
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
    expect(choice.modelId).toBe('anthropic/claude-sonnet-5');
    expect(choice.fallback[0]?.modelId).toBe('anthropic/claude-opus-4-8');
  });

  it('high-stakes-creative routes to Opus with no fallback', () => {
    const choice = routeIntent('high-stakes-creative');
    expect(choice.modelId).toBe('anthropic/claude-opus-4-8');
    expect(choice.fallback).toEqual([]);
  });

  it('boardroom-decision triggers triangulation with a 3-model panel', () => {
    const choice = routeIntent('boardroom-decision');
    expect(choice.triangulate).toBe(true);
    expect(choice.panel).toHaveLength(3);
    const ids = choice.panel?.map(p => p.modelId) ?? [];
    expect(ids).toContain('google/gemini-3.1-flash');
    expect(ids).toContain('deepseek/deepseek-v4-flash');
    expect(ids).toContain('anthropic/claude-sonnet-5');
  });

  it('architecture-decision triangulates across DeepSeek + Sonnet + Opus', () => {
    const choice = routeIntent('architecture-decision');
    expect(choice.triangulate).toBe(true);
    expect(choice.panel).toHaveLength(3);
    const ids = choice.panel?.map(p => p.modelId) ?? [];
    expect(ids).toContain('anthropic/claude-opus-4-8');
  });
});

describe('task-routing — quality overrides', () => {
  it('quality:"low" leaves classify-text unchanged (already cheapest)', () => {
    const choice = routeIntent('classify-text', { quality: 'low' });
    expect(choice.modelId).toBe('deepseek/deepseek-v4-flash');
    expect(choice.fallback[0]?.modelId).toBe('google/gemini-3.1-flash');
  });

  it('quality:"low" downgrades code-review from Sonnet to DeepSeek V4 Flash', () => {
    const choice = routeIntent('code-review', { quality: 'low' });
    expect(choice.modelId).toBe('deepseek/deepseek-v4-flash');
    expect(choice.estimatedCostPer1k).toBeCloseTo(0.00028, 6);
  });

  it('quality:"high" upgrades classify-text to Claude Sonnet', () => {
    const choice = routeIntent('classify-text', { quality: 'high' });
    expect(choice.modelId).toBe('anthropic/claude-sonnet-5');
    expect(choice.fallback[0]?.modelId).toBe('anthropic/claude-opus-4-8');
  });

  it('quality:"high" leaves senior-strategy-draft unchanged (already Sonnet)', () => {
    const choice = routeIntent('senior-strategy-draft', { quality: 'high' });
    expect(choice.modelId).toBe('anthropic/claude-sonnet-5');
  });
});

describe('task-routing — budget ceiling', () => {
  it('budgetCeiling:0 throws: no model is free', () => {
    expect(() => routeIntent('draft-blog-post', { budgetCeiling: 0 })).toThrow(
      /No model within budgetCeiling 0/
    );
  });

  it('budgetCeiling below the cheapest tier throws rather than overspend', () => {
    // DeepSeek Flash costs $0.00028 / 1k > the 0.0001 ceiling.
    expect(() =>
      routeIntent('classify-text', { budgetCeiling: 0.0001 })
    ).toThrow(/No model within budgetCeiling/);
  });

  it('budgetCeiling:0.001 refuses code-review on Sonnet', () => {
    // Sonnet costs $0.015 / 1k > 0.001 ceiling; never return it anyway.
    expect(() => routeIntent('code-review', { budgetCeiling: 0.001 })).toThrow(
      /No model within budgetCeiling/
    );
  });

  it('quality:"low" plus a ceiling the cheap tier fits routes code-review to DeepSeek Flash', () => {
    const choice = routeIntent('code-review', {
      quality: 'low',
      budgetCeiling: 0.001,
    });
    expect(choice.modelId).toBe('deepseek/deepseek-v4-flash');
  });

  it('budgetCeiling above primary cost is a no-op', () => {
    const choice = routeIntent('classify-text', { budgetCeiling: 999 });
    expect(choice.modelId).toBe('deepseek/deepseek-v4-flash');
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
    expect(choice.modelId).toBe('anthropic/claude-sonnet-5');
  });

  it('huge context on a cheap-tier intent stays on DeepSeek V4 Flash', () => {
    const choice = routeIntent('classify-text', { contextLength: 500_000 });
    expect(choice.modelId).toBe('deepseek/deepseek-v4-flash');
  });
});

describe('task-routing — invariants', () => {
  it('no intent routes to a provider outside the registry', () => {
    const known = ['openai', 'anthropic', 'google', 'openrouter'];
    for (const entry of Object.values(getRoutingMatrix())) {
      const all = [entry.primary, ...entry.fallback, ...(entry.panel ?? [])];
      for (const m of all) expect(known).toContain(m.provider);
    }
  });

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

describe('task-routing — budget ceiling covers the fallback chain', () => {
  const PRICES: Record<string, number> = {
    'google/gemini-3.1-flash': 0.0003,
    'deepseek/deepseek-v4-flash': 0.00028,
    'anthropic/claude-sonnet-5': 0.015,
    'anthropic/claude-opus-4-8': 0.075,
  };

  it('code-review at quality:"low" under a 0.001 ceiling returns no fallback above it', () => {
    const choice = routeIntent('code-review', {
      quality: 'low',
      budgetCeiling: 0.001,
    });
    expect(choice.estimatedCostPer1k).toBeLessThanOrEqual(0.001);
    for (const f of choice.fallback) {
      expect(PRICES[f.modelId]).toBeDefined();
      expect(PRICES[f.modelId]).toBeLessThanOrEqual(0.001);
    }
    expect(choice.fallback.map(f => f.modelId)).not.toContain(
      'anthropic/claude-opus-4-8'
    );
  });

  it('every intent under a ceiling returns only priced fallbacks within it', () => {
    for (const intent of ALL_INTENTS) {
      let choice;
      try {
        choice = routeIntent(intent, { quality: 'low', budgetCeiling: 0.02 });
      } catch {
        continue;
      }
      for (const f of choice.fallback) {
        expect(PRICES[f.modelId]).toBeLessThanOrEqual(0.02);
      }
    }
  });

  it('no ceiling leaves the matrix fallback chain unchanged', () => {
    expect(routeIntent('code-review').fallback.length).toBeGreaterThan(0);
  });
});

describe('task-routing — ceiling ordering and triangulation panel', () => {
  it('long context under a ceiling picks the cheap long-context model instead of throwing', () => {
    const choice = routeIntent('code-review', {
      contextLength: 500_000,
      budgetCeiling: 0.001,
    });
    expect(choice.modelId).toBe('deepseek/deepseek-v4-flash');
    expect(choice.estimatedCostPer1k).toBeLessThanOrEqual(0.001);
  });

  it.each(['boardroom-decision', 'architecture-decision'] as const)(
    '%s under a ceiling below its panel is refused, not returned',
    intent => {
      expect(() =>
        routeIntent(intent, { quality: 'low', budgetCeiling: 0.001 })
      ).toThrow(/budgetCeiling/);
    }
  );

  it('boardroom-decision without a ceiling still returns its full panel', () => {
    expect(routeIntent('boardroom-decision').panel?.length).toBe(3);
  });
});

describe('task-routing — triangulation under a ceiling every panellist fits', () => {
  it.each(['boardroom-decision', 'architecture-decision'] as const)(
    '%s keeps its full panel when the ceiling covers every panellist',
    intent => {
      const uncapped = routeIntent(intent);
      const capped = routeIntent(intent, { budgetCeiling: 999 });
      expect(capped.triangulate).toBe(true);
      expect(capped.panel).toEqual(uncapped.panel);
      expect(capped.panel?.length).toBeGreaterThan(0);
    }
  );
});

describe('task-routing — every returnable model has a known price', () => {
  // A model the router can return but the price list does not know is dropped
  // by any budget ceiling, however generous. A ceiling every price fits under
  // must therefore leave every route exactly as it is without a ceiling.
  const qualities = [undefined, 'low', 'high'] as const;
  const contexts = [undefined, 500_000] as const;

  it.each(ALL_INTENTS)(
    '%s keeps its fallbacks and panel under a generous ceiling',
    intent => {
      for (const quality of qualities) {
        for (const contextLength of contexts) {
          const uncapped = routeIntent(intent, { quality, contextLength });
          const capped = routeIntent(intent, {
            quality,
            contextLength,
            budgetCeiling: 999,
          });
          expect({ quality, contextLength, fallback: capped.fallback }).toEqual(
            {
              quality,
              contextLength,
              fallback: uncapped.fallback,
            }
          );
          expect(capped.panel).toEqual(uncapped.panel);
        }
      }
    }
  );

  it('long context under a 0.001 ceiling keeps the DeepSeek V4 Pro fallback (0.00087)', () => {
    const choice = routeIntent('code-review', {
      contextLength: 500_000,
      budgetCeiling: 0.001,
    });
    expect(choice.fallback.map(f => f.modelId)).toContain(
      'deepseek/deepseek-v4-pro'
    );
  });
});
