/**
 * Pure JSON-LD builder for DR per-suburb landing pages.
 *
 * Emits a single graph with:
 *   - LocalBusiness (DR's primary listing)
 *   - Service (the specific water-damage / fire / mould service)
 *   - Place (the suburb the page targets)
 *
 * Never embeds contractor PII (names, phone numbers, addresses) per
 * Q3.2.5 P10 — the page represents DR's coverage, not any individual
 * contractor.
 *
 * @see SYN-838 (parent: SYN-834 epic)
 */

import {
  SERVICE_CATEGORY_LABEL,
  type BrandIdentity,
  type DrServiceCategory,
} from './types';

const SCHEMA_CONTEXT = 'https://schema.org';

interface JsonLdInput {
  brand: BrandIdentity;
  serviceCategory: DrServiceCategory;
  suburb: string;
  postcode: string;
  canonicalUrl: string;
}

export function buildLandingPageJsonLd(
  input: JsonLdInput
): Record<string, unknown> {
  const { brand, serviceCategory, suburb, postcode, canonicalUrl } = input;
  const serviceLabel = SERVICE_CATEGORY_LABEL[serviceCategory];

  const localBusiness = {
    '@type': 'LocalBusiness',
    '@id': `${brand.url}#organization`,
    name: brand.name,
    legalName: brand.legalName,
    url: brand.url,
    logo: brand.logoUrl,
    telephone: brand.telephone,
    address: {
      '@type': 'PostalAddress',
      addressLocality: brand.hq.addressLocality,
      addressCountry: 'AU',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: brand.hq.lat,
      longitude: brand.hq.lng,
    },
  };

  const place = {
    '@type': 'Place',
    name: suburb,
    address: {
      '@type': 'PostalAddress',
      addressLocality: suburb,
      postalCode: postcode,
      addressCountry: 'AU',
    },
  };

  const service = {
    '@type': 'Service',
    '@id': `${canonicalUrl}#service`,
    name: `${capitalise(serviceLabel)} in ${suburb}`,
    serviceType: serviceLabel,
    provider: { '@id': `${brand.url}#organization` },
    areaServed: place,
    url: canonicalUrl,
  };

  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': [localBusiness, service],
  };
}

function capitalise(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
