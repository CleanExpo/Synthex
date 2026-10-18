/**
 * J2 per-route request fixtures: the smallest valid query, path param or role
 * that gets an authenticated org-A request past input validation or role
 * gating and onto the route's data read. Routes not listed get the defaults.
 * All values are synthetic org-A identifiers.
 */
export type J2Role = 'member' | 'owner' | 'multiBusinessOwner';

export interface J2Fixture {
  query?: Record<string, string>;
  params?: Record<string, string>;
  role?: J2Role;
}

const OWNER: J2Fixture = { role: 'owner' };
const BRAND: J2Fixture = { query: { brandId: 'org-A-brand-1' } };
const LOCATION: J2Fixture = { query: { locationId: 'org-A-location-1' } };
const COMMENTS: J2Fixture = {
  query: { contentType: 'post', contentId: 'org-A-post-1' },
};
const PROVIDER: J2Fixture = { params: { provider: 'canva' } };

export const J2_FIXTURES: Record<string, J2Fixture> = {
  'app/api/admin/oauth-preflight/route.ts': OWNER,
  'app/api/admin/org-brand-profile/route.ts': OWNER,
  'app/api/admin/platform-credentials/route.ts': OWNER,
  'app/api/admin/vault/access-log/route.ts': OWNER,
  'app/api/admin/vault/route.ts': OWNER,
  'app/api/admin/vault/seed-all/route.ts': OWNER,
  'app/api/ai/calendar-jobs/route.ts': { query: { id: 'org-A-job-1' } },
  'app/api/authority/citations/route.ts': {
    query: { analysisId: 'org-A-analysis-1' },
  },
  'app/api/brand/kg-check/route.ts': BRAND,
  'app/api/brand/mentions/route.ts': BRAND,
  'app/api/brand/wikidata/route.ts': BRAND,
  'app/api/businesses/route.ts': { role: 'multiBusinessOwner' },
  'app/api/comments/route.ts': COMMENTS,
  'app/api/content/comments/route.ts': COMMENTS,
  'app/api/content/industry/templates/route.ts': {
    query: { industry: 'plumbing' },
  },
  'app/api/effect-report/by-period/route.ts': { query: { quarter: '2026-Q3' } },
  'app/api/google-business/insights/route.ts': LOCATION,
  'app/api/google-business/photos/route.ts': LOCATION,
  'app/api/google-business/posts/route.ts': LOCATION,
  'app/api/heygen/video/route.ts': { query: { videoId: 'org-A-video-1' } },
  'app/api/integrations/third-party/[provider]/config/route.ts': PROVIDER,
  'app/api/integrations/third-party/[provider]/route.ts': PROVIDER,
  'app/api/optimize/auto-schedule/route.ts': {
    query: { platform: 'instagram' },
  },
  'app/api/unite-group/status/route.ts': OWNER,
};

/** First configured owner email (tests/jest.setup.js sets a test value). */
export function ownerEmail(): string {
  return (process.env.OWNER_EMAILS ?? '').split(',')[0].trim();
}
