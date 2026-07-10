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

  const locality = location.address?.locality;
  if (!locality) {
    throw new Error('fromGbpLocation: location address has no locality');
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

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
