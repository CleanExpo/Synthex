/**
 * CARSI client manifest. Facts come only from the repo or a recorded founder
 * decision; anything else is null and listed in `unknown`.
 */
import { BUILD_COST_CEILING_USD, type ClientManifest } from '../schema';
import { GOOGLE_ONBOARDING_SCOPES } from './onboarding-scopes';

const PORTFOLIO = 'lib/agency/portfolio-brand-configs.ts';
const BRAND = 'packages/brand-config/src/brands/carsi.ts';
const CLAIMS = 'packages/brand-config/src/brands/carsi.claims.md';
const FOUNDER =
  'Founder decision 22/10/2026 (relayed by the Synthex coordinator)';
const DO_SPEC =
  'doctl apps spec get, observed 22/10/2026 by the Synthex coordinator';

export const carsiManifest: ClientManifest = {
  slug: 'carsi',
  displayName: { value: 'CARSI', source: PORTFOLIO },
  legalName: { value: 'CARSI', source: BRAND },
  brandConfigSlug: { value: 'carsi', source: BRAND },
  clientMetric: 'carsi_enrolments',
  domains: {
    value: ['https://carsi.com.au', 'https://www.carsi.com.au'],
    source: `${PORTFOLIO} (website) and ${DO_SPEC}`,
  },
  gbpLocationId: null,
  bingPlacesId: null,
  nap: null,
  connectedPlatforms: null,
  claimsFile: { value: CLAIMS, source: CLAIMS },
  compliance: [
    {
      id: 'rto',
      value: false,
      source: FOUNDER,
      note: 'CARSI is not a registered training organisation. It is a company insured as a training organisation for Australian insurance purposes.',
    },
    {
      id: 'noNationalRecognitionOrAqfClaim',
      value: true,
      source: `${CLAIMS} (Standing Prohibitions: "Do not describe CARSI as an RTO.")`,
      note: 'Never claim national recognition or AQF accreditation.',
    },
    {
      id: 'noIicrcEndorsementClaim',
      value: true,
      source: CLAIMS,
      note: 'Do not imply IICRC endorsement or guaranteed certification outcomes.',
    },
    {
      id: 'pricesIncludeGst',
      value: true,
      source: CLAIMS,
      note: 'Every price is a single AUD total including GST (ACL).',
    },
  ],
  onboardingAuthority: {
    scopesRequired: GOOGLE_ONBOARDING_SCOPES,
    grants: null,
  },
  hosting: {
    provider: 'digitalocean',
    appName: 'carsi-app',
    appId: 'a9d718db-7961-4107-9477-96c72fcf620f',
    region: 'syd',
    domains: ['carsi.com.au', 'www.carsi.com.au'],
    sourceRepo: 'CleanExpo/CARSI',
    deployBranch: 'main',
    source: DO_SPEC,
  },
  costCeilingUsd: BUILD_COST_CEILING_USD,
  unknown: [
    'gbpLocationId',
    'bingPlacesId',
    'nap',
    'connectedPlatforms',
    'onboardingAuthority.grants',
  ],
};
