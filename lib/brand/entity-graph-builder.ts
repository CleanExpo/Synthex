/**
 * Brand Builder — Entity Graph Builder
 *
 * Generates @id-connected JSON-LD entity graph for brand identity.
 * Links Organization, WebSite, and optionally Person schemas via @id anchors.
 *
 * @module lib/brand/entity-graph-builder
 */

import type { BrandIdentityInput, EntityGraph } from './types';

/**
 * Collect sameAs URLs in priority order:
 * Wikidata > Wikipedia > LinkedIn > Crunchbase > YouTube > Twitter > Facebook > Instagram
 */
function buildSameAs(input: BrandIdentityInput): string[] {
  const sameAs: string[] = [];
  if (input.wikidataUrl)   sameAs.push(input.wikidataUrl);
  if (input.wikipediaUrl)  sameAs.push(input.wikipediaUrl);
  if (input.linkedinUrl)   sameAs.push(input.linkedinUrl);
  if (input.crunchbaseUrl) sameAs.push(input.crunchbaseUrl);
  if (input.youtubeUrl)    sameAs.push(input.youtubeUrl);
  if (input.twitterUrl)    sameAs.push(input.twitterUrl);
  if (input.facebookUrl)   sameAs.push(input.facebookUrl);
  if (input.instagramUrl)  sameAs.push(input.instagramUrl);
  return sameAs;
}

/**
 * Map entityType to Schema.org @type value
 */
function mapEntityType(entityType: BrandIdentityInput['entityType']): string {
  switch (entityType) {
    case 'local-business': return 'LocalBusiness';
    case 'person':         return 'Person';
    default:               return 'Organization';
  }
}

/**
 * Build the main organization/person schema object
 */
function buildOrganizationSchema(
  input: BrandIdentityInput,
  orgId: string,
  sameAs: string[]
): Record<string, unknown> {
  const type = mapEntityType(input.entityType);
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': type,
    '@id': orgId,
    name: input.canonicalName,
    url: input.canonicalUrl,
  };

  if (input.description) base.description = input.description;
  if (input.logoUrl) {
    base.logo = {
      '@type': 'ImageObject',
      url: input.logoUrl,
    };
  }
  if (input.foundingDate) base.foundingDate = input.foundingDate;
  if (sameAs.length > 0) base.sameAs = sameAs;

  // Address for LocalBusiness or organisations with physical presence
  if ((input.entityType === 'local-business' || input.hasPhysicalLocation) && input.address) {
    const addr = input.address;
    base.address = {
      '@type': 'PostalAddress',
      ...(addr.street    ? { streetAddress:   addr.street }    : {}),
      ...(addr.suburb    ? { addressLocality: addr.suburb }    : {}),
      ...(addr.state     ? { addressRegion:   addr.state }     : {}),
      ...(addr.postcode  ? { postalCode:      addr.postcode }  : {}),
      ...(addr.country   ? { addressCountry:  addr.country }   : {}),
    };
  }

  if (input.phone) base.telephone = input.phone;

  return base;
}

/**
 * Build the WebSite schema linked to the organization
 */
function buildWebsiteSchema(
  input: BrandIdentityInput,
  orgId: string,
  websiteId: string
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': websiteId,
    url: input.canonicalUrl,
    name: input.canonicalName,
    publisher: { '@id': orgId },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${input.canonicalUrl}?s={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Build Person schema that references the org via memberOf (for entityType === 'person')
 */
function buildPersonSchema(
  input: BrandIdentityInput,
  orgId: string,
  sameAs: string[]
): Record<string, unknown> {
  const personId = `${input.canonicalUrl}/#person`;
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': personId,
    name: input.canonicalName,
    url: input.canonicalUrl,
  };
  if (input.description) schema.description = input.description;
  if (input.logoUrl) schema.image = input.logoUrl;
  if (sameAs.length > 0) schema.sameAs = sameAs;
  // Reference the org if both exist — use org as the primary authored entity
  schema.memberOf = { '@id': orgId };
  return schema;
}

/**
 * Build the entity graph: connects Organization + WebSite (+ Person if applicable)
 * via @id cross-references, generating a valid JSON-LD entity graph.
 */
export function buildEntityGraph(input: BrandIdentityInput): EntityGraph {
  const orgId     = `${input.canonicalUrl}/#organization`;
  const websiteId = `${input.canonicalUrl}/#website`;
  const sameAs    = buildSameAs(input);

  const organizationSchema = buildOrganizationSchema(input, orgId, sameAs);
  const websiteSchema      = buildWebsiteSchema(input, orgId, websiteId);

  // Minimal author reference for article/page-level schema
  const articleAuthorRef: Record<string, unknown> = {
    '@id': orgId,
  };

  const graph: EntityGraph = {
    organizationSchema,
    websiteSchema,
    articleAuthorRef,
    generatedAt: new Date().toISOString(),
  };

  if (input.entityType === 'person') {
    graph.personSchema = buildPersonSchema(input, orgId, sameAs);
  }

  return graph;
}
