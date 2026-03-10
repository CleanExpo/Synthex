export const AUTHORITY_LIMITS = {
  free: {
    claimValidations: 0,
    citationGenerations: 0,
    monitoredUrls: 0,
    webSearches: 0,
    designAudits: 0,
  },
  addon: {
    claimValidations: -1, // unlimited
    citationGenerations: -1,
    monitoredUrls: 50,
    webSearches: 500,
    designAudits: -1,
  },
} as const;

export type AuthorityTier = keyof typeof AUTHORITY_LIMITS;

export function getAuthorityLimit(tier: AuthorityTier, resource: keyof typeof AUTHORITY_LIMITS.free): number {
  return AUTHORITY_LIMITS[tier][resource];
}

export function isAuthorityFeatureAvailable(tier: AuthorityTier, resource: keyof typeof AUTHORITY_LIMITS.free): boolean {
  const limit = getAuthorityLimit(tier, resource);
  return limit !== 0;
}
