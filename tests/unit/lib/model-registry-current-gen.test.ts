/**
 * Positive control for the current-generation model registry update.
 *
 * This probe must FAIL against the pre-change model-registry.ts (which resolves
 * claude-opus-4-6 and prices Opus at $15/$75 per MTok) and PASS after it. A probe
 * that passes on both trees proves nothing.
 */
import { getLatestModel, getModel, getModels } from '@/lib/ai/model-registry';

describe('model registry — current generation', () => {
  it('getLatestModel(anthropic) resolves to claude-opus-5', () => {
    expect(getLatestModel('anthropic').id).toBe('claude-opus-5');
  });

  it('exposes claude-sonnet-5 at tier latest', () => {
    const m = getModel('anthropic', 'claude-sonnet-5');
    expect(m).toBeDefined();
    expect(m?.tier).toBe('latest');
    expect(m?.isDeprecated).toBe(false);
  });

  it('demotes the superseded 4.6 pair to production, still selectable', () => {
    for (const id of ['claude-opus-4-6', 'claude-sonnet-4-6']) {
      const m = getModel('anthropic', id);
      expect(m).toBeDefined();
      expect(m?.tier).toBe('production');
    }
  });

  it('prices Opus-tier at $5/$25 per MTok, not $15/$75', () => {
    for (const id of ['claude-opus-5', 'claude-opus-4-6']) {
      const m = getModel('anthropic', id);
      expect(m?.costPer1kTokens).toEqual({ input: 0.005, output: 0.025 });
    }
  });

  it('prices Haiku 4.5 at $1/$5 per MTok', () => {
    const m = getModel('anthropic', 'claude-haiku-4-5-20251001');
    expect(m?.costPer1kTokens).toEqual({ input: 0.001, output: 0.005 });
  });

  it('leaves exactly one non-deprecated latest-tier Opus as the default', () => {
    const latest = getModels('anthropic').filter(
      m => m.tier === 'latest' && !m.isDeprecated
    );
    expect(latest.map(m => m.id).sort()).toEqual([
      'claude-opus-5',
      'claude-sonnet-5',
    ]);
  });
});
