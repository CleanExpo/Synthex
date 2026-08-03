/** @jest-environment node */
/**
 * The MCP daily sub-cap must not be switchable off by a typo.
 *
 * `MCP_DAILY_FRACTION` was `Number(process.env.VIDEO_MCP_DAILY_FRACTION ?? '0.5')`
 * with no validation. `Number('abc')` is NaN, so `mcpDailyCap` became NaN and
 * the admission comparison `mcpDailyUsd + amountUsd > NaN` was ALWAYS false —
 * the agent sub-cap silently disappeared and the check failed OPEN. A negative
 * value disabled agent spend entirely; a value above 1 lifted the sub-cap above
 * the daily cap it exists to sit beneath.
 *
 * Founder ruling 3 (2026-08-03) keeps the fraction at 0.5, which only means
 * anything if the value is bounded.
 *
 * Reported by CodeRabbit on PR #820.
 */
import {
  resolveMcpFraction,
  DEFAULT_MCP_DAILY_FRACTION,
} from '@/lib/services/ai/image/spend-log';

describe('VIDEO_MCP_DAILY_FRACTION is bounded, not trusted', () => {
  it('uses the documented default when unset', () => {
    expect(resolveMcpFraction(undefined)).toBe(0.5);
    expect(DEFAULT_MCP_DAILY_FRACTION).toBe(0.5);
  });

  it.each([
    ['0.25', 0.25],
    ['0.5', 0.5],
    ['1', 1], // the whole daily cap is a legitimate setting
    ['0.001', 0.001],
  ])('accepts %s as a fraction in (0, 1]', (raw, expected) => {
    expect(resolveMcpFraction(raw)).toBe(expected);
  });

  it.each([
    ['abc', 'non-numeric — the NaN that disabled the cap'],
    ['', 'empty string'],
    ['NaN', 'literal NaN'],
    ['Infinity', 'not finite'],
    ['-Infinity', 'not finite'],
    ['0', 'zero would refuse every agent run'],
    ['-0.5', 'negative'],
    ['1.5', 'above the daily cap it sits under'],
    ['100', 'far above'],
  ])('falls back to the default for %s (%s)', raw => {
    expect(resolveMcpFraction(raw)).toBe(DEFAULT_MCP_DAILY_FRACTION);
  });

  it('never returns a value that would disable the comparison', () => {
    // The property in one assertion: whatever the input, the resolved fraction
    // is a finite number in (0, 1], so `spend + amount > cap * fraction` is
    // always a real comparison rather than a silent false.
    for (const raw of ['abc', '', '-1', '0', '9e99', 'Infinity', '0.3', '1']) {
      const f = resolveMcpFraction(raw);
      expect(Number.isFinite(f)).toBe(true);
      expect(f).toBeGreaterThan(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });
});
