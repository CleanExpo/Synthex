/**
 * No-fabrication regression for the legacy (service-account) Search Console path.
 *
 * Before: getSearchAnalytics() silently returned hardcoded demo numbers
 * (e.g. "marketing automation" — 245 clicks, position 8.3) when
 * GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON was unset, injecting invented ranking
 * data into rank-tracker, competitor-displacement, keyword-opportunities and the
 * analytics API. CLAUDE.md / north-star: metrics are real or DATA_REQUIRED —
 * never invented.
 *
 * After: an unconfigured call returns an honest empty result flagged
 * `configured: false`, and keyword opportunities resolve to [] — no fake rows.
 */

import {
  getSearchAnalytics,
  getTopKeywordOpportunities,
} from '@/lib/google/search-console';

describe('search-console (service account) — never fabricates when unconfigured', () => {
  const original = process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON;

  beforeEach(() => {
    delete process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON;
  });

  afterAll(() => {
    if (original === undefined) {
      delete process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON;
    } else {
      process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON = original;
    }
  });

  it('returns an empty, unconfigured result (no demo data) when no service account is set', async () => {
    const result = await getSearchAnalytics('https://example.com', {
      dimensions: ['query'],
    });

    expect(result.configured).toBe(false);
    expect(result.rows).toEqual([]);
    expect(result.totals).toEqual({
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
    });
  });

  it('does NOT return the old hardcoded demo rows', async () => {
    const result = await getSearchAnalytics('https://example.com', {
      dimensions: ['query'],
    });

    // The removed demo data had these tells — they must never appear again.
    expect(result.rows.some(r => r.keys?.[0] === 'marketing automation')).toBe(false);
    expect(result.rows.some(r => r.clicks === 245)).toBe(false);
    expect(result.totals.clicks).toBe(0);
  });

  it('yields no keyword opportunities when unconfigured (no fabricated opportunities)', async () => {
    const opportunities = await getTopKeywordOpportunities('https://example.com', 5);
    expect(opportunities).toEqual([]);
  });
});
