/**
 * Google OAuth scopes a client grants at onboarding so kits can act for them
 * (founder decision 22/10/2026: Synthex creates GA4 properties, so
 * analytics.edit replaces analytics.readonly for kit clients).
 */
export const GOOGLE_ONBOARDING_SCOPES = [
  'https://www.googleapis.com/auth/analytics.edit',
  'https://www.googleapis.com/auth/webmasters',
  'https://www.googleapis.com/auth/indexing',
  'https://www.googleapis.com/auth/business.manage',
];
