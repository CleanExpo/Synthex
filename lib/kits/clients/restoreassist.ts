/**
 * RestoreAssist client manifest. Facts come only from the repo or a recorded
 * founder decision; anything else is null and listed in `unknown`.
 */
import { BUILD_COST_CEILING_USD, type ClientManifest } from '../schema';
import { GOOGLE_ONBOARDING_SCOPES } from './onboarding-scopes';

const PORTFOLIO = 'lib/agency/portfolio-brand-configs.ts';
const BRAND = 'packages/brand-config/src/brands/ra.ts';
const CLAIMS = 'packages/brand-config/src/brands/ra.claims.md';
const DO_SPEC =
  'doctl apps spec get, observed 22/10/2026 by the Synthex coordinator';

export const restoreassistManifest: ClientManifest = {
  slug: 'restoreassist',
  displayName: { value: 'RestoreAssist', source: PORTFOLIO },
  legalName: { value: 'RestoreAssist Pty Ltd', source: BRAND },
  brandConfigSlug: { value: 'ra', source: BRAND },
  clientMetric: 'ra_trial_signups',
  domains: {
    value: ['https://restoreassist.app', 'https://www.restoreassist.app'],
    source: `${PORTFOLIO} (website) and ${DO_SPEC}`,
  },
  gbpLocationId: null,
  bingPlacesId: null,
  nap: null,
  connectedPlatforms: null,
  claimsFile: { value: CLAIMS, source: CLAIMS },
  compliance: [
    {
      id: 'trialTermsDisclosure',
      value:
        'Free 15-day trial, 50 inspection report credits — reports run on your own Anthropic or OpenAI key, billed by them',
      source: `${CLAIMS} (facts_approved, verified 29/08/2026, founder owns final wording)`,
      note: 'Trial-to-paid terms shown clearly; never drop the who-pays qualification.',
    },
    {
      id: 'noCompetitorNames',
      value: true,
      source: BRAND,
      note: 'Never name DocuSketch, Encircle, Magicplan or Xactimate.',
    },
  ],
  onboardingAuthority: {
    scopesRequired: GOOGLE_ONBOARDING_SCOPES,
    grants: null,
  },
  hosting: {
    provider: 'digitalocean',
    appName: 'restore-assist',
    appId: '29d505b9-3ccb-4233-a5e4-8812be1c9556',
    region: 'syd',
    domains: ['restoreassist.app', 'www.restoreassist.app'],
    sourceRepo: 'CleanExpo/RestoreAssist',
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
