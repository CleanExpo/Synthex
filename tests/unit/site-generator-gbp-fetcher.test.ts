import { createGbpProfileFetcher, type GbpClient } from '@/lib/site-generator';
import type {
  GBPLocationSummary,
  GBPReview,
} from '@/lib/google/business-profile';

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
];

/** A fake GBP client that records how it was called. */
function fakeClient(
  overrides: Partial<GbpClient> = {}
): GbpClient & { locationCalls: string[][]; reviewCalls: unknown[][] } {
  const locationCalls: string[][] = [];
  const reviewCalls: unknown[][] = [];
  return {
    locationCalls,
    reviewCalls,
    async getLocationDetails(connectionId, locationName) {
      locationCalls.push([connectionId, locationName]);
      return location;
    },
    async getReviews(connectionId, locationName, options) {
      reviewCalls.push([connectionId, locationName, options]);
      return { reviews };
    },
    ...overrides,
  };
}

describe('createGbpProfileFetcher — live GBP → BusinessProfile', () => {
  it('fetches location + reviews and normalises them', async () => {
    const client = fakeClient();
    const fetcher = createGbpProfileFetcher(client, 'conn-123');

    const profile = await fetcher.fetch('accounts/1/locations/2');

    expect(profile.name).toBe('Brisbane Blocked Drains');
    expect(profile.url).toBe('https://brisbaneblockeddrains.com.au');
    expect(profile.rating).toEqual({ value: 5, count: 1 });
    // connectionId + locationName are threaded through to the client.
    expect(client.locationCalls[0]).toEqual([
      'conn-123',
      'accounts/1/locations/2',
    ]);
    // Default review page size is applied.
    expect(client.reviewCalls[0]).toEqual([
      'conn-123',
      'accounts/1/locations/2',
      { pageSize: 20 },
    ]);
  });

  it('honours reviewPageSize and FromGbpOptions', async () => {
    const client = fakeClient();
    const fetcher = createGbpProfileFetcher(client, 'conn-123', {
      reviewPageSize: 5,
      logoUrl: 'https://cdn.example/logo.svg',
    });

    const profile = await fetcher.fetch('accounts/1/locations/2');

    expect(client.reviewCalls[0][2]).toEqual({ pageSize: 5 });
    expect(profile.logoUrl).toBe('https://cdn.example/logo.svg');
  });

  it('degrades to a rating-less profile when reviews fail (best-effort)', async () => {
    const client = fakeClient({
      async getReviews() {
        throw new Error('reviews API 403');
      },
    });
    const fetcher = createGbpProfileFetcher(client, 'conn-123');

    const profile = await fetcher.fetch('accounts/1/locations/2');

    // Location still resolves; the reviews failure is swallowed.
    expect(profile.name).toBe('Brisbane Blocked Drains');
    expect(profile.rating).toBeUndefined();
    expect(profile.reviews).toBeUndefined();
  });

  it('propagates a location-fetch failure (not swallowed)', async () => {
    const client = fakeClient({
      async getLocationDetails() {
        throw new Error('location API 404');
      },
    });
    const fetcher = createGbpProfileFetcher(client, 'conn-123');

    await expect(fetcher.fetch('accounts/1/locations/2')).rejects.toThrow(
      /location API 404/
    );
  });
});
