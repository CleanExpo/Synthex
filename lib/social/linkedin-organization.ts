/**
 * LinkedIn organisation resolution for OAuth connections.
 *
 * Company-page publishing requires the connection's profileId to be the
 * NUMERIC LinkedIn organisation id — LinkedInService.createPost only builds an
 * `urn:li:organization:` author URN when `/^\d+$/.test(profileId)` passes
 * (lib/social/linkedin-service.ts). The OAuth callback's userinfo `sub` is a
 * non-numeric OpenID member id, so without this resolution every org-scoped
 * connection silently posts to the member's PERSONAL feed.
 *
 * Spec: docs/specs/2026-07-09-carsi-linkedin-golive-spec.md (E1).
 *
 * FAILURE MODE: never throws — an unresolved organisation falls back to the
 * member id and the manual override endpoint (E2) is the deterministic path.
 */

import { logger } from '@/lib/logger';

export const LINKEDIN_ORGANIZATION_SOCIAL_SCOPE = 'w_organization_social';

const LINKEDIN_ORGANIZATION_ACLS_URL =
  'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED';

const ORGANIZATION_URN_PATTERN = /^urn:li:organization:(\d+)$/;

export interface LinkedInOrganizationResolution {
  /**
   * Numeric organisation id to store as the connection profileId — set only
   * when exactly one APPROVED ADMINISTRATOR organisation resolved.
   */
  organizationId: string | null;
  /** Every admin organisation id found (remediation / manual override input). */
  adminOrganizationIds: string[];
}

const EMPTY_RESOLUTION: LinkedInOrganizationResolution = {
  organizationId: null,
  adminOrganizationIds: [],
};

/** True when the granted OAuth scope allows organisation publishing. */
export function scopeGrantsOrganizationSocial(
  scope: string | null | undefined
): boolean {
  if (!scope) return false;
  return scope.split(/[\s,]+/).includes(LINKEDIN_ORGANIZATION_SOCIAL_SCOPE);
}

/**
 * Extract numeric organisation ids from an organizationAcls response.
 * Elements look like `{ organization: 'urn:li:organization:112760720', ... }`.
 */
export function extractAdminOrganizationIds(response: unknown): string[] {
  const elements = (response as { elements?: unknown[] } | null)?.elements;
  if (!Array.isArray(elements)) return [];

  const ids = new Set<string>();
  for (const element of elements) {
    const organization = (element as { organization?: unknown } | null)
      ?.organization;
    if (typeof organization !== 'string') continue;
    const match = organization.match(ORGANIZATION_URN_PATTERN);
    if (match) ids.add(match[1]);
  }
  return [...ids];
}

/**
 * Resolve the authorising member's admin'd LinkedIn organisation.
 *
 * Only runs when the granted scope includes `w_organization_social`; a
 * member-only connection keeps its member id (personal posting is rejected
 * downstream by the owned-page gate, never silently redirected).
 */
export async function resolveLinkedInOrganizationProfile(params: {
  accessToken: string;
  grantedScope: string | null | undefined;
}): Promise<LinkedInOrganizationResolution> {
  if (!scopeGrantsOrganizationSocial(params.grantedScope)) {
    return EMPTY_RESOLUTION;
  }

  try {
    const response = await fetch(LINKEDIN_ORGANIZATION_ACLS_URL, {
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    if (!response.ok) {
      logger.warn('[linkedin] organizationAcls lookup failed', {
        status: response.status,
      });
      return EMPTY_RESOLUTION;
    }

    const adminOrganizationIds = extractAdminOrganizationIds(
      await response.json()
    );

    if (adminOrganizationIds.length === 1) {
      return { organizationId: adminOrganizationIds[0], adminOrganizationIds };
    }

    logger.warn(
      '[linkedin] could not auto-resolve a single admin organisation — set the numeric organisation id via the connection organization override endpoint',
      { adminOrganizationCount: adminOrganizationIds.length }
    );
    return { organizationId: null, adminOrganizationIds };
  } catch (error) {
    logger.warn('[linkedin] organizationAcls lookup errored', { error });
    return EMPTY_RESOLUTION;
  }
}
