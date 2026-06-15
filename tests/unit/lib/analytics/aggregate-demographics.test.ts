/**
 * Unit tests for lib/analytics/aggregate-demographics.ts
 *
 * Locks:
 *  - aggregation sums real per-connection counts and recomputes org-wide
 *    percentages (audience-weighted);
 *  - no connection with demographics → dataAvailable:false + empty arrays
 *    (honest empty-state, no fabrication).
 */

import {
  aggregateConnectionDemographics,
  type ConnectionDemographicsMetadata,
} from '@/lib/analytics/aggregate-demographics';

function meta(
  d: ConnectionDemographicsMetadata['demographics']
): ConnectionDemographicsMetadata {
  return { demographics: d };
}

describe('aggregateConnectionDemographics — real aggregation', () => {
  it('sums counts across connections and recomputes percentages', () => {
    const result = aggregateConnectionDemographics([
      meta({
        ageRanges: [
          { range: '25-34', percentage: 60, count: 600 },
          { range: '35-44', percentage: 40, count: 400 },
        ],
        genderSplit: [
          { gender: 'Female', percentage: 70, count: 700 },
          { gender: 'Male', percentage: 30, count: 300 },
        ],
        topLocations: [
          { location: 'United States', country: 'US', percentage: 60, count: 600 },
          { location: 'Australia', country: 'AU', percentage: 40, count: 400 },
        ],
      }),
      meta({
        ageRanges: [{ range: '25-34', percentage: 100, count: 1000 }],
        genderSplit: [{ gender: 'Male', percentage: 100, count: 1000 }],
        topLocations: [
          { location: 'Australia', country: 'AU', percentage: 100, count: 1000 },
        ],
      }),
    ]);

    expect(result.dataAvailable).toBe(true);

    // Ages: 25-34 = 600 + 1000 = 1600; 35-44 = 400. total = 2000.
    const byRange = Object.fromEntries(result.ageRanges.map(a => [a.range, a]));
    expect(byRange['25-34'].count).toBe(1600);
    expect(byRange['25-34'].percentage).toBe(80);
    expect(byRange['35-44'].percentage).toBe(20);

    // Gender: Female 700, Male 1300. total 2000.
    const byGender = Object.fromEntries(
      result.genderSplit.map(g => [g.gender, g])
    );
    expect(byGender['Male'].count).toBe(1300);
    expect(byGender['Male'].percentage).toBe(65);

    // Location: AU = 400 + 1000 = 1400 (now the biggest), US = 600. total 2000.
    expect(result.topLocations[0].country).toBe('AU');
    expect(result.topLocations[0].count).toBe(1400);
    expect(result.topLocations[0].percentage).toBe(70);
  });

  it('falls back to averaging percentages when counts are absent', () => {
    const result = aggregateConnectionDemographics([
      meta({ ageRanges: [{ range: '25-34', percentage: 40 }] }),
      meta({ ageRanges: [{ range: '25-34', percentage: 60 }] }),
    ]);
    expect(result.ageRanges[0].percentage).toBe(50);
  });
});

describe('aggregateConnectionDemographics — honest empty-state', () => {
  it('returns dataAvailable:false and empty arrays when nothing stored', () => {
    const result = aggregateConnectionDemographics([
      null,
      undefined,
      {},
      meta({ ageRanges: [], genderSplit: [], topLocations: [] }),
    ]);
    expect(result.dataAvailable).toBe(false);
    expect(result.ageRanges).toEqual([]);
    expect(result.genderSplit).toEqual([]);
    expect(result.topLocations).toEqual([]);
    expect(result.topLanguages).toEqual([]);
  });

  it('caps top locations at 6', () => {
    const locs = Array.from({ length: 10 }, (_, i) => ({
      location: `C${i}`,
      country: `C${i}`,
      percentage: 10,
      count: 100 - i,
    }));
    const result = aggregateConnectionDemographics([meta({ topLocations: locs })]);
    expect(result.topLocations).toHaveLength(6);
  });
});
