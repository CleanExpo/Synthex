import {
  fromGbpLocation,
  FixtureProfileFetcher,
  generateSiteFromSource,
  type SiteBrand,
} from '@/lib/site-generator';
import type {
  GBPLocationSummary,
  GBPReview,
} from '@/lib/google/business-profile';

const brand: SiteBrand = {
  slug: 'acme',
  displayName: 'Acme',
  logoPrimary: 'https://acme.com.au/logo.svg',
  forbiddenWords: [],
};

const location: GBPLocationSummary = {
  name: 'accounts/1/locations/2',
  locationName: 'Brisbane Blocked Drains',
  address: {
    addressLines: ['10 Trade St'],
    locality: 'Brisbane',
    administrativeArea: 'QLD',
    postalCode: '4000',
    regionCode: 'AU',
  },
  primaryPhone: '+61730000000',
  websiteUri: 'https://brisbaneblockeddrains.com.au',
  primaryCategory: { displayName: 'Drainage Service' },
  additionalCategories: [{ displayName: 'Plumber' }],
};

const reviews: GBPReview[] = [
  {
    name: 'r1',
    reviewId: '1',
    reviewer: { displayName: 'Sam' },
    starRating: 'FIVE',
    comment: 'Fast and tidy.',
    createTime: '',
    updateTime: '',
  },
  {
    name: 'r2',
    reviewId: '2',
    reviewer: { displayName: 'Jo' },
    starRating: 'FOUR',
    comment: 'Good work.',
    createTime: '',
    updateTime: '',
  },
];

describe('fromGbpLocation — GBP → BusinessProfile adapter', () => {
  it('normalises location + reviews into a BusinessProfile', () => {
    const p = fromGbpLocation(location, reviews);

    expect(p.name).toBe('Brisbane Blocked Drains');
    expect(p.url).toBe('https://brisbaneblockeddrains.com.au');
    expect(p.telephone).toBe('+61730000000');
    expect(p.address).toEqual({
      streetAddress: '10 Trade St',
      addressLocality: 'Brisbane',
      addressRegion: 'QLD',
      postalCode: '4000',
      addressCountry: 'AU',
    });
    // primary category is the hero service; categories de-duped + slugified
    expect(p.services[0]).toEqual({
      slug: 'drainage-service',
      label: 'drainage service',
    });
    expect(p.services.map(s => s.slug)).toEqual([
      'drainage-service',
      'plumber',
    ]);
    // reviews → aggregate rating (avg of 5 and 4 = 4.5)
    expect(p.rating).toEqual({ value: 4.5, count: 2 });
    expect(p.reviews).toHaveLength(2);
  });

  it('falls back to fallbackUrl and defaultCountry when GBP omits them', () => {
    const bare: GBPLocationSummary = {
      name: 'accounts/1/locations/3',
      locationName: 'No Website Co',
      address: { locality: 'Cairns' },
      primaryCategory: { displayName: 'Electrician' },
    };
    const p = fromGbpLocation(bare, [], {
      fallbackUrl: 'https://nowebsite.example',
      defaultCountry: 'AU',
    });
    expect(p.url).toBe('https://nowebsite.example');
    expect(p.address.addressCountry).toBe('AU');
    expect(p.rating).toBeUndefined();
  });

  it('throws when there is no website and no fallback', () => {
    const bare: GBPLocationSummary = {
      name: 'x',
      locationName: 'X',
      address: { locality: 'Perth' },
      primaryCategory: { displayName: 'Roofer' },
    };
    expect(() => fromGbpLocation(bare)).toThrow(/no websiteUri/);
  });
});

describe('generateSiteFromSource — end-to-end pipeline', () => {
  it('fetches a profile then generates a valid site section', async () => {
    const fetcher = new FixtureProfileFetcher(
      fromGbpLocation(location, reviews)
    );
    const { profile, result } = await generateSiteFromSource(
      fetcher,
      'ignored-query',
      brand
    );

    expect(profile.name).toBe('Brisbane Blocked Drains');
    expect(result.ok).toBe(true);
    expect(result.slug).toBe('drainage-service');
    expect(result.canonicalUrl).toBe(
      'https://brisbaneblockeddrains.com.au/drainage-service/'
    );

    const graph = result.jsonLd['@graph'] as Array<Record<string, unknown>>;
    const lb = graph.find(n => n['@type'] === 'LocalBusiness')!;
    expect((lb.aggregateRating as Record<string, unknown>).ratingValue).toBe(
      4.5
    );
  });
});
