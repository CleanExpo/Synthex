/**
 * Unit tests — SYN-560 external signal adapters (Google Trends / ABS)
 *
 * Asserts the not-configured guards return configured:false with ZERO signals
 * and never throw — proving graceful degradation and no fabricated data.
 */

import {
  fetchGoogleTrendsSignals,
  fetchAbsSignals,
} from '@/lib/seasonal/external-signal-adapters';

describe('fetchGoogleTrendsSignals', () => {
  const original = process.env.GOOGLE_TRENDS_PROVIDER;
  afterEach(() => {
    if (original === undefined) delete process.env.GOOGLE_TRENDS_PROVIDER;
    else process.env.GOOGLE_TRENDS_PROVIDER = original;
  });

  it('returns configured:false with no signals when no provider is set', async () => {
    delete process.env.GOOGLE_TRENDS_PROVIDER;
    const result = await fetchGoogleTrendsSignals();
    expect(result.configured).toBe(false);
    expect(result.signals).toEqual([]);
    expect(result.reason).toMatch(/GOOGLE_TRENDS_PROVIDER/);
  });

  it('still returns configured:false (never fabricates) when a provider name is set but unwired', async () => {
    process.env.GOOGLE_TRENDS_PROVIDER = 'some-provider';
    const result = await fetchGoogleTrendsSignals();
    expect(result.configured).toBe(false);
    expect(result.signals).toHaveLength(0);
  });
});

describe('fetchAbsSignals', () => {
  const original = process.env.ABS_API_ENABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.ABS_API_ENABLED;
    else process.env.ABS_API_ENABLED = original;
  });

  it('returns configured:false with no signals when not enabled', async () => {
    delete process.env.ABS_API_ENABLED;
    const result = await fetchAbsSignals();
    expect(result.configured).toBe(false);
    expect(result.signals).toEqual([]);
    expect(result.reason).toMatch(/ABS_API_ENABLED/);
  });

  it('returns configured:false (never fabricates) when enabled but unwired', async () => {
    process.env.ABS_API_ENABLED = 'true';
    const result = await fetchAbsSignals();
    expect(result.configured).toBe(false);
    expect(result.signals).toHaveLength(0);
  });
});
