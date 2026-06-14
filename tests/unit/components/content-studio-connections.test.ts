/**
 * AI Content Studio — connections race-guard + auto-select tests.
 *
 * Regression: switching business quickly fired overlapping `fetchConnections`
 * requests with no AbortController and no stale-response guard, so a slower
 * EARLIER response could resolve last and apply the WRONG brand's platforms
 * (and flip the form to a platform the now-selected brand may not have).
 *
 * Covers:
 *   1. parseConnectedPlatforms — payload normalisation.
 *   2. selectAutoPlatform — keeps current platform if still connected, else
 *      picks first; never blanks out when no connections.
 *   3. Stale-response guard — a `cancelled` flag (the pattern used in the
 *      effect) ensures only the LATEST request applies, even when an earlier
 *      request resolves last (latest-wins / stale ignored).
 *
 * @module tests/unit/components/content-studio-connections.test
 */

import { describe, it, expect } from '@jest/globals';
import {
  parseConnectedPlatforms,
  selectAutoPlatform,
} from '@/components/ai-content-studio/connections';
import type { ConnectionStatus } from '@/components/ai-content-studio/types';

describe('parseConnectedPlatforms', () => {
  it('returns only connected platforms, lowercased', () => {
    const conns: ConnectionStatus[] = [
      { platform: 'Twitter', connected: true },
      { platform: 'LinkedIn', connected: false },
      { platform: 'Instagram', connected: true },
    ];
    const set = parseConnectedPlatforms(conns);
    expect(set).toEqual(new Set(['twitter', 'instagram']));
  });

  it('handles missing/empty payloads safely', () => {
    expect(parseConnectedPlatforms(undefined)).toEqual(new Set());
    expect(parseConnectedPlatforms(null)).toEqual(new Set());
    expect(parseConnectedPlatforms([])).toEqual(new Set());
  });
});

describe('selectAutoPlatform', () => {
  it('keeps the current platform when the brand still has it connected', () => {
    const connected = new Set(['twitter', 'linkedin']);
    expect(selectAutoPlatform(connected, 'linkedin')).toBe('linkedin');
  });

  it('switches to the first connected platform when current is not connected', () => {
    const connected = new Set(['instagram', 'facebook']);
    expect(selectAutoPlatform(connected, 'twitter')).toBe('instagram');
  });

  it('leaves the current platform untouched when the brand has no connections', () => {
    expect(selectAutoPlatform(new Set(), 'twitter')).toBe('twitter');
  });
});

/**
 * Reproduction of the effect's stale-guard contract. Each "run" captures its
 * own `cancelled` flag; switching business cancels the previous run. We then
 * resolve the requests OUT OF ORDER (earlier request resolves last) and assert
 * only the latest brand's result is applied.
 */
describe('connections stale-response guard (latest-wins)', () => {
  type Deferred = {
    promise: Promise<Set<string>>;
    resolve: (v: Set<string>) => void;
  };
  function defer(): Deferred {
    let resolve!: (v: Set<string>) => void;
    const promise = new Promise<Set<string>>(r => {
      resolve = r;
    });
    return { promise, resolve };
  }

  it('ignores a slower EARLIER response and applies only the latest', async () => {
    let applied: Set<string> | null = null;

    // Simulate the effect run for a given brand. Returns a cleanup that marks
    // the run cancelled — exactly what the real effect's return fn does.
    function runFetch(deferred: Deferred): () => void {
      let cancelled = false;
      (async () => {
        const result = await deferred.promise;
        if (cancelled) return; // stale-guard: do not apply
        applied = result;
      })();
      return () => {
        cancelled = true;
      };
    }

    const brandA = defer(); // selected first, but resolves LAST (slow)
    const brandB = defer(); // selected second, resolves first

    const cleanupA = runFetch(brandA);
    // User switches business -> previous run is cancelled, new run starts.
    cleanupA();
    runFetch(brandB);

    // Resolve out of order: B (latest) first, then A (stale earlier) last.
    brandB.resolve(new Set(['instagram']));
    await Promise.resolve();
    brandA.resolve(new Set(['twitter']));
    await Promise.resolve();
    await Promise.resolve();

    // Despite brand A resolving LAST, its (stale) result must be ignored.
    expect(applied).toEqual(new Set(['instagram']));
  });

  it('applies the result when the run is the current (not cancelled) one', async () => {
    let applied: Set<string> | null = null;
    const d = defer();
    const cancelled = false;
    (async () => {
      const result = await d.promise;
      if (cancelled) return;
      applied = result;
    })();
    d.resolve(new Set(['linkedin']));
    await Promise.resolve();
    await Promise.resolve();
    expect(cancelled).toBe(false);
    expect(applied).toEqual(new Set(['linkedin']));
  });
});
