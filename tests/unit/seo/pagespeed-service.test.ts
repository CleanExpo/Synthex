/**
 * Honesty test (backlog #9) — runPageSpeedAnalysis must NEVER fabricate scores.
 * When the PageSpeed Insights API is unreachable it returns available:false +
 * scores:null so the UI states unavailability instead of inventing 91/95.
 */

jest.mock('@/lib/prisma', () => ({ prisma: {} }));

import { runPageSpeedAnalysis } from '@/lib/seo/pagespeed-service';

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
  jest.restoreAllMocks();
});

describe('runPageSpeedAnalysis — never fabricates scores (#9)', () => {
  test('network failure → available:false, scores:null, empty lists', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const r = await runPageSpeedAnalysis('https://example.com', 'mobile');

    expect(r.available).toBe(false);
    expect(r.scores).toBeNull();
    expect(r.fieldMetrics).toBeNull();
    expect(r.opportunities).toEqual([]);
    expect(r.diagnostics).toEqual([]);
  });

  test('non-OK API response → available:false, scores:null (no invented 91/95)', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 429 }) as unknown as typeof fetch;

    const r = await runPageSpeedAnalysis('https://example.com', 'desktop');

    expect(r.available).toBe(false);
    expect(r.scores).toBeNull();
  });

  test('successful API response → available:true with the real scores', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        lighthouseResult: {
          categories: {
            performance: { score: 0.9 },
            seo: { score: 0.8 },
            accessibility: { score: 0.95 },
            'best-practices': { score: 0.85 },
          },
          audits: {},
        },
        loadingExperience: {},
      }),
    }) as unknown as typeof fetch;

    const r = await runPageSpeedAnalysis('https://example.com', 'mobile');

    expect(r.available).toBe(true);
    expect(r.scores).toEqual({
      performance: 90,
      seo: 80,
      accessibility: 95,
      bestPractices: 85,
    });
  });
});
