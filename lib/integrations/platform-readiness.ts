export type PlatformReadinessStatus =
  | 'ready'
  | 'missing_credentials'
  | 'needs_configuration'
  | 'blocked';

export interface PlatformReadiness {
  status: PlatformReadinessStatus;
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  docsUrl?: string;
  issues: string[];
}

const META_DOCS_URL = 'https://developers.facebook.com/docs/facebook-login/permissions/';
const META_APP_REVIEW_URL = 'https://developers.facebook.com/apps/';

const META_LOGIN_CONFIG_ENV_KEYS: Record<'facebook' | 'instagram', string[]> = {
  facebook: [
    'FACEBOOK_LOGIN_CONFIG_ID',
    'META_FACEBOOK_LOGIN_CONFIG_ID',
    'META_BUSINESS_LOGIN_CONFIG_ID',
  ],
  instagram: [
    'INSTAGRAM_LOGIN_CONFIG_ID',
    'META_INSTAGRAM_LOGIN_CONFIG_ID',
    'META_BUSINESS_LOGIN_CONFIG_ID',
  ],
};

const META_PERMISSION_ISSUES: Record<'facebook' | 'instagram', string[]> = {
  facebook: [
    'pages_show_list Advanced Access',
    'pages_read_engagement Advanced Access',
    'pages_manage_posts Advanced Access',
    'Business Verification for the owning portfolio',
  ],
  instagram: [
    'instagram_basic Advanced Access',
    'instagram_content_publish Advanced Access',
    'pages_show_list Advanced Access',
    'pages_read_engagement Advanced Access',
    'Business Verification for the owning portfolio',
  ],
};

export function isMetaPublishingPlatform(
  platform: string
): platform is 'facebook' | 'instagram' {
  return platform === 'facebook' || platform === 'instagram';
}

export function getMetaLoginConfigId(platform: string): string | undefined {
  if (!isMetaPublishingPlatform(platform)) {
    return undefined;
  }

  for (const envKey of META_LOGIN_CONFIG_ENV_KEYS[platform]) {
    const value = process.env[envKey]?.trim();
    if (value) return value;
  }

  return undefined;
}

export function buildMetaPublishingReadiness(
  platform: 'facebook' | 'instagram',
  options: { connected: boolean; hasCredentials: boolean }
): PlatformReadiness {
  if (options.connected) {
    return {
      status: 'ready',
      title: 'Meta connection active',
      message:
        'Synthex has an active OAuth token for this business. Publishing still remains behind normal approval and safety gates.',
      issues: [],
    };
  }

  if (!options.hasCredentials) {
    return {
      status: 'missing_credentials',
      title: 'OAuth credentials missing',
      message:
        'Synthex does not have active Meta OAuth client credentials for this platform yet.',
      actionLabel: 'Add platform credentials',
      issues: ['Meta app client ID and client secret are not active in Synthex'],
    };
  }

  if (!getMetaLoginConfigId(platform)) {
    return {
      status: 'needs_configuration',
      title: 'Meta Login for Business config missing',
      message:
        'Meta is rejecting raw Page and Instagram scopes. Configure a Meta Login for Business config id after the requested permissions are approved.',
      actionLabel: 'Configure Meta app',
      actionUrl: META_APP_REVIEW_URL,
      docsUrl: META_DOCS_URL,
      issues: [
        'META_BUSINESS_LOGIN_CONFIG_ID, platform-specific login config id, or equivalent env var is not set',
        ...META_PERMISSION_ISSUES[platform],
      ],
    };
  }

  return {
    status: 'blocked',
    title: 'Meta verification and App Review required',
    message:
      'The Meta app is configured, but Page and Instagram publishing permissions require Business Verification and App Review before OAuth can complete.',
    actionLabel: 'Complete Meta verification',
    actionUrl: META_APP_REVIEW_URL,
    docsUrl: META_DOCS_URL,
    issues: META_PERMISSION_ISSUES[platform],
  };
}
