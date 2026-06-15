/**
 * Unit tests for lib/social/instagram-demographics.ts
 *
 * Locks:
 *  - a REAL Instagram Graph API audience_gender_age + audience_country response
 *    parses into age/gender/location percentages that sum sensibly;
 *  - an account that exposes NO demographics (missing metrics / empty maps)
 *    yields EMPTY arrays — never fabricated buckets.
 */

import {
  parseInstagramDemographics,
  hasDemographics,
  type IGDemographicInsightsResponse,
} from '@/lib/social/instagram-demographics';

/**
 * A realistic IG insights response for the two demographic metrics. Values are
 * keyed maps exactly as the Graph API returns them (gender.age buckets and
 * ISO-3166 alpha-2 country codes).
 */
const REAL_RESPONSE: IGDemographicInsightsResponse = {
  data: [
    {
      name: 'audience_gender_age',
      values: [
        {
          value: {
            'F.18-24': 300,
            'F.25-34': 700,
            'M.18-24': 200,
            'M.25-34': 500,
            'U.35-44': 300,
          },
        },
      ],
    },
    {
      name: 'audience_country',
      values: [{ value: { US: 1200, AU: 500, GB: 300 } }],
    },
  ],
};

describe('parseInstagramDemographics — real Graph response', () => {
  const demo = parseInstagramDemographics(REAL_RESPONSE);

  it('parses age ranges summed across genders with percentages of total', () => {
    // total = 2000. 18-24 = 300+200 = 500 (25%); 25-34 = 700+500 = 1200 (60%);
    // 35-44 = 300 (15%).
    const byRange = Object.fromEntries(
      demo.ageRanges.map(a => [a.range, a])
    );
    expect(byRange['18-24'].count).toBe(500);
    expect(byRange['18-24'].percentage).toBe(25);
    expect(byRange['25-34'].count).toBe(1200);
    expect(byRange['25-34'].percentage).toBe(60);
    expect(byRange['35-44'].percentage).toBe(15);

    const sum = demo.ageRanges.reduce((s, a) => s + a.percentage, 0);
    expect(Math.round(sum)).toBe(100);
  });

  it('parses gender split summed across ages, ordered Female/Male/Other', () => {
    expect(demo.genderSplit.map(g => g.gender)).toEqual([
      'Female',
      'Male',
      'Other',
    ]);
    const byGender = Object.fromEntries(
      demo.genderSplit.map(g => [g.gender, g])
    );
    expect(byGender['Female'].count).toBe(1000); // 300 + 700
    expect(byGender['Female'].percentage).toBe(50);
    expect(byGender['Male'].count).toBe(700); // 200 + 500
    expect(byGender['Other'].count).toBe(300);
  });

  it('parses top locations with country names + codes, sorted by size', () => {
    expect(demo.topLocations.map(l => l.country)).toEqual(['US', 'AU', 'GB']);
    expect(demo.topLocations[0].location).toBe('United States');
    // total = 2000; US = 1200 → 60%.
    expect(demo.topLocations[0].percentage).toBe(60);
    expect(demo.topLocations[1].location).toBe('Australia');
  });

  it('hasDemographics is true for a real response', () => {
    expect(hasDemographics(demo)).toBe(true);
  });
});

describe('parseInstagramDemographics — account without demographics (no fabrication)', () => {
  it('returns empty arrays when metrics are entirely absent', () => {
    const demo = parseInstagramDemographics({ data: [] });
    expect(demo.ageRanges).toEqual([]);
    expect(demo.genderSplit).toEqual([]);
    expect(demo.topLocations).toEqual([]);
    expect(hasDemographics(demo)).toBe(false);
  });

  it('returns empty arrays for null/undefined response', () => {
    expect(parseInstagramDemographics(null).ageRanges).toEqual([]);
    expect(parseInstagramDemographics(undefined).topLocations).toEqual([]);
  });

  it('ignores zero/negative/non-numeric values rather than inventing buckets', () => {
    const demo = parseInstagramDemographics({
      data: [
        {
          name: 'audience_gender_age',
          values: [{ value: { 'F.25-34': 0, 'M.25-34': -5 } }],
        },
        { name: 'audience_country', values: [{ value: {} }] },
      ],
    });
    expect(demo.ageRanges).toEqual([]);
    expect(demo.genderSplit).toEqual([]);
    expect(demo.topLocations).toEqual([]);
  });

  it('falls back to raw country code when name is unknown', () => {
    const demo = parseInstagramDemographics({
      data: [{ name: 'audience_country', values: [{ value: { XX: 100 } }] }],
    });
    expect(demo.topLocations[0].location).toBe('XX');
    expect(demo.topLocations[0].country).toBe('XX');
    expect(demo.topLocations[0].percentage).toBe(100);
  });
});
