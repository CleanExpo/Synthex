import {
  fromGbpLocation,
  generateSite,
  type SiteBrand,
} from '@/lib/site-generator';
import type { GBPLocationSummary } from '@/lib/google/business-profile';

// UNI-2368 capstone blocker: service-area businesses (e.g. Disaster Recovery —
// AU + NZ wide, no storefront) have no GBP storefront address, so the old
// fromGbpLocation threw "location address has no locality" and the generate
// 500'd. Service-area businesses are the pilot's whole target segment.

const brand: SiteBrand = {
  slug: 'disaster-recovery',
  displayName: 'Disaster Recovery',
  forbiddenWords: [],
};

// A service-area location: no `address`, no `storefrontAddress`.
const serviceAreaLocation: GBPLocationSummary = {
  name: 'accounts/1/locations/2',
  locationName: 'National Restoration Professionals Group',
  websiteUri: 'https://disasterrecovery.com.au',
  primaryCategory: { displayName: 'Water damage restoration service' },
};

describe('fromGbpLocation — service-area businesses (no storefront)', () => {
  it('uses an explicit serviceAreaLabel as the locality (national coverage)', () => {
    const profile = fromGbpLocation(serviceAreaLocation, [], {
      serviceAreaLabel: 'Australia and New Zealand',
    });
    expect(profile.address.addressLocality).toBe('Australia and New Zealand');

    // and it flows all the way through a valid generated site
    const r = generateSite({ brand, profile });
    expect(r.ok).toBe(true);
    expect(r.copy.headline).toContain('Australia and New Zealand');
  });

  it('derives a locality from the GBP serviceArea places when no label is given', () => {
    const withServiceArea: GBPLocationSummary = {
      ...serviceAreaLocation,
      serviceArea: {
        places: {
          placeInfos: [
            { placeName: 'Brisbane, QLD' },
            { placeName: 'Gold Coast, QLD' },
          ],
        },
      },
    };
    const profile = fromGbpLocation(withServiceArea, [], {});
    expect(profile.address.addressLocality).toContain('Brisbane, QLD');
  });

  it('still throws when there is no address, no label, and no service area', () => {
    expect(() => fromGbpLocation(serviceAreaLocation, [], {})).toThrow(
      /locality/i
    );
  });

  it('prefers a real storefront locality over the serviceAreaLabel', () => {
    const storefront: GBPLocationSummary = {
      ...serviceAreaLocation,
      address: { locality: 'Brisbane', regionCode: 'AU' },
    };
    const profile = fromGbpLocation(storefront, [], {
      serviceAreaLabel: 'Australia and New Zealand',
    });
    expect(profile.address.addressLocality).toBe('Brisbane');
  });

  it('forceServiceAreaLabel overrides even a storefront address (declared-national brand)', () => {
    // RestoreAssist is national SaaS whose GBP listing carries an Eastern
    // Heights head-office address — the coverage label must still win.
    const storefront: GBPLocationSummary = {
      ...serviceAreaLocation,
      address: { locality: 'Eastern Heights', regionCode: 'AU' },
    };
    const profile = fromGbpLocation(storefront, [], {
      serviceAreaLabel: 'Australia and New Zealand',
      forceServiceAreaLabel: true,
    });
    expect(profile.address.addressLocality).toBe('Australia and New Zealand');
  });

  it('forceServiceAreaLabel is inert without a serviceAreaLabel', () => {
    const storefront: GBPLocationSummary = {
      ...serviceAreaLocation,
      address: { locality: 'Eastern Heights', regionCode: 'AU' },
    };
    const profile = fromGbpLocation(storefront, [], {
      forceServiceAreaLabel: true,
    });
    expect(profile.address.addressLocality).toBe('Eastern Heights');
  });
});
