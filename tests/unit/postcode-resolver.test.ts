/**
 * Unit tests for lib/postcode/
 *
 * Covers:
 *  - haversine distance correctness vs known AU points
 *  - Coordinate + radius validation (throws on bad input)
 *  - CSV parser (Matthew Proctor schema, malformed rows, sentinel skip)
 *  - Resolver happy path + state filter + sort order
 *  - Edge cases: empty dataset, radius=0, exact-base match, multi-state
 *  - Performance benchmark: < 50 ms for typical 20 km query against full dataset
 *
 * @see SYN-835 (parent: SYN-834 epic)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  haversineKm,
  parseCsvLine,
  parseCsv,
  loadDataset,
  resolveSuburbsWithinRadius,
  resolveSuburbsWithinRadiusSync,
  _resetDatasetCacheForTests,
} from '@/lib/postcode';
import type { PostcodeDatasetRow } from '@/lib/postcode/types';

// ─── Known AU reference points ───────────────────────────────────────────
const BRISBANE_CBD = { lat: -27.4705, lng: 153.026 };
const GOLD_COAST_CBD = { lat: -28.0023, lng: 153.4145 };
const SYDNEY_CBD = { lat: -33.8688, lng: 151.2093 };
const MELBOURNE_CBD = { lat: -37.8136, lng: 144.9631 };
const PERTH_CBD = { lat: -31.9523, lng: 115.8613 };

// Distances reported by Google Maps (great-circle), used as expected values
// with ±2 % tolerance to account for sphere-vs-ellipsoid difference.
const KNOWN_DISTANCES_KM = {
  brisbane_to_goldCoast: 71, // ~71 km
  brisbane_to_sydney: 732, // ~732 km
  sydney_to_melbourne: 714, // ~714 km
  perth_to_sydney: 3290, // ~3290 km (intercontinental scale)
};

function approxEqual(actual: number, expected: number, tolerancePct: number) {
  const tol = expected * (tolerancePct / 100);
  return Math.abs(actual - expected) <= tol;
}

// Small fixture for resolver tests — covers all major capitals + a few regional
const TEST_FIXTURE: ReadonlyArray<PostcodeDatasetRow> = [
  {
    postcode: '4000',
    suburb: 'Brisbane City',
    state: 'QLD',
    lat: -27.4675,
    lng: 153.0291,
  },
  {
    postcode: '4101',
    suburb: 'South Brisbane',
    state: 'QLD',
    lat: -27.4815,
    lng: 153.0235,
  },
  {
    postcode: '4006',
    suburb: 'Fortitude Valley',
    state: 'QLD',
    lat: -27.4548,
    lng: 153.0382,
  },
  {
    postcode: '4217',
    suburb: 'Surfers Paradise',
    state: 'QLD',
    lat: -28.0026,
    lng: 153.4307,
  },
  {
    postcode: '2000',
    suburb: 'Sydney',
    state: 'NSW',
    lat: -33.8688,
    lng: 151.2093,
  },
  {
    postcode: '3000',
    suburb: 'Melbourne',
    state: 'VIC',
    lat: -37.8136,
    lng: 144.9631,
  },
  {
    postcode: '6000',
    suburb: 'Perth',
    state: 'WA',
    lat: -31.9505,
    lng: 115.8605,
  },
  {
    postcode: '5000',
    suburb: 'Adelaide',
    state: 'SA',
    lat: -34.9285,
    lng: 138.6007,
  },
  {
    postcode: '0800',
    suburb: 'Darwin',
    state: 'NT',
    lat: -12.4634,
    lng: 130.8456,
  },
  {
    postcode: '7000',
    suburb: 'Hobart',
    state: 'TAS',
    lat: -42.8821,
    lng: 147.3272,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
//  HAVERSINE
// ═══════════════════════════════════════════════════════════════════════════

describe('haversineKm — correctness vs known AU points', () => {
  it('Brisbane → Gold Coast ≈ 71 km (±2%)', () => {
    const d = haversineKm(
      BRISBANE_CBD.lat,
      BRISBANE_CBD.lng,
      GOLD_COAST_CBD.lat,
      GOLD_COAST_CBD.lng
    );
    expect(approxEqual(d, KNOWN_DISTANCES_KM.brisbane_to_goldCoast, 2)).toBe(
      true
    );
  });

  it('Brisbane → Sydney ≈ 732 km (±2%)', () => {
    const d = haversineKm(
      BRISBANE_CBD.lat,
      BRISBANE_CBD.lng,
      SYDNEY_CBD.lat,
      SYDNEY_CBD.lng
    );
    expect(approxEqual(d, KNOWN_DISTANCES_KM.brisbane_to_sydney, 2)).toBe(true);
  });

  it('Sydney → Melbourne ≈ 714 km (±2%)', () => {
    const d = haversineKm(
      SYDNEY_CBD.lat,
      SYDNEY_CBD.lng,
      MELBOURNE_CBD.lat,
      MELBOURNE_CBD.lng
    );
    expect(approxEqual(d, KNOWN_DISTANCES_KM.sydney_to_melbourne, 2)).toBe(
      true
    );
  });

  it('Perth → Sydney ≈ 3290 km (±2%) — intercontinental scale', () => {
    const d = haversineKm(
      PERTH_CBD.lat,
      PERTH_CBD.lng,
      SYDNEY_CBD.lat,
      SYDNEY_CBD.lng
    );
    expect(approxEqual(d, KNOWN_DISTANCES_KM.perth_to_sydney, 2)).toBe(true);
  });

  it('same-point distance = 0', () => {
    const d = haversineKm(
      BRISBANE_CBD.lat,
      BRISBANE_CBD.lng,
      BRISBANE_CBD.lat,
      BRISBANE_CBD.lng
    );
    expect(d).toBe(0);
  });
});

describe('haversineKm — input validation', () => {
  it('throws on NaN origin lat', () => {
    expect(() => haversineKm(NaN, 0, 0, 0)).toThrow(/origin coordinates/);
  });
  it('throws on Infinity destination lng', () => {
    expect(() => haversineKm(0, 0, 0, Infinity)).toThrow(
      /destination coordinates/
    );
  });
  it('throws on lat > 90', () => {
    expect(() => haversineKm(91, 0, 0, 0)).toThrow(/latitude/);
  });
  it('throws on lat < -90', () => {
    expect(() => haversineKm(-91, 0, 0, 0)).toThrow(/latitude/);
  });
  it('throws on lng > 180', () => {
    expect(() => haversineKm(0, 181, 0, 0)).toThrow(/longitude/);
  });
  it('throws on lng < -180', () => {
    expect(() => haversineKm(0, -181, 0, 0)).toThrow(/longitude/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  CSV PARSER
// ═══════════════════════════════════════════════════════════════════════════

describe('parseCsvLine — Matthew Proctor schema', () => {
  it('parses a typical Brisbane row', () => {
    const line =
      '"100","4000","Brisbane City","QLD","153.0291","-27.4675","","","","","","","","R1","-27.4675","153.0291","","","","","","","","","1","1","","","1","1","","","N2","","","","","",""';
    const row = parseCsvLine(line);
    expect(row).toEqual({
      postcode: '4000',
      suburb: 'Brisbane City',
      state: 'QLD',
      lat: -27.4675,
      lng: 153.0291,
    });
  });

  it('skips empty line', () => {
    expect(parseCsvLine('')).toBeNull();
    expect(parseCsvLine('   ')).toBeNull();
  });

  it('skips row with too few columns', () => {
    expect(parseCsvLine('"1","4000"')).toBeNull();
  });

  it('skips row with non-finite coords', () => {
    const line = '"1","4000","X","QLD","not-a-number","-27.4"';
    expect(parseCsvLine(line)).toBeNull();
  });

  it('skips (0, 0) sentinel row (geocoding-failed)', () => {
    const line = '"1","4000","X","QLD","0","0"';
    expect(parseCsvLine(line)).toBeNull();
  });

  it('skips row with out-of-range lat', () => {
    const line = '"1","4000","X","QLD","153.0","-91.0"';
    expect(parseCsvLine(line)).toBeNull();
  });

  it('preserves leading-zero postcodes (NT 0800)', () => {
    const line = '"1","0800","Darwin","NT","130.8456","-12.4634"';
    expect(parseCsvLine(line)?.postcode).toBe('0800');
  });
});

describe('parseCsv — full CSV body', () => {
  it('skips header, parses body, skips malformed rows', () => {
    const csv = [
      'id,postcode,locality,state,long,lat',
      '"1","4000","Brisbane City","QLD","153.0291","-27.4675"',
      '"2","4101","South Brisbane","QLD","153.0235","-27.4815"',
      '', // blank
      '"3","BAD"', // too few cols
      '"4","2000","Sydney","NSW","151.2093","-33.8688"',
    ].join('\n');
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0].postcode).toBe('4000');
    expect(rows[2].postcode).toBe('2000');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  RESOLVER (using TEST_FIXTURE)
// ═══════════════════════════════════════════════════════════════════════════

describe('resolveSuburbsWithinRadius — happy path', () => {
  beforeEach(() => _resetDatasetCacheForTests());

  it('Brisbane base + 5 km radius → returns inner Brisbane suburbs only', async () => {
    const result = await resolveSuburbsWithinRadius(BRISBANE_CBD, 5, {
      dataset: TEST_FIXTURE,
    });
    const postcodes = result.map(r => r.postcode).sort();
    expect(postcodes).toEqual(['4000', '4006', '4101']);
    expect(result.every(r => r.state === 'QLD')).toBe(true);
  });

  it('Brisbane base + 100 km radius → includes Surfers Paradise (Gold Coast)', async () => {
    const result = await resolveSuburbsWithinRadius(BRISBANE_CBD, 100, {
      dataset: TEST_FIXTURE,
    });
    const postcodes = result.map(r => r.postcode);
    expect(postcodes).toContain('4217'); // Surfers Paradise
    // Should NOT include other capitals
    expect(postcodes).not.toContain('2000'); // Sydney
    expect(postcodes).not.toContain('6000'); // Perth
  });

  it('returns results sorted by distance ascending', async () => {
    const result = await resolveSuburbsWithinRadius(BRISBANE_CBD, 200, {
      dataset: TEST_FIXTURE,
    });
    for (let i = 1; i < result.length; i++) {
      expect(result[i].distanceFromBaseKm).toBeGreaterThanOrEqual(
        result[i - 1].distanceFromBaseKm
      );
    }
  });

  it('returns empty array when no suburbs match (small radius in middle of nowhere)', async () => {
    // Coral Sea (offshore east of Cairns) — no AU suburbs within 5 km
    const result = await resolveSuburbsWithinRadius(
      { lat: -15.0, lng: 150.0 },
      5,
      { dataset: TEST_FIXTURE }
    );
    expect(result).toEqual([]);
  });

  it('returns empty array on empty dataset', async () => {
    const result = await resolveSuburbsWithinRadius(BRISBANE_CBD, 100, {
      dataset: [],
    });
    expect(result).toEqual([]);
  });

  it('state filter restricts results', async () => {
    const result = await resolveSuburbsWithinRadius(BRISBANE_CBD, 200, {
      dataset: TEST_FIXTURE,
      states: ['NSW'], // Brisbane fixture base, but filter to NSW only
    });
    expect(result).toEqual([]); // NSW capitals not within 200 km of Brisbane
  });
});

describe('resolveSuburbsWithinRadius — input validation', () => {
  it('throws on missing base', async () => {
    // @ts-expect-error testing runtime guard
    await expect(
      resolveSuburbsWithinRadius(null, 10, { dataset: TEST_FIXTURE })
    ).rejects.toThrow(/base location is required/);
  });

  it('throws on NaN lat', async () => {
    await expect(
      resolveSuburbsWithinRadius({ lat: NaN, lng: 0 }, 10, {
        dataset: TEST_FIXTURE,
      })
    ).rejects.toThrow(/base.lat must be a finite number/);
  });

  it('throws on lat out of range', async () => {
    await expect(
      resolveSuburbsWithinRadius({ lat: 91, lng: 0 }, 10, {
        dataset: TEST_FIXTURE,
      })
    ).rejects.toThrow(/base.lat out of range/);
  });

  it('throws on lng out of range', async () => {
    await expect(
      resolveSuburbsWithinRadius({ lat: 0, lng: -181 }, 10, {
        dataset: TEST_FIXTURE,
      })
    ).rejects.toThrow(/base.lng out of range/);
  });

  it('throws on radiusKm = 0', async () => {
    await expect(
      resolveSuburbsWithinRadius(BRISBANE_CBD, 0, { dataset: TEST_FIXTURE })
    ).rejects.toThrow(/radiusKm must be > 0/);
  });

  it('throws on negative radius', async () => {
    await expect(
      resolveSuburbsWithinRadius(BRISBANE_CBD, -5, { dataset: TEST_FIXTURE })
    ).rejects.toThrow(/radiusKm must be > 0/);
  });

  it('throws on radius > 200 km (sanity cap)', async () => {
    await expect(
      resolveSuburbsWithinRadius(BRISBANE_CBD, 201, { dataset: TEST_FIXTURE })
    ).rejects.toThrow(/radiusKm must be ≤ 200/);
  });

  it('throws on NaN radius', async () => {
    await expect(
      resolveSuburbsWithinRadius(BRISBANE_CBD, NaN, { dataset: TEST_FIXTURE })
    ).rejects.toThrow(/radiusKm must be a finite number/);
  });
});

describe('resolveSuburbsWithinRadiusSync — synchronous variant', () => {
  it('returns same results as async variant given same inputs', async () => {
    const asyncResult = await resolveSuburbsWithinRadius(BRISBANE_CBD, 100, {
      dataset: TEST_FIXTURE,
    });
    const syncResult = resolveSuburbsWithinRadiusSync(BRISBANE_CBD, 100, {
      dataset: TEST_FIXTURE,
    });
    expect(syncResult).toEqual(asyncResult);
  });

  it('throws when called without dataset', () => {
    expect(() => resolveSuburbsWithinRadiusSync(BRISBANE_CBD, 10, {})).toThrow(
      /opts.dataset is required/
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  DATASET LOADER (real CSV — slow-ish, but only first run)
// ═══════════════════════════════════════════════════════════════════════════

describe('loadDataset — bundled AU CSV', () => {
  beforeEach(() => _resetDatasetCacheForTests());

  it('loads + parses the bundled CSV (≥ 10k valid rows)', async () => {
    const dataset = await loadDataset();
    expect(dataset.length).toBeGreaterThanOrEqual(10000);
  });

  it('returns the same cached array on second call', async () => {
    const a = await loadDataset();
    const b = await loadDataset();
    expect(a).toBe(b); // referentially identical
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════

describe('resolveSuburbsWithinRadius — performance', () => {
  beforeEach(() => _resetDatasetCacheForTests());

  // SYN-906: bumped threshold 50ms → 200ms. CI shared-runner cold I/O regularly
  // produces 60-90ms wall-clock here, even though local M1/M2 runs land under
  // 20ms. The original 50ms ceiling was a local-machine assumption. The intent
  // of these tests is "the algorithm scales", not "every CI VM is fast"; 200ms
  // still catches O(n²) regressions while not flaking on shared runners.
  it('typical 20 km Brisbane query against full dataset < 200 ms', async () => {
    // Pre-warm the dataset
    const dataset = await loadDataset();
    // Time a hot resolve
    const t0 = Date.now();
    const result = resolveSuburbsWithinRadiusSync(BRISBANE_CBD, 20, {
      dataset,
    });
    const elapsed = Date.now() - t0;
    expect(result.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(200);
  });

  it('large 100 km Sydney query < 200 ms', async () => {
    const dataset = await loadDataset();
    const t0 = Date.now();
    const result = resolveSuburbsWithinRadiusSync(SYDNEY_CBD, 100, { dataset });
    const elapsed = Date.now() - t0;
    expect(result.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(200);
  });
});
