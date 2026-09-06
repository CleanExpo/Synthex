/**
 * Positive control for the current-generation model registry update.
 *
 * This probe must FAIL against the pre-change model-registry.ts (which resolves
 * claude-opus-4-6 and prices Opus at $15/$75 per MTok) and PASS after it. A probe
 * that passes on both trees proves nothing.
 */
import {
  byPreference,
  getLatestModel,
  getModel,
  getModels,
} from '@/lib/ai/model-registry';
import type { AIProvider } from '@/lib/ai/model-registry';

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

/**
 * Round 2 control for the P1 raised by the independent reviewer (gemini,
 * 2026-09-06) against 949bc4f3a: Opus 5 and Sonnet 5 tie on releaseDate, so the
 * model getLatestModel returned was decided by array position under a stable sort.
 *
 * The fix is a comparator that is a TOTAL ORDER (releaseDate, then explicit
 * precedence, then id). These tests assert the property that actually discharges
 * the finding: the winner is a pure function of the registry DATA, so neither
 * array position nor the engine's sort stability can change it.
 *
 * Note on scope: date ties also exist in the google and openrouter blocks and in
 * anthropic's production tier. They pre-date this change and are now deterministic
 * via the id tie-break, but their winner is alphabetical rather than intentional.
 * Making those explicit is model policy for providers this change does not own and
 * is filed as a documented warning, not fixed here.
 */
describe('model registry — getLatestModel ordering is deterministic', () => {
  const providers: AIProvider[] = [
    'openai',
    'anthropic',
    'google',
    'openrouter',
    'ollama',
  ];

  /** The documented total order, recomputed independently of the module. */
  const rank = (m: {
    releaseDate: Date;
    precedence?: number;
    id: string;
  }): [number, number, string] => [
    -m.releaseDate.getTime(),
    -(m.precedence ?? 0),
    m.id,
  ];

  const winner = (provider: AIProvider) => {
    for (const tier of ['latest', 'production'] as const) {
      const candidates = getModels(provider).filter(
        c => !c.isDeprecated && c.tier === tier
      );
      if (candidates.length > 0) {
        return [...candidates].sort((a, b) => {
          const ra = rank(a);
          const rb = rank(b);
          return ra[0] - rb[0] || ra[1] - rb[1] || ra[2].localeCompare(rb[2]);
        })[0];
      }
    }
    return undefined;
  };

  it.each(providers)(
    'getLatestModel(%s) is decided by the data, not by array position',
    provider => {
      expect(getLatestModel(provider).id).toBe(winner(provider)?.id);
    }
  );

  it('anthropic latest tier carries no unresolved ordering tie', () => {
    const candidates = getModels('anthropic').filter(
      m => !m.isDeprecated && m.tier === 'latest'
    );
    const keys = candidates.map(
      m => `${m.releaseDate.getTime()}:${m.precedence ?? 0}`
    );
    // A duplicate key here would send the winner to the alphabetical fallback
    // rather than to a stated intent.
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('breaks the Opus 5 / Sonnet 5 date tie by explicit precedence, not order', () => {
    const opus = getModel('anthropic', 'claude-opus-5');
    const sonnet = getModel('anthropic', 'claude-sonnet-5');
    expect(opus?.releaseDate.getTime()).toBe(sonnet?.releaseDate.getTime());
    expect(opus?.precedence ?? 0).toBeGreaterThan(sonnet?.precedence ?? 0);
    expect(getLatestModel('anthropic').id).toBe('claude-opus-5');
  });

  it('resolves a stable default on repeated calls for every provider', () => {
    for (const provider of providers) {
      const first = getLatestModel(provider).id;
      expect(getLatestModel(provider).id).toBe(first);
    }
  });
});

/**
 * The control that actually detects the P1.
 *
 * The earlier "decided by the data" assertions passed even with the comparator
 * reverted to a date-only sort, because V8's sort is stable and happened to agree
 * with them — a test that cannot fail is not a control. This asserts TOTALITY
 * directly: the comparator must never return 0 for two distinct models, which is
 * precisely the property that stops array position and sort stability from
 * deciding which model callers get. Reverting byPreference to a date-only
 * comparison makes this go red.
 */
describe('model registry — byPreference is a total order', () => {
  const providers: AIProvider[] = [
    'openai',
    'anthropic',
    'google',
    'openrouter',
    'ollama',
  ];

  it.each(providers)('never returns 0 for two distinct %s models', provider => {
    const models = getModels(provider);
    expect(models.length).toBeGreaterThan(1);

    const ties: string[] = [];
    for (let i = 0; i < models.length; i++) {
      for (let j = i + 1; j < models.length; j++) {
        if (byPreference(models[i], models[j]) === 0) {
          ties.push(`${models[i].id} vs ${models[j].id}`);
        }
      }
    }
    expect(ties).toEqual([]);
  });

  it('is antisymmetric across every anthropic pair', () => {
    const models = getModels('anthropic');
    for (let i = 0; i < models.length; i++) {
      for (let j = i + 1; j < models.length; j++) {
        expect(
          Math.sign(byPreference(models[i], models[j])) +
            Math.sign(byPreference(models[j], models[i]))
        ).toBe(0);
      }
    }
  });
});
