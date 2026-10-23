import { organizationId, type JsonLd, type OrganizationFacts } from './types';

export type OrganizationType = 'Organization' | 'EducationalOrganization';

/**
 * Google documents no required Organization properties; it recommends name,
 * url, logo, description, contact and sameAs (structured-data/organization,
 * last updated 2026-09-08). Only facts that were passed in are emitted.
 */
export function buildOrganization(
  facts: OrganizationFacts,
  options: { type?: OrganizationType } = {}
): JsonLd {
  const org: JsonLd = {
    '@type': options.type ?? 'Organization',
    '@id': organizationId(facts.url),
    name: facts.name,
    url: facts.url,
  };
  if (facts.legalName) org.legalName = facts.legalName;
  if (facts.description) org.description = facts.description;
  if (facts.logo) org.logo = facts.logo;
  if (facts.email) org.email = facts.email;
  if (facts.telephone) org.telephone = facts.telephone;
  if (facts.sameAs && facts.sameAs.length > 0) org.sameAs = facts.sameAs;
  return org;
}
