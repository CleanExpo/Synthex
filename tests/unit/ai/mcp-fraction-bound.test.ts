/** @jest-environment node */
/**
 * The MCP daily sub-cap must not be switchable off by a typo — and must not
 * become MORE permissive when an operator tries to shut it.
 *
 * Two defects, found in sequence:
 *
 * 1. `MCP_DAILY_FRACTION` was `Number(process.env.VIDEO_MCP_DAILY_FRACTION ??
 *    '0.5')` with no validation. `Number('abc')` is NaN, so `mcpDailyCap`
 *    became NaN and the comparison `mcpDailyUsd + amountUsd > mcpDailyCap` was
 *    ALWAYS false — the sub-cap silently ceased to exist and the check failed
 *    OPEN. (CodeRabbit, PR #820.)
 *
 * 2. The first fix then rejected 0 and fell back to 0.5. But 0 is the kill
 *    switch: an operator setting it to stop agent spend was handed HALF the
 *    daily budget instead. A spend control must never loosen at the moment
 *    someone reaches for the brake. (Independent review of 301bfcc1.)
 *
 * The resolution: [0, 1] is the valid range, and anything outside it REFUSES
 * rather than falling back in either direction — 0.5 would loosen a control
 * the operator was setting, 0 would silently disable a working feature, and
 * both are quiet. Quiet is what let defect 1 survive.
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

  it('accepts 0 — the kill switch that stops agent-initiated spend', () => {
    // THE regression from the first fix. Rejecting this granted 0.5 to an
    // operator who was explicitly trying to grant nothing.
    expect(resolveMcpFraction('0')).toBe(0);
    expect(resolveMcpFraction('0.0')).toBe(0);
  });

  it.each([
    ['0.25', 0.25],
    ['0.5', 0.5],
    ['1', 1], // the whole daily cap is a legitimate setting
    ['0.001', 0.001],
  ])('accepts %s as a fraction in [0, 1]', (raw, expected) => {
    expect(resolveMcpFraction(raw)).toBe(expected);
  });

  it.each([
    ['abc', 'non-numeric — the NaN that disabled the cap'],
    ['', 'empty string'],
    ['NaN', 'literal NaN'],
    ['Infinity', 'not finite'],
    ['-Infinity', 'not finite'],
    ['-0.5', 'negative'],
    ['1.5', 'above the daily cap it sits under'],
    ['100', 'far above'],
  ])('REFUSES %s (%s) rather than falling back', raw => {
    expect(() => resolveMcpFraction(raw)).toThrow(/VIDEO_MCP_DAILY_FRACTION/);
  });

  it('never silently returns a value the operator did not ask for', () => {
    // The property in one assertion: every input either yields exactly what
    // was configured, or throws. There is no third outcome in which the
    // process runs on a fraction nobody chose.
    for (const raw of ['0', '0.3', '1', 'abc', '-1', '9e99', 'Infinity']) {
      let resolved: number | undefined;
      try {
        resolved = resolveMcpFraction(raw);
      } catch {
        continue; // refused — acceptable
      }
      expect(resolved).toBe(Number(raw));
      expect(Number.isFinite(resolved)).toBe(true);
      expect(resolved).toBeGreaterThanOrEqual(0);
      expect(resolved).toBeLessThanOrEqual(1);
    }
  });

  it('a zero fraction really does refuse agent spend, not admit it', () => {
    // Guards the CONSEQUENCE, not just the parse: mcpDailyCap = dailyCap * 0,
    // so any positive agent-initiated amount exceeds it.
    const dailyCap = 15;
    const mcpDailyCap = dailyCap * resolveMcpFraction('0');
    expect(mcpDailyCap).toBe(0);
    expect(0 + 0.0001 > mcpDailyCap).toBe(true); // the admission comparison
  });
});
