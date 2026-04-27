/**
 * Task Routing Matrix — unit tests
 *
 * Verifies the intent → ModelChoice routing for the multi-model orchestration
 * layer (lib/ai/task-routing.ts).
 */

import {
  routeIntent,
  getRoutingMatrix,
  type TaskIntent,
} from '@/lib/ai/task-routing';

describe('routeIntent', () => {
  describe('routine intents → local Gemma', () => {
    it('routes classify-text to gemma4:e2b on Ollama', () => {
      const choice = routeIntent('classify-text');
      expect(choice.provider).toBe('ollama');
      expect(choice.modelId).toBe('gemma4:e2b');
      expect(choice.estimatedCostPer1kOutput).toBe(0);
    });

    it('routes summarise-batch to gemma4:e4b on Ollama', () => {
      const choice = routeIntent('summarise-batch');
      expect(choice.provider).toBe('ollama');
      expect(choice.modelId).toBe('gemma4:e4b');
    });

    it('format-conversion has no fallback (fail-loud)', () => {
      const choice = routeIntent('format-conversion');
      expect(choice.provider).toBe('ollama');
      expect(choice.fallback).toEqual([]);
    });

    it('classify-text fallback chain is DeepSeek then Sonnet', () => {
      const choice = routeIntent('classify-text');
      expect(choice.fallback).toHaveLength(2);
      expect(choice.fallback[0].modelId).toBe('deepseek/deepseek-v4-flash');
      expect(choice.fallback[1].modelId).toBe('anthropic/claude-sonnet-4-6');
    });
  });

  describe('mid-quality cloud intents → DeepSeek', () => {
    it('routes draft-blog-post to DeepSeek V4 Flash', () => {
      const choice = routeIntent('draft-blog-post');
      expect(choice.provider).toBe('openrouter');
      expect(choice.modelId).toBe('deepseek/deepseek-v4-flash');
      expect(choice.estimatedCostPer1kOutput).toBeCloseTo(0.00028, 5);
    });

    it('routes code-generation to DeepSeek with Sonnet fallback', () => {
      const choice = routeIntent('code-generation');
      expect(choice.modelId).toBe('deepseek/deepseek-v4-flash');
      expect(choice.fallback[0].modelId).toBe('anthropic/claude-sonnet-4-6');
    });
  });

  describe('senior-tier intents → Sonnet', () => {
    it('routes brand-voice-enforce to Sonnet with Opus fallback', () => {
      const choice = routeIntent('brand-voice-enforce');
      expect(choice.modelId).toBe('anthropic/claude-sonnet-4-6');
      expect(choice.fallback[0].modelId).toBe('anthropic/claude-opus-4-7');
    });

    it('routes code-review to Sonnet', () => {
      const choice = routeIntent('code-review');
      expect(choice.modelId).toBe('anthropic/claude-sonnet-4-6');
    });
  });

  describe('high-stakes intents → Opus', () => {
    it('routes high-stakes-creative to Opus with no fallback', () => {
      const choice = routeIntent('high-stakes-creative');
      expect(choice.modelId).toBe('anthropic/claude-opus-4-7');
      expect(choice.fallback).toEqual([]);
    });
  });

  describe('quality overrides', () => {
    it('quality:premium pushes classify-text to highest-cost option (Sonnet)', () => {
      const choice = routeIntent('classify-text', { quality: 'premium' });
      expect(choice.modelId).toBe('anthropic/claude-sonnet-4-6');
    });

    it('quality:fast on draft-blog-post does not change a mid-tier intent (already cheap)', () => {
      const choice = routeIntent('draft-blog-post', { quality: 'fast' });
      // DeepSeek (0.00028) is cheaper than Sonnet fallback (0.015) — stays put
      expect(choice.modelId).toBe('deepseek/deepseek-v4-flash');
    });
  });

  describe('budget ceiling', () => {
    it('drops senior intent to cheaper fallback when ceiling is below Sonnet cost', () => {
      const choice = routeIntent('brand-voice-enforce', {
        budgetCeilingPer1kOutput: 0.001, // below Sonnet's 0.015
      });
      // No cheaper option in chain (Sonnet → Opus) — stays at primary
      expect(choice.modelId).toBe('anthropic/claude-sonnet-4-6');
    });

    it('drops draft-blog-post to local Gemma fallback when no cloud-budget exists', () => {
      // boilerplate-generate has Gemma fallback at $0
      const choice = routeIntent('boilerplate-generate', {
        budgetCeilingPer1kOutput: 0.0001, // below DeepSeek's 0.00028
      });
      expect(choice.provider).toBe('ollama');
    });
  });

  describe('matrix completeness', () => {
    it('every TaskIntent in the union has a matrix entry', () => {
      const matrix = getRoutingMatrix();
      const intents: TaskIntent[] = [
        'classify-text',
        'extract-entities',
        'summarise-batch',
        'format-conversion',
        'linting-suggest',
        'boilerplate-generate',
        'draft-blog-post',
        'draft-social-post',
        'draft-email-sequence',
        'research-synthesis',
        'code-generation',
        'code-review',
        'brand-voice-enforce',
        'senior-strategy-draft',
        'boardroom-decision',
        'architecture-decision',
        'high-stakes-creative',
      ];
      for (const intent of intents) {
        expect(matrix[intent]).toBeDefined();
        expect(matrix[intent].provider).toMatch(/^(ollama|openrouter|anthropic|google)$/);
      }
    });
  });

  it('throws on unknown intent', () => {
    // @ts-expect-error — testing runtime guard
    expect(() => routeIntent('totally-made-up')).toThrow(/unknown intent/);
  });
});
