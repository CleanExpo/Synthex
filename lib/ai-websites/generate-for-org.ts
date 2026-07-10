/**
 * AI-Websites — the canonical "generate a site for this organisation" service.
 *
 * Resolves an organisation's Google Business Profile connection and brand, then
 * runs the Phase 3 pipeline (fetch → industry-starter gap-fill → validator-gated
 * LLM copy → validated site). The REST route, the MCP tool, and any in-app
 * caller are thin wrappers over this one function — the org → connection →
 * brand → generate resolution lives here, once.
 *
 * App-layer service (touches prisma + the GBP OAuth client), deliberately kept
 * OUT of the cred-free `lib/site-generator` module, which it composes over.
 */

import prisma from '@/lib/prisma';
import { findOAuthConnection } from '@/lib/google/google-auth';
import { getLocationDetails, getReviews } from '@/lib/google/business-profile';
import {
  createGbpProfileFetcher,
  createLlmCopyWriter,
  generateSiteFromGbp,
  type GenerateFromSourceResult,
  type SiteBrand,
} from '@/lib/site-generator';

/** Thrown when the organisation has no connected Google Business Profile. */
export class GbpConnectionMissingError extends Error {
  constructor() {
    super('No Google Business Profile connection found. Please connect first.');
    this.name = 'GbpConnectionMissingError';
  }
}

export interface GenerateForOrgInput {
  /** GBP location resource name, e.g. 'accounts/{id}/locations/{id}'. */
  locationId: string;
  /** Optional hero service slug (defaults to the profile's first service). */
  serviceSlug?: string;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'brand'
  );
}

export async function generateSiteForOrg(
  organizationId: string,
  input: GenerateForOrgInput
): Promise<GenerateFromSourceResult> {
  const connectionId = await findOAuthConnection(
    organizationId,
    'googlebusiness'
  );
  if (!connectionId) {
    throw new GbpConnectionMissingError();
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, website: true },
  });
  if (!organization) {
    throw new Error('Organisation not found');
  }

  const brand: SiteBrand = {
    slug: slugify(organization.name),
    displayName: organization.name,
    forbiddenWords: [],
  };

  const fetcher = createGbpProfileFetcher(
    { getLocationDetails, getReviews },
    connectionId,
    organization.website ? { fallbackUrl: organization.website } : {}
  );
  const copywriter = createLlmCopyWriter();

  return generateSiteFromGbp(
    fetcher,
    copywriter,
    input.locationId,
    brand,
    input.serviceSlug ? { serviceSlug: input.serviceSlug } : {}
  );
}
