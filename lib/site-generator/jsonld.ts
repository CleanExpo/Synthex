/**
 * schema.org JSON-LD builder for the multi-tenant site generator.
 *
 * Emits a single @graph with:
 *   - LocalBusiness — the business's primary listing (name, contact, geo,
 *     aggregateRating).
 *   - Service       — the hero service, provided by the LocalBusiness, served
 *     in the target locality.
 *   - FAQPage       — the page's Q&A (only when FAQs are present).
 *
 * Driven by the BusinessProfile (facts) + SiteBrand (name/logo). Pure — no I/O.
 */

import type {
  BusinessProfile,
  BusinessService,
  SiteBrand,
  SiteCopy,
} from './types';

const SCHEMA_CONTEXT = 'https://schema.org';

export interface BuildJsonLdInput {
  brand: SiteBrand;
  profile: BusinessProfile;
  heroService: BusinessService;
  canonicalUrl: string;
  copy: SiteCopy;
}

export function buildSiteJsonLd(
  input: BuildJsonLdInput
): Record<string, unknown> {
  const { brand, profile, heroService, canonicalUrl, copy } = input;
  const orgId = `${trimSlash(profile.url)}#organization`;

  const address: Record<string, unknown> = {
    '@type': 'PostalAddress',
    addressLocality: profile.address.addressLocality,
    addressCountry: profile.address.addressCountry,
  };
  if (profile.address.streetAddress)
    address.streetAddress = profile.address.streetAddress;
  if (profile.address.addressRegion)
    address.addressRegion = profile.address.addressRegion;
  if (profile.address.postalCode)
    address.postalCode = profile.address.postalCode;

  const localBusiness: Record<string, unknown> = {
    '@type': 'LocalBusiness',
    '@id': orgId,
    name: profile.name,
    legalName: profile.legalName ?? profile.name,
    url: profile.url,
    logo: profile.logoUrl ?? brand.logoPrimary,
    address,
  };
  if (profile.telephone) localBusiness.telephone = profile.telephone;
  if (profile.geo) {
    localBusiness.geo = {
      '@type': 'GeoCoordinates',
      latitude: profile.geo.lat,
      longitude: profile.geo.lng,
    };
  }
  if (profile.rating) {
    localBusiness.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: profile.rating.value,
      reviewCount: profile.rating.count,
    };
  }
  if (profile.certifications && profile.certifications.length > 0) {
    localBusiness.hasCredential = profile.certifications.map(name => ({
      '@type': 'EducationalOccupationalCredential',
      name,
    }));
  }

  const service: Record<string, unknown> = {
    '@type': 'Service',
    '@id': `${trimSlash(canonicalUrl)}#service`,
    name: `${capitalise(heroService.label)} in ${profile.address.addressLocality}`,
    serviceType: heroService.label,
    provider: { '@id': orgId },
    areaServed: {
      '@type': 'Place',
      name: profile.address.addressLocality,
      address: {
        '@type': 'PostalAddress',
        addressLocality: profile.address.addressLocality,
        addressCountry: profile.address.addressCountry,
      },
    },
    url: canonicalUrl,
  };

  const graph: Record<string, unknown>[] = [localBusiness, service];

  if (copy.faqs.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${trimSlash(canonicalUrl)}#faq`,
      mainEntity: copy.faqs.map(f => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    });
  }

  return { '@context': SCHEMA_CONTEXT, '@graph': graph };
}

function trimSlash(s: string): string {
  return s.replace(/\/+$/, '');
}

function capitalise(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
