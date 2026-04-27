/**
 * Boardroom — unit tests for divergence scoring + tokenisation.
 *
 * The full integration (panel → synthesis) requires mocking getAIProvider and
 * is exercised at the test-strategy level; here we lock down the pure-function
 * scoring primitives that the boardroom decision logic depends on.
 */

import { __test__ } from '@/lib/ai/boardroom';

describe('boardroom — tokenise', () => {
  it('drops short words and lowercases', () => {
    const tokens = __test__.tokenise('The Cat sat on the MAT and was happy.');
    expect(tokens.has('cat')).toBe(false); // 3 chars — dropped
    expect(tokens.has('happy')).toBe(true);
    expect(tokens.has('the')).toBe(false);
  });

  it('strips punctuation', () => {
    const tokens = __test__.tokenise('hello, world! testing.');
    expect(tokens.has('hello')).toBe(true);
    expect(tokens.has('world')).toBe(true);
    expect(tokens.has('testing')).toBe(true);
  });
});

describe('boardroom — panelAgreement', () => {
  it('returns 1 for identical outputs', () => {
    const score = __test__.panelAgreement([
      'restoration discipline preserves evidence',
      'restoration discipline preserves evidence',
    ]);
    expect(score).toBe(1);
  });

  it('returns 1 for single-output panels', () => {
    expect(__test__.panelAgreement(['anything'])).toBe(1);
  });

  it('returns low score for disjoint outputs', () => {
    const score = __test__.panelAgreement([
      'restoration discipline preserves evidence integrity',
      'completely different topic about marketing automation tooling',
    ]);
    expect(score).toBeLessThan(0.2);
  });

  it('returns mid score for partial overlap', () => {
    const score = __test__.panelAgreement([
      'restoration discipline preserves evidence integrity always',
      'restoration discipline always documents evidence properly',
    ]);
    expect(score).toBeGreaterThan(0.2);
    expect(score).toBeLessThan(0.9);
  });

  it('averages across all pairs in a 3-member panel', () => {
    const score = __test__.panelAgreement([
      'restoration discipline evidence',
      'restoration documentation evidence',
      'restoration evidence integrity',
    ]);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
