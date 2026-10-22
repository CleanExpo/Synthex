/**
 * Kit catalogue as data (spec: docs/superpowers/specs/2026-10-22-kit-library-design.md).
 *
 * Every `in-repo` path is checked against the repo by
 * tests/unit/kits/catalogue.test.ts. `in-skills` paths are relative to
 * ~/.claude/skills/ and are recorded, not checked (they live outside the repo).
 * Time and cost figures are judgements from the research, not measurements:
 * replace each with the measured value the first time the kit runs for a real
 * client.
 */
import type { Kit } from './schema';

const BASELINE_COMPLIANCE =
  'Privacy Act 1988 / APP 1: privacy policy covers the analytics, pixels and verification tags this kit adds';

export const KITS: Kit[] = [
  {
    id: 'K1',
    name: 'Search-engine onboarding (GSC, Bing Webmaster, IndexNow)',
    outcome:
      'Domain verified with Google and Bing, sitemap submitted, IndexNow pinged on every publish',
    clientMetric: 'both',
    inputs: ['domains', 'onboardingAuthority'],
    artefacts: [
      {
        kind: 'in-repo',
        path: 'lib/google/search-console.ts',
        what: 'Search Console client',
        wired: true,
        testPath: 'tests/eval/jev/families/j7.jev.test.ts',
      },
      {
        kind: 'in-repo',
        path: 'lib/google/indexing.ts',
        what: 'Google Indexing API client',
        wired: true,
        testPath: null,
      },
      {
        kind: 'in-repo',
        path: 'lib/sitemap',
        what: 'Sitemap generation and regeneration',
        wired: true,
        testPath: 'tests/unit/sitemap-regen.test.ts',
      },
      {
        kind: 'in-repo',
        path: 'lib/sitemap/ping-client.ts',
        what: 'Sitemap ping client (retired endpoints)',
        wired: true,
        testPath: 'tests/unit/sitemap-regen.test.ts',
        note: 'Lines 28-31 still build google.com/ping and bing.com/ping URLs. Google retired its endpoint (404) and Bing removed anonymous submission (410); see spec K1. Replace with IndexNow.',
      },
      {
        kind: 'in-repo',
        path: 'app/api/cron/gsc-monitor/route.ts',
        what: 'GSC monitor cron (scheduled in vercel.json)',
        wired: true,
        testPath: null,
      },
      {
        kind: 'in-repo',
        path: 'app/api/cron/gsc-auto-index/route.ts',
        what: 'GSC auto-index cron (scheduled in vercel.json)',
        wired: true,
        testPath: null,
      },
      {
        kind: 'missing',
        what: 'Bing Webmaster AddSite / VerifySite / SubmitFeed client',
        source: {
          type: 'build-in-house',
          reason:
            'Bing Webmaster API is a small REST surface; no maintained open-source client found in the research',
        },
      },
      {
        kind: 'missing',
        what: 'IndexNow key file plus ping-on-publish',
        source: {
          type: 'build-in-house',
          reason:
            'IndexNow is a single documented POST; replaces the retired ping URLs',
        },
      },
    ],
    verifier: {
      status: 'to-build',
      description:
        'GSC and Bing report the sitemap as submitted and an IndexNow POST returns 200/202 for a published URL',
      path: null,
    },
    compliance: [BASELINE_COMPLIANCE],
    founderGates: [
      'Client grants webmasters and indexing scopes at onboarding (decided 22/10/2026)',
    ],
    minutesSavedPerJob: {
      low: 120,
      high: 180,
      basis: 'estimate',
      note: '2-3 h per job',
    },
    maxDirectCostUsd: {
      usd: 0,
      basis: 'estimate',
      note: 'Google, Bing and IndexNow calls are free; no model calls',
    },
    readiness: 'partial',
  },
  {
    id: 'K2',
    name: 'Measurement (GA4, GTM, consent)',
    outcome:
      'GA4 property created or connected, lead events tracked, consent defaults set, data pulled into Synthex',
    clientMetric: 'both',
    inputs: ['domains', 'onboardingAuthority', 'clientMetric'],
    artefacts: [
      {
        kind: 'in-repo',
        path: 'app/api/integrations/ga4',
        what: 'GA4 connect and property select routes',
        wired: true,
        testPath: null,
      },
      {
        kind: 'in-repo',
        path: 'lib/analytics',
        what: 'Client gtag event helpers (*-events.ts)',
        wired: true,
        testPath: 'tests/unit/analytics/engagement-events.test.ts',
      },
      {
        kind: 'in-repo',
        path: 'app/api/auth/oauth/[platform]/route.ts',
        what: 'OAuth scopes; GA4 is analytics.readonly today',
        wired: true,
        testPath: null,
        note: 'Line 130 requests analytics.readonly; property creation needs analytics.edit',
      },
      {
        kind: 'in-repo',
        path: 'lib/agency/load-agency-brand-metrics.ts',
        what: 'Brand metrics loader that proxies GA4 with the Lead table',
        wired: true,
        testPath: 'tests/unit/lib/agency/load-agency-brand-metrics.test.ts',
        note: 'Line 4: "GA4 is not wired yet"',
      },
      {
        kind: 'missing',
        what: 'GA4 Admin API property creation and Data API pull',
        source: {
          type: 'build-in-house',
          reason: 'Thin wrapper over Google Analytics Admin and Data APIs',
        },
      },
      {
        kind: 'missing',
        what: 'Tracking plan with GA4 recommended lead events (generate_lead, sign_up, qualify_lead), GTM container JSON, consent-mode defaults',
        source: {
          type: 'build-in-house',
          reason: 'Plan and container are client data, built once as templates',
        },
      },
    ],
    verifier: {
      status: 'to-build',
      description:
        'GA4 Data API returns a non-error report for the property and a test generate_lead event appears in DebugView',
      path: null,
    },
    compliance: [
      BASELINE_COMPLIANCE,
      'APP 8: cross-border disclosure to Google named in the privacy policy',
    ],
    founderGates: [
      'Client grants analytics.edit at onboarding so Synthex can create GA4 properties (decided 22/10/2026)',
    ],
    minutesSavedPerJob: {
      low: 240,
      high: 360,
      basis: 'estimate',
      note: '4-6 h per job',
    },
    maxDirectCostUsd: {
      usd: 0,
      basis: 'estimate',
      note: 'Google Analytics APIs are free; no model calls',
    },
    readiness: 'partial',
  },
  {
    id: 'K3',
    name: 'Schema packs by business type',
    outcome:
      'Valid JSON-LD for the client business type on every page that needs it',
    clientMetric: 'both',
    inputs: ['displayName', 'legalName', 'domains', 'nap'],
    artefacts: [
      {
        kind: 'in-repo',
        path: 'lib/seo/schema-markup-service.ts',
        what: 'Schema validation and templates',
        wired: true,
        testPath: 'tests/unit/api/seo-schema-extract-ssrf.test.ts',
        note: 'validateSchema at line 307, getSchemaTemplates at line 551',
      },
      {
        kind: 'in-repo',
        path: 'lib/site-generator/jsonld.ts',
        what: 'Site JSON-LD builder',
        wired: true,
        testPath: null,
        note: 'buildSiteJsonLd at line 31',
      },
      {
        kind: 'in-repo',
        path: 'lib/aeo/faq-schema.ts',
        what: 'FAQPage schema builder',
        wired: false,
        testPath: '__tests__/aeo/faq-schema.test.ts',
      },
      {
        kind: 'in-skills',
        path: 'seo/schema/templates.json',
        what: '27 schema type templates',
        port: 'Port into typed builders per business type',
      },
      {
        kind: 'in-repo',
        path: 'lib/schema-packs/packs.ts',
        what: 'Typed business-type packs: courseProviderPack (CARSI) and softwareProductPack (RA), built from the Organization, Course and SoftwareApplication builders (BreadcrumbList builder alongside)',
        wired: false,
        testPath: 'tests/unit/schema-packs/schema-packs.test.ts',
        note: 'Built in-house (#1065), no schema-dts dependency. Nothing calls the packs yet. LocalBusiness stays in lib/site-generator/jsonld.ts.',
      },
      {
        kind: 'in-repo',
        path: 'lib/schema-packs/course.ts',
        what: 'Course and FAQPage builders; output reports the retired Google rich results honestly',
        wired: false,
        testPath: 'tests/unit/schema-packs/schema-packs.test.ts',
        note: 'buildFaqPage does not run the CARSI accreditation guard yet (SYN-1243)',
      },
      {
        kind: 'in-repo',
        path: 'lib/schema-packs/claim-guard.ts',
        what: 'CARSI accreditation-claim guard (not an RTO): refuses national recognition, AQF, RTO and ASQA claims',
        wired: false,
        testPath: 'tests/unit/schema-packs/schema-packs.test.ts',
        note: 'Defined-term filter; provider-style paraphrases are an open decision (SYN-1244)',
      },
    ],
    verifier: {
      status: 'to-build',
      description:
        'Each pack validates with validateSchema and passes the Rich Results Test for one sample page',
      path: null,
    },
    compliance: [
      'ACL s18/s29: schema claims (ratings, prices, accreditation) match the approved-claims register',
    ],
    founderGates: ['None identified'],
    minutesSavedPerJob: {
      low: 60,
      high: 120,
      basis: 'estimate',
      note: '1-2 h per job',
    },
    maxDirectCostUsd: {
      usd: 0.5,
      basis: 'estimate',
      note: 'Optional model call to draft FAQ text',
    },
    readiness: 'partial',
  },
  {
    id: 'K4',
    name: 'Technical SEO audit',
    outcome: 'A fixed-format issue list with a fix for each issue',
    clientMetric: 'both',
    inputs: ['domains'],
    artefacts: [
      {
        kind: 'in-repo',
        path: 'lib/seo/technical-seo-service.ts',
        what: 'Technical SEO checks',
        wired: true,
        testPath: null,
      },
      {
        kind: 'in-repo',
        path: 'lib/seo/pagespeed-service.ts',
        what: 'PageSpeed Insights client',
        wired: true,
        testPath: 'tests/unit/seo/pagespeed-service.test.ts',
      },
      {
        kind: 'in-repo',
        path: 'app/api/cron/seo-audits/route.ts',
        what: 'SEO audits cron (scheduled in vercel.json)',
        wired: true,
        testPath: null,
      },
      {
        kind: 'in-repo',
        path: 'prisma/schema.prisma',
        what: 'SEOAudit model',
        wired: true,
        testPath: null,
        note: 'model SEOAudit at line 2820',
      },
      {
        kind: 'in-skills',
        path: 'seo/scripts/on_page_audit.py',
        what: 'On-page audit script',
        port: 'Port checks into lib/seo as TypeScript',
      },
      {
        kind: 'missing',
        what: 'Lighthouse CI performance budget',
        source: {
          type: 'open-source',
          repo: 'GoogleChrome/lighthouse-ci',
          licence: 'Apache-2.0',
        },
      },
      {
        kind: 'missing',
        what: 'Broken-link check',
        source: {
          type: 'open-source',
          repo: 'JustinBeckwith/linkinator',
          licence: 'MIT',
        },
      },
      {
        kind: 'missing',
        what: 'Fixed issue-to-fix template',
        source: {
          type: 'build-in-house',
          reason: 'Template maps our own audit output to fixes',
        },
      },
    ],
    verifier: {
      status: 'to-build',
      description:
        'Audit of a planted broken page reports the planted issues with a fix each',
      path: null,
    },
    compliance: [BASELINE_COMPLIANCE],
    founderGates: ['None identified'],
    minutesSavedPerJob: {
      low: 120,
      high: 120,
      basis: 'estimate',
      note: '2 h per job',
    },
    maxDirectCostUsd: {
      usd: 0.5,
      basis: 'estimate',
      note: 'PageSpeed API is free; optional model call to write fix notes',
    },
    readiness: 'partial',
  },
  {
    id: 'K5',
    name: 'Local presence (GBP, Bing Places, NAP, AU citations)',
    outcome:
      'Consistent name, address and phone across GBP, Bing Places and the top Australian directories',
    clientMetric: 'both',
    inputs: ['nap', 'gbpLocationId', 'bingPlacesId', 'onboardingAuthority'],
    artefacts: [
      {
        kind: 'in-repo',
        path: 'lib/google/business-profile.ts',
        what: 'Google Business Profile client (incl. reviews)',
        wired: true,
        testPath: 'tests/integration/gbp-monitor-reply-sync.test.ts',
      },
      {
        kind: 'in-repo',
        path: 'lib/gbp',
        what: 'GBP OAuth and helpers',
        wired: true,
        testPath: 'tests/unit/gbp-oauth-refresh.test.ts',
      },
      {
        kind: 'in-repo',
        path: 'lib/bing-places',
        what: 'Bing Places sync and bulk upload',
        wired: true,
        testPath: 'tests/unit/bing-places-sync.test.ts',
      },
      {
        kind: 'in-repo',
        path: 'app/api/google-business/nap-audit/route.ts',
        what: 'NAP audit route',
        wired: true,
        testPath: null,
      },
      {
        kind: 'in-repo',
        path: 'prisma/schema.prisma',
        what: 'NapCitation model (no callers)',
        wired: false,
        testPath: null,
        note: 'model NapCitation at line 7715',
      },
      {
        kind: 'in-skills',
        path: 'seo-gbp-posting',
        what: '8-week GBP posting calendar',
        port: 'Port calendar into the content calendar service',
      },
      {
        kind: 'missing',
        what: 'AU citation list and tracker (Whitespark AU top list: Yellow Pages, True Local, StartLocal, Yelp AU, White Pages, Apple Business Connect)',
        source: {
          type: 'build-in-house',
          reason: 'Directory list is data; tracker reuses NapCitation',
        },
      },
    ],
    verifier: {
      status: 'exists',
      description:
        'NAP audit route reports zero mismatches between the manifest NAP and GBP',
      path: 'app/api/google-business/nap-audit/route.ts',
    },
    compliance: [
      'ACL s18: listing categories and descriptions match the approved-claims register',
    ],
    founderGates: [
      'Client grants business.manage at onboarding (decided 22/10/2026)',
      'Whether GBP API posting needs Google approval [UNVERIFIED]',
    ],
    minutesSavedPerJob: {
      low: 180,
      high: 240,
      basis: 'estimate',
      note: '3-4 h per job',
    },
    maxDirectCostUsd: {
      usd: 1,
      basis: 'estimate',
      note: 'Model calls for listing descriptions; directory listings assumed free tiers',
    },
    readiness: 'partial',
  },
  {
    id: 'K6',
    name: 'Reviews (request and reply)',
    outcome: 'Compliant review requests and on-brand replies',
    clientMetric: 'both',
    inputs: ['gbpLocationId', 'claimsFile', 'compliance'],
    artefacts: [
      {
        kind: 'in-repo',
        path: 'lib/google/business-profile.ts',
        what: 'GBP review read and reply',
        wired: true,
        testPath: 'tests/integration/gbp-monitor-reply-sync.test.ts',
      },
      {
        kind: 'missing',
        what: 'ACCC-compliant request flow and reply macros',
        source: {
          type: 'build-in-house',
          reason: 'Rules are Australian-specific (ACCC guidance)',
        },
      },
    ],
    verifier: {
      status: 'to-build',
      description:
        'Request flow rejects a planted incentive-without-disclosure and a planted rating gate',
      path: null,
    },
    compliance: [
      'ACL s18/s29 (ACCC): no fake, undisclosed-incentive, gated or cherry-picked reviews',
    ],
    founderGates: ['None identified'],
    minutesSavedPerJob: {
      low: 60,
      high: 60,
      basis: 'estimate',
      note: '1 h per job',
    },
    maxDirectCostUsd: {
      usd: 0.5,
      basis: 'estimate',
      note: 'Model calls to draft replies',
    },
    readiness: 'missing',
  },
  {
    id: 'K7',
    name: 'Website build',
    outcome: 'A generated client site deployed to its host',
    clientMetric: 'both',
    inputs: ['displayName', 'domains', 'nap', 'claimsFile', 'hosting'],
    artefacts: [
      {
        kind: 'in-repo',
        path: 'lib/site-generator',
        what: 'Site generator with carsi and restoreassist brand presets and industry starters',
        wired: true,
        testPath: 'tests/unit/site-generator-brand-presets.test.ts',
      },
      {
        kind: 'in-repo',
        path: 'lib/ai-websites/generate-for-org.ts',
        what: 'Generate a site for an organisation',
        wired: true,
        testPath: 'tests/unit/ai-websites/generate-for-org.test.ts',
      },
      {
        kind: 'in-repo',
        path: 'lib/services/ai/studio-tools/index.ts',
        what: 'MCP tool generate_site_from_gbp',
        wired: true,
        testPath: null,
      },
      {
        kind: 'in-repo',
        path: 'lib/dr-repo-writer',
        what: 'Repo writer hardcoded to the Disaster Recovery repo',
        wired: true,
        testPath: 'tests/unit/dr-repo-writer.test.ts',
      },
      {
        kind: 'missing',
        what: 'Generalise lib/dr-repo-writer to write a branch + PR to the client source repo (CleanExpo/CARSI, CleanExpo/RestoreAssist); DigitalOcean builds main on merge; each client repo keeps its own release gate and human merge. No DigitalOcean API writes from Synthex.',
        source: {
          type: 'build-in-house',
          reason:
            'Extends our own repo writer; hosting is DigitalOcean App Platform (founder 22/10/2026)',
        },
      },
    ],
    verifier: {
      status: 'to-build',
      description:
        'PR opened on the client repo passes its checks; after human merge the DigitalOcean primary domain returns 200 with the merged commit',
      path: null,
    },
    compliance: [
      BASELINE_COMPLIANCE,
      'ACL s18/s29: every on-page claim comes from the approved-claims register',
      'Spam Act 2003: any sign-up form records consent source',
    ],
    founderGates: [
      'GitHub write access for Synthex to open PRs on CleanExpo/CARSI and CleanExpo/RestoreAssist; merge stays human in each repo',
    ],
    minutesSavedPerJob: {
      low: 480,
      high: 960,
      basis: 'estimate',
      note: '1-2 working days per job',
    },
    maxDirectCostUsd: {
      usd: 3,
      basis: 'estimate',
      note: 'Model calls for page copy; hosting is a running cost, not a build cost',
    },
    readiness: 'partial',
  },
  {
    id: 'K8',
    name: 'Website update (on-page fixes)',
    outcome:
      'Meta, headings, internal links and alt text fixed on the live site',
    clientMetric: 'both',
    inputs: ['domains', 'hosting', 'claimsFile'],
    artefacts: [
      {
        kind: 'in-repo',
        path: 'lib/seo/enhancement-engine.ts',
        what: 'SEO enhancement engine (only sitemap and indexing run automatically)',
        wired: true,
        testPath: null,
      },
      {
        kind: 'missing',
        what: 'Executor for meta, headings, internal links and alt text on a live client site',
        source: {
          type: 'build-in-house',
          reason: 'Depends on the K7 deploy path',
        },
      },
    ],
    verifier: {
      status: 'to-build',
      description: 'Re-running the K4 audit shows the fixed issues closed',
      path: null,
    },
    compliance: [
      'ACL s18/s29: rewritten titles and meta stay within the approved-claims register',
    ],
    founderGates: ['Same deploy access as K7'],
    minutesSavedPerJob: {
      low: 120,
      high: 240,
      basis: 'estimate',
      note: '2-4 h per round',
    },
    maxDirectCostUsd: {
      usd: 1.5,
      basis: 'estimate',
      note: 'Model calls for rewrites',
    },
    readiness: 'missing',
  },
  {
    id: 'K9',
    name: 'Social setup and content calendar',
    outcome: 'Profiles set up to one standard and a scheduled content calendar',
    clientMetric: 'both',
    inputs: [
      'displayName',
      'brandConfigSlug',
      'connectedPlatforms',
      'claimsFile',
    ],
    artefacts: [
      {
        kind: 'in-repo',
        path: 'lib/social',
        what: 'Platform services and publish adapters',
        wired: true,
        testPath: 'tests/unit/lib/social/connection-warnings.test.ts',
      },
      {
        kind: 'in-repo',
        path: 'lib/content-templates.ts',
        what: 'Content templates (10)',
        wired: true,
        testPath: null,
      },
      {
        kind: 'in-repo',
        path: 'app/api/cron/generate-calendars/route.ts',
        what: 'Calendar generation cron (scheduled in vercel.json)',
        wired: true,
        testPath: null,
      },
      {
        kind: 'in-repo',
        path: 'packages/brand-config',
        what: 'Brand configs and claims registers',
        wired: true,
        testPath: '__tests__/brand-config/tenant-resolver.test.ts',
      },
      {
        kind: 'missing',
        what: 'Profile setup checklist (handles, bio, image sizes, UTM rule) and approval-to-publish path for real posts',
        source: {
          type: 'build-in-house',
          reason:
            'Checklist is our standard; publish path follows the shadow-mode decision',
        },
      },
    ],
    verifier: {
      status: 'to-build',
      description:
        'Checklist passes for each connected platform and one approved post publishes',
      path: null,
    },
    compliance: [
      'ACL s18/s29: posts use only approved claims',
      'Spam Act 2003: no unsolicited direct messages',
    ],
    founderGates: ['Approval-to-publish for real posts (shadow-mode decision)'],
    minutesSavedPerJob: {
      low: 120,
      high: 120,
      basis: 'estimate',
      note: '2 h per job',
    },
    maxDirectCostUsd: {
      usd: 2,
      basis: 'estimate',
      note: 'Model calls for a month of drafts',
    },
    readiness: 'partial',
  },
  {
    id: 'K10',
    name: 'Campaign pack',
    outcome: 'A full authority campaign built from the client manifest',
    clientMetric: 'both',
    inputs: [
      'displayName',
      'brandConfigSlug',
      'claimsFile',
      'clientMetric',
      'costCeilingUsd',
    ],
    artefacts: [
      {
        kind: 'in-repo',
        path: 'lib/marketing-agency/full-campaign-generator.ts',
        what: 'generateFullAuthorityCampaign with quality, publish and approval gates',
        wired: true,
        testPath: 'tests/unit/marketing-agency/full-campaign-generator.test.ts',
        note: 'generateFullAuthorityCampaign at line 506',
      },
      {
        kind: 'in-repo',
        path: 'lib/marketing-agency/fixtures/restoreassist.ts',
        what: 'The only campaign fixture today',
        wired: true,
        testPath: 'tests/unit/marketing-agency/media-guide.test.ts',
      },
      {
        kind: 'in-skills',
        path: 'marketing-orchestrator',
        what: 'Wave plan for campaigns',
        port: 'Port the wave plan into the campaign generator inputs',
      },
      {
        kind: 'missing',
        what: 'Inputs read from the client manifest instead of scripts/generate-*-campaign.ts, and a campaign-to-posts step',
        source: {
          type: 'build-in-house',
          reason: 'Glue between our manifest and our generator',
        },
      },
    ],
    verifier: {
      status: 'exists',
      description: 'Campaign generator tests pass with manifest-fed input',
      path: 'tests/unit/marketing-agency/full-campaign-generator.test.ts',
    },
    compliance: [
      'ACL s18/s29: only approved claims',
      'Spam Act 2003 for any email component',
    ],
    founderGates: ['None identified'],
    minutesSavedPerJob: {
      low: 240,
      high: 480,
      basis: 'estimate',
      note: '4-8 h per job',
    },
    maxDirectCostUsd: {
      usd: 4,
      basis: 'estimate',
      note: 'Largest model-call user; must run under the per-build ceiling',
    },
    readiness: 'partial',
  },
  {
    id: 'K11',
    name: 'Compliant email sequence',
    outcome: 'Welcome and nurture emails that meet the Spam Act',
    clientMetric: 'both',
    inputs: ['displayName', 'legalName', 'nap', 'claimsFile', 'compliance'],
    artefacts: [
      {
        kind: 'in-repo',
        path: 'app/api/cron/welcome-sequence/route.ts',
        what: 'Welcome sequence cron',
        wired: true,
        testPath: 'tests/unit/api/cron-welcome-sequence.test.ts',
      },
      {
        kind: 'in-repo',
        path: 'app/api/cron/drip-day3/route.ts',
        what: 'Drip cron (day 3; day 7 and 14 alongside)',
        wired: true,
        testPath: 'tests/unit/api/cron-drip-day3.test.ts',
      },
      {
        kind: 'in-repo',
        path: 'app/api/newsletter/unsubscribe/route.ts',
        what: 'Newsletter unsubscribe route',
        wired: true,
        testPath: null,
      },
      {
        kind: 'missing',
        what: 'Unsubscribe fix (suppression check, RFC 8058, List-Unsubscribe headers): on branch origin/fix/unsubscribe-honoured, not on main',
        source: {
          type: 'build-in-house',
          reason: 'Already written on a branch; lands when that branch merges',
        },
      },
      {
        kind: 'missing',
        what: 'Sequence templates with the Spam Act footer and recorded consent source; suppression table for non-users',
        source: {
          type: 'build-in-house',
          reason:
            'Australian-specific; suppression table needs a protected migration',
        },
      },
    ],
    verifier: {
      status: 'to-build',
      description:
        'A send to a suppressed address is refused and every template carries sender identity and a working unsubscribe',
      path: null,
    },
    compliance: [
      'Spam Act 2003: consent, sender identification, working unsubscribe honoured within 5 working days, no login or fee',
      'APP 7: direct marketing opt-out',
    ],
    founderGates: ['Suppression table needs a protected migration'],
    minutesSavedPerJob: {
      low: 120,
      high: 120,
      basis: 'estimate',
      note: '2 h per job',
    },
    maxDirectCostUsd: {
      usd: 1,
      basis: 'estimate',
      note: 'Model calls for drafts; sending cost is running, not build',
    },
    readiness: 'partial',
  },
  {
    id: 'K12',
    name: 'Backlinks and digital PR',
    outcome: 'Prospects found, outreach sent and live links tracked',
    clientMetric: 'both',
    inputs: ['displayName', 'domains', 'claimsFile'],
    artefacts: [
      {
        kind: 'in-repo',
        path: 'lib/backlinks',
        what: 'Outreach templates and OpenPageRank scoring',
        wired: true,
        testPath: null,
      },
      {
        kind: 'in-repo',
        path: 'lib/pr',
        what: 'Press release and pitch builders',
        wired: true,
        testPath: 'tests/unit/api/pr-export-gate.test.ts',
      },
      {
        kind: 'in-repo',
        path: 'lib/authority',
        what: 'Authority sources',
        wired: true,
        testPath: 'tests/unit/api/authority-sources.test.ts',
      },
      {
        kind: 'missing',
        what: 'Prospect tracker, live link tracking and outreach sending',
        source: {
          type: 'build-in-house',
          reason: 'No open-source source found in the research',
        },
      },
    ],
    verifier: {
      status: 'to-build',
      description: 'A tracked link is re-crawled and reported live or lost',
      path: null,
    },
    compliance: [
      'Spam Act 2003: outreach email identifies the sender and offers opt-out',
      'ACL s18: no paid links presented as editorial',
    ],
    founderGates: ['None identified'],
    minutesSavedPerJob: {
      low: 180,
      high: 300,
      basis: 'estimate',
      note: '3-5 h per job',
    },
    maxDirectCostUsd: {
      usd: 2,
      basis: 'estimate',
      note: 'Model calls for pitches; OpenPageRank free tier assumed',
    },
    readiness: 'partial',
  },
  {
    id: 'K13',
    name: 'AI-answer visibility',
    outcome: 'Weekly view of whether answer engines cite the client',
    clientMetric: 'both',
    inputs: ['displayName', 'domains', 'claimsFile'],
    artefacts: [
      {
        kind: 'in-repo',
        path: 'lib/geo-citation',
        what: 'GEO citation monitor',
        wired: true,
        testPath: 'tests/unit/lib/geo-citation-monitor.test.ts',
      },
      {
        kind: 'in-repo',
        path: 'app/api/cron/geo-citation-monitor/route.ts',
        what: 'Weekly GEO citation cron (scheduled in vercel.json)',
        wired: true,
        testPath: null,
      },
      {
        kind: 'in-repo',
        path: 'lib/geo',
        what: 'GEO services',
        wired: true,
        testPath: null,
      },
      {
        kind: 'in-repo',
        path: 'lib/eeat',
        what: 'E-E-A-T services',
        wired: true,
        testPath: 'tests/unit/eeat/digest-summary.test.ts',
      },
      {
        kind: 'in-skills',
        path: 'geo-optimization',
        what: 'llms.txt template',
        port: 'Port the template into the site generator',
      },
      {
        kind: 'missing',
        what: 'Grounded answer-engine provider',
        source: {
          type: 'build-in-house',
          reason: 'Provider choice is founder-gated spend (answer-engine spec)',
        },
      },
    ],
    verifier: {
      status: 'exists',
      description: 'GEO citation monitor tests pass',
      path: 'tests/unit/lib/geo-citation-monitor.test.ts',
    },
    compliance: [
      'ACL s18: no claim of being recommended by an AI unless observed',
    ],
    founderGates: ['Paid answer-engine provider (spend)'],
    minutesSavedPerJob: {
      low: 60,
      high: 120,
      basis: 'estimate',
      note: '1-2 h per job',
    },
    maxDirectCostUsd: {
      usd: 2,
      basis: 'estimate',
      note: 'Depends on the provider chosen; must fit the per-build ceiling',
    },
    readiness: 'partial',
  },
  {
    id: 'K14',
    name: 'Monthly client report',
    outcome: 'A monthly report built from code, not Looker Studio',
    clientMetric: 'both',
    inputs: ['displayName', 'domains', 'clientMetric'],
    artefacts: [
      {
        kind: 'in-repo',
        path: 'app/api/cron/rank-snapshot/route.ts',
        what: 'Rank snapshot cron',
        wired: true,
        testPath: null,
      },
      {
        kind: 'in-repo',
        path: 'prisma/schema.prisma',
        what: 'ReportTemplate model',
        wired: true,
        testPath: null,
        note: 'model ReportTemplate at line 7402',
      },
      {
        kind: 'missing',
        what: 'Report-as-code template',
        source: {
          type: 'open-source',
          repo: 'evidence-dev/evidence',
          licence: 'MIT',
        },
      },
    ],
    verifier: {
      status: 'to-build',
      description:
        'Report renders with GA4 and GSC data for the month, and a missing source shows as unavailable, not zero',
      path: null,
    },
    compliance: ['ACL s18: report figures are measured, not estimated'],
    founderGates: ['Depends on K2 GA4 access'],
    minutesSavedPerJob: {
      low: 120,
      high: 180,
      basis: 'estimate',
      note: '2-3 h per job',
    },
    maxDirectCostUsd: {
      usd: 0.5,
      basis: 'estimate',
      note: 'Optional model call for the commentary',
    },
    readiness: 'missing',
  },
  {
    id: 'M',
    name: 'Client manifest (glue)',
    outcome:
      'One validated record per client holding the facts every kit reads',
    clientMetric: 'both',
    inputs: ['slug'],
    artefacts: [
      {
        kind: 'in-repo',
        path: 'lib/kits/schema.ts',
        what: 'ClientManifest zod schema',
        wired: false,
        testPath: 'tests/unit/kits/catalogue.test.ts',
      },
      {
        kind: 'in-repo',
        path: 'lib/kits/clients/carsi.ts',
        what: 'CARSI manifest',
        wired: false,
        testPath: 'tests/unit/kits/catalogue.test.ts',
      },
      {
        kind: 'in-repo',
        path: 'lib/kits/clients/restoreassist.ts',
        what: 'RestoreAssist manifest',
        wired: false,
        testPath: 'tests/unit/kits/catalogue.test.ts',
      },
      {
        kind: 'in-repo',
        path: 'lib/agency/portfolio-brand-configs.ts',
        what: 'Portfolio brand configs (source of manifest facts)',
        wired: true,
        testPath: 'tests/unit/agency/portfolio-brand-configs.test.ts',
      },
      {
        kind: 'in-repo',
        path: 'packages/brand-config/src/brands/carsi.claims.md',
        what: 'CARSI approved-claims register',
        wired: true,
        testPath: null,
      },
      {
        kind: 'in-repo',
        path: 'packages/brand-config/src/brands/ra.claims.md',
        what: 'RestoreAssist approved-claims register',
        wired: true,
        testPath: null,
      },
      {
        kind: 'missing',
        what: 'Fill the unknown facts (GBP ids, Bing Places ids, NAP, connected platforms, onboarding grants)',
        source: {
          type: 'build-in-house',
          reason: 'Facts come from the client at onboarding',
        },
      },
    ],
    verifier: {
      status: 'exists',
      description:
        'Both manifests validate through ClientManifest and every null is declared unknown',
      path: 'tests/unit/kits/catalogue.test.ts',
    },
    compliance: [
      'Records the compliance flags each kit carries (RTO status, trial terms)',
    ],
    founderGates: ['None identified'],
    minutesSavedPerJob: {
      low: 0,
      high: 0,
      basis: 'estimate',
      note: 'Enables all kits; saves nothing on its own',
    },
    maxDirectCostUsd: {
      usd: 0,
      basis: 'estimate',
      note: 'Data only',
    },
    readiness: 'partial',
  },
];
