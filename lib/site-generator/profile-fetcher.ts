/**
 * BusinessProfile sources for the site generator.
 *
 * The generator (builder.ts) consumes a normalised {@link BusinessProfile}. This
 * module is the seam that PRODUCES one — from a Google Business Profile, a
 * fixture, or (later) a public Places / Outscraper / Firecrawl fetch. Keeping
 * the fetch behind a `ProfileFetcher` interface means the whole "GBP → site"
 * flow exists end-to-end now; a real API key drops into a fetcher without
 * touching the generator.
 *
 * The GBP adapter imports ONLY the types from `@/lib/google/business-profile`
 * (`import type`, erased at compile time) so this module stays free of that
 * module's OAuth/network runtime dependencies.
 */

import type {
  GBPLocationSummary,
  GBPReview,
} from '@/lib/google/business-profile';
import type { BusinessProfile, BusinessReview, BusinessService } from './types';

/** Produces a normalised BusinessProfile from some source query (URL, place id, slug). */
export interface ProfileFetcher {
  fetch(query: string): Promise<BusinessProfile>;
}

const STAR_RATING_TO_NUMBER: Record<GBPReview['starRating'], number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

export interface FromGbpOptions {
  /** Used when the GBP location has no websiteUri. */
  fallbackUrl?: string;
  /** ISO country when the location address omits a regionCode. Default 'AU'. */
  defaultCountry?: string;
  /** Absolute logo URL to attach (GBP does not expose one). */
  logoUrl?: string;
  /**
   * Explicit coverage locality for a service-area business that has no
   * storefront address (e.g. a national AU/NZ trade like Disaster Recovery).
   * Authoritative over any locality derived from the GBP service area — a
   * national business is a coverage descriptor ("Australia and New Zealand"),
   * not a single suburb.
   */
  serviceAreaLabel?: string;
  /**
   * When true, {@link serviceAreaLabel} wins even over a storefront address.
   * For a declared-national brand (in the app's SERVICE_AREA_LABELS registry)
   * whose GBP listing happens to carry a head-office address, that suburb is
   * not the coverage story — e.g. RestoreAssist is national SaaS listed with an
   * Eastern Heights address, but reads as "Australia and New Zealand". Default
   * false, so a genuine local business still shows its own suburb.
   */
  forceServiceAreaLabel?: boolean;
}

/**
 * Normalise a Google Business Profile location (+ its reviews) into the
 * generator's BusinessProfile. Categories become services (primary is the
 * hero); reviews become the aggregate rating.
 */
export function fromGbpLocation(
  location: GBPLocationSummary,
  reviews: GBPReview[] = [],
  opts: FromGbpOptions = {}
): BusinessProfile {
  const url = location.websiteUri ?? opts.fallbackUrl;
  if (!url) {
    throw new Error(
      'fromGbpLocation: location has no websiteUri and no fallbackUrl was provided'
    );
  }

  // Storefront locality wins by default; otherwise fall back to an explicit
  // coverage label (national/service-area businesses), then to a locality
  // derived from the GBP service area. Service-area businesses (no storefront)
  // are common in the trades the generator targets, so this must not
  // hard-require an address. A declared-national brand (forceServiceAreaLabel)
  // overrides even a storefront address — its coverage, not its head office.
  const forcedLabel =
    opts.forceServiceAreaLabel && opts.serviceAreaLabel
      ? opts.serviceAreaLabel
      : undefined;
  const locality =
    forcedLabel ??
    location.address?.locality ??
    opts.serviceAreaLabel ??
    deriveServiceAreaLocality(location.serviceArea);
  if (!locality) {
    throw new Error(
      'fromGbpLocation: no locality — location has no storefront address, no serviceAreaLabel, and no service area'
    );
  }

  const services = toServices(location);
  if (services.length === 0) {
    throw new Error(
      'fromGbpLocation: location has no primaryCategory to derive a service from'
    );
  }

  const mappedReviews: BusinessReview[] = reviews
    .filter(r => r.comment && r.comment.trim().length > 0)
    .map(r => ({
      author: r.reviewer.displayName,
      rating: STAR_RATING_TO_NUMBER[r.starRating],
      text: r.comment as string,
    }));

  const profile: BusinessProfile = {
    name: location.locationName,
    url,
    address: {
      streetAddress: location.address?.addressLines?.[0],
      addressLocality: locality,
      addressRegion: location.address?.administrativeArea,
      postalCode: location.address?.postalCode,
      addressCountry:
        location.address?.regionCode ?? opts.defaultCountry ?? 'AU',
    },
    services,
  };

  if (location.primaryPhone) profile.telephone = location.primaryPhone;
  if (opts.logoUrl) profile.logoUrl = opts.logoUrl;
  if (mappedReviews.length > 0) {
    profile.reviews = mappedReviews;
    profile.rating = {
      value: round1(
        reviews.reduce(
          (sum, r) => sum + STAR_RATING_TO_NUMBER[r.starRating],
          0
        ) / reviews.length
      ),
      count: reviews.length,
    };
  }

  return profile;
}

/**
 * Best-effort locality from a GBP service area, for a service-area business
 * with no configured serviceAreaLabel. Defensive: tolerates the field being
 * absent or shaped unexpectedly, returning undefined rather than injecting a
 * junk locality. One or two place names read naturally; more collapse to
 * "<first> and surrounding areas".
 */
function deriveServiceAreaLocality(
  serviceArea: GBPLocationSummary['serviceArea']
): string | undefined {
  const names = serviceArea?.places?.placeInfos
    ?.map(p => p?.placeName)
    .filter((n): n is string => Boolean(n && n.trim()));
  if (!names || names.length === 0) return undefined;
  return names.length <= 2
    ? names.join(' and ')
    : `${names[0]} and surrounding areas`;
}

function toServices(location: GBPLocationSummary): BusinessService[] {
  const cats = [
    location.primaryCategory,
    ...(location.additionalCategories ?? []),
  ].filter((c): c is { displayName: string; categoryId?: string } =>
    Boolean(c?.displayName)
  );

  const seen = new Set<string>();
  const services: BusinessService[] = [];
  for (const c of cats) {
    const slug = slugify(c.displayName);
    if (slug && !seen.has(slug)) {
      seen.add(slug);
      services.push({ slug, label: c.displayName.toLowerCase() });
    }
  }
  return services;
}

/**
 * A fetcher backed by a static profile — the cred-free default for tests, dev,
 * and demos. Ignores the query and returns the injected profile.
 */
export class FixtureProfileFetcher implements ProfileFetcher {
  constructor(private readonly profile: BusinessProfile) {}
  async fetch(): Promise<BusinessProfile> {
    return this.profile;
  }
}

/**
 * The slice of `@/lib/google/business-profile` the GBP fetcher calls. Declared
 * structurally and injected — the site-generator module never statically
 * imports that module's OAuth/network runtime, so importing the generator
 * barrel stays cred-free. The composition root (an API route) passes the real
 * `getLocationDetails` / `getReviews`; tests pass a fake.
 */
export interface GbpClient {
  getLocationDetails(
    connectionId: string,
    locationName: string
  ): Promise<GBPLocationSummary>;
  getReviews(
    connectionId: string,
    locationName: string,
    options?: { pageSize?: number }
  ): Promise<{ reviews: GBPReview[] }>;
}

export interface GbpFetcherOptions extends FromGbpOptions {
  /** How many reviews to pull for the aggregate rating. Default 20. */
  reviewPageSize?: number;
}

/**
 * A live ProfileFetcher backed by the Google Business Profile client. The
 * `fetch(query)` argument is the GBP location resource name
 * (`accounts/{id}/locations/{id}`); it calls the injected client, then
 * normalises via {@link fromGbpLocation}. Reviews are best-effort — a reviews
 * failure degrades to a profile without an aggregate rating rather than failing
 * the whole fetch.
 */
export function createGbpProfileFetcher(
  client: GbpClient,
  connectionId: string,
  opts: GbpFetcherOptions = {}
): ProfileFetcher {
  const { reviewPageSize = 20, ...fromGbpOpts } = opts;
  return {
    async fetch(locationName: string): Promise<BusinessProfile> {
      const location = await client.getLocationDetails(
        connectionId,
        locationName
      );
      let reviews: GBPReview[] = [];
      try {
        const res = await client.getReviews(connectionId, locationName, {
          pageSize: reviewPageSize,
        });
        reviews = res.reviews;
      } catch {
        // Reviews are non-essential — proceed without the aggregate rating.
      }
      return fromGbpLocation(location, reviews, fromGbpOpts);
    },
  };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
