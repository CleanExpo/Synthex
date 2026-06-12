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
    socialHandles: {},
    allowedProfileIds: {},
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
