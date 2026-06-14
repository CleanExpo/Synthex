export type OwnedSocialPageConfig = {
  slug: string;
  socialHandles: Record<string, string>;
  allowedProfileIds: Record<string, string[]>;
  blockedCrossBrandProfiles?: Record<string, string[]>;
};

export const SOCIAL_PUBLISH_PLATFORMS = [
  'facebook',
  'instagram',
  'linkedin',
  'reddit',
  'youtube',
] as const;

export const PORTFOLIO_SOCIAL_CLIENTS: OwnedSocialPageConfig[] = [
  {
    slug: 'carsi',
    socialHandles: {
      facebook: 'https://www.facebook.com/carsiaus',
      instagram: 'https://www.instagram.com/carsi_aus',
      linkedin: 'https://www.linkedin.com/company/carsiaus',
      youtube: 'https://www.youtube.com/@CARSIAustralia',
    },
    allowedProfileIds: {
      facebook: ['107529017631636'],
      instagram: ['carsi_aus'],
      youtube: ['@carsi6767'],
    },
  },
  {
    slug: 'disaster-recovery',
    socialHandles: {
      facebook: 'https://www.facebook.com/disasterrecoveryau',
    },
    allowedProfileIds: {
      facebook: ['246603068727802'],
    },
    blockedCrossBrandProfiles: {
      instagram: ['nrpgaustralia'],
      linkedin: ['nrpg-australia'],
      twitter: ['NRPGAustralia'],
    },
  },
  {
    slug: 'restoreassist',
    socialHandles: {
      youtube: 'https://www.youtube.com/channel/UCseWy5OySgZzJUIMKZ-kT5Q',
    },
    allowedProfileIds: {
      youtube: ['UCseWy5OySgZzJUIMKZ-kT5Q'],
    },
  },
  {
    slug: 'ccw',
    socialHandles: {},
    allowedProfileIds: {},
  },
];

export function asJsonRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export function buildOwnedPagePolicy(
  config: OwnedSocialPageConfig,
  now: Date = new Date()
) {
  return {
    ownPageOnly: true,
    managedThroughSynthexOnly: true,
    organicOnly: true,
    adSpendEnabled: false,
    directPlatformRoutesDisabled: true,
    allowedProfileIds: config.allowedProfileIds,
    allowedPageUrls: config.socialHandles,
    blockedCrossBrandProfiles: config.blockedCrossBrandProfiles ?? {},
    updatedAt: now.toISOString(),
  };
}

export function getOwnedSocialClientConfig(
  slug: string
): OwnedSocialPageConfig | undefined {
  return PORTFOLIO_SOCIAL_CLIENTS.find(config => config.slug === slug);
}

export function getOwnedProfileAllowlist(
  settings: unknown,
  platform: string
): string[] {
  const socialPublishing = asJsonRecord(asJsonRecord(settings).socialPublishing);
  const allowedProfileIds = asJsonRecord(socialPublishing.allowedProfileIds);
  return stringArray(allowedProfileIds[platform]);
}

export function isBusinessSocialAccountType(accountType: string): boolean {
  return ['business', 'business_page', 'company'].includes(accountType);
}

/**
 * Platforms whose real auto-publish pipeline is live and which therefore
 * support ad-hoc "post now" to the team's OWN connected accounts without the
 * manual `enforce-owned-social-page-mappings` allowlist script.
 *
 * Keep this tight: only platforms that publish through a verified, caption-only
 * publish client are auto-enabled:
 *  - IG / FB / LinkedIn — original v1 pipeline.
 *  - Twitter/X, Threads — real publish clients that post from a caption alone
 *    (no extra per-slot metadata). Added in SYN-P1.
 *
 * Reddit, Pinterest, YouTube and TikTok have real publish clients too, but each
 * requires extra metadata (subreddit/title, board_id, a video URL) that the
 * caption-only "post now" / calendar-slot flow does not yet supply, so they are
 * deliberately NOT auto-enabled here and still require the explicit owned-page
 * allowlist. No regression, no arbitrary-platform opening.
 */
export const ADHOC_POST_NOW_PLATFORMS = [
  'facebook',
  'instagram',
  'linkedin',
  'twitter',
  'threads',
] as const;

export function isAdhocPostNowPlatform(platform: string): boolean {
  return (ADHOC_POST_NOW_PLATFORMS as readonly string[]).includes(platform);
}

/**
 * The accountType auto-assigned on connect for v1 auto-publish platforms so the
 * connection is treated as an owned business page rather than the default
 * `personal`. This keeps `isBusinessSocialAccountType` semantics consistent
 * across the connect flow and the post gate.
 */
export const OWNED_PAGE_ACCOUNT_TYPE = 'business_page';

export type OwnedConnectionPublishDecision = {
  /** Whether this connection may publish ad-hoc to its platform. */
  allowed: boolean;
  /**
   * How eligibility was granted:
   *  - 'allowlisted'   → explicit owned-page allowlist (manual script) matched
   *  - 'owned-active-org' → auto-enabled: team's own active-org v1 connection
   *  - null            → blocked
   */
  basis: 'allowlisted' | 'owned-active-org' | null;
};

/**
 * Decide whether an ALREADY org-scoped, active platform connection may publish
 * ad-hoc.
 *
 * SAFETY BOUNDARY: the caller MUST have loaded this connection scoped to the
 * acting user's effective organization (userId + organizationId + isActive).
 * That scope is what guarantees "own active-org account only" — this function
 * never widens beyond it. It only decides, within that owned set, whether the
 * connection is publish-eligible:
 *
 *   1. Explicit allowlist (legacy/manual script) → always honored.
 *   2. Auto-enable: an auto-publish platform (ADHOC_POST_NOW_PLATFORMS —
 *      IG/FB/LinkedIn/Twitter/Threads) with a real profileId → eligible without
 *      the manual script.
 *
 * OAuth publishing-scope verification is enforced separately by the caller and
 * remains the hard gate: an account missing publish scopes is still rejected.
 */
export function evaluateOwnedConnectionPublishGate(params: {
  hasOrganization: boolean;
  platform: string;
  accountType: string;
  profileId: string | null | undefined;
  allowedProfileIds: string[];
}): OwnedConnectionPublishDecision {
  const { hasOrganization, platform, accountType, profileId, allowedProfileIds } =
    params;

  // No org context or no profile identity → cannot establish ownership.
  if (!hasOrganization || !profileId) {
    return { allowed: false, basis: null };
  }

  // 1. Explicit owned-page allowlist (manual script) — preserved exactly.
  if (
    isBusinessSocialAccountType(accountType) &&
    allowedProfileIds.length > 0 &&
    allowedProfileIds.includes(profileId)
  ) {
    return { allowed: true, basis: 'allowlisted' };
  }

  // 2. Auto-enable the team's own active-org connection for platforms whose
  //    real, caption-only publish pipeline is live (ADHOC_POST_NOW_PLATFORMS).
  //    The connection is already org-scoped by the caller, so this is bounded to
  //    accounts the active org connected.
  if (isAdhocPostNowPlatform(platform)) {
    return { allowed: true, basis: 'owned-active-org' };
  }

  return { allowed: false, basis: null };
}
