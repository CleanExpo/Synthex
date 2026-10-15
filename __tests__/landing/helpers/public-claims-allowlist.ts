/**
 * Reviewed allow-list for the deny-by-default quantified-outcome rule
 * (SYN-1226). Each entry is one exact normalised sentence that contains a
 * quantity and an outcome noun but is NOT a factual outcome claim, with the
 * reason. Allowed reasons only:
 *  - advice:     guidance to the reader ("post 3 to 5 times per week")
 *  - definition: what a metric or term means
 *  - formula:    a worked formula with obviously hypothetical inputs
 *  - target:     a goal to aim for, not a result achieved
 *  - product-ui: describes the product or service (limits, steps, timings,
 *                labels), not a result anyone achieved
 * An unsupported factual claim is never allow-listed; it is removed instead.
 * `layer` says where the sentence is seen; unused entries fail the suites.
 */

export type AllowReason =
  | 'advice'
  | 'definition'
  | 'formula'
  | 'target'
  | 'product-ui';

export interface AllowEntry {
  sentence: string;
  reason: AllowReason;
  layer: 'source' | 'rendered';
  note?: string;
}

export const ALLOW_LIST: AllowEntry[] = [
  {
    sentence: '1 claim, 5 steps, the same report at the end.',
    reason: 'product-ui',
    layer: 'rendered',
    note: 'app/(landing)/restoreassist/insurers/page.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence: 'an mcp app stack has 4 cost layers.',
    reason: 'product-ui',
    layer: 'rendered',
    note: 'app/add-ons/mcp-app-development/page.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence: 'start with a 30-minute discovery conversation.',
    reason: 'product-ui',
    layer: 'rendered',
    note: 'app/add-ons/mcp-app-development/page.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence:
      'anonymised aggregate across 30 active synthex client accounts over the prior 90 days.',
    reason: 'product-ui',
    layer: 'rendered',
    note: "app/benchmark/page.tsx — renders the fixture data a populated page shows (the visitor's own or live cohort figures)",
  },
  {
    sentence:
      'based on 30 anonymised synthex client accounts, 17/07/2026–15/10/2026.',
    reason: 'product-ui',
    layer: 'rendered',
    note: "app/benchmark/page.tsx — renders the fixture data a populated page shows (the visitor's own or live cohort figures)",
  },
  {
    sentence:
      'based on 30 anonymised synthex client accounts, distinct active platforms as of 15/10/2026.',
    reason: 'product-ui',
    layer: 'rendered',
    note: "app/benchmark/page.tsx — renders the fixture data a populated page shows (the visitor's own or live cohort figures)",
  },
  {
    sentence:
      'claims are computed over the rolling 90-day window ending at the time the page was last rendered.',
    reason: 'definition',
    layer: 'rendered',
    note: 'app/benchmark/page.tsx — benchmark methodology and disclosure rule (threshold and window are set in code)',
  },
  {
    sentence:
      'the page revalidates every 10 minutes, so figures refresh throughout the day without changing mid-visit.',
    reason: 'definition',
    layer: 'rendered',
    note: 'app/benchmark/page.tsx — benchmark methodology and disclosure rule (threshold and window are set in code)',
  },
  {
    sentence:
      'the synthex client cohort has not yet reached our minimum disclosure threshold of 25 accounts.',
    reason: 'definition',
    layer: 'rendered',
    note: 'app/benchmark/page.tsx — benchmark methodology and disclosure rule (threshold and window are set in code)',
  },
  {
    sentence:
      'we only publish a claim once the cohort contains at least 25 active client accounts.',
    reason: 'definition',
    layer: 'rendered',
    note: 'app/benchmark/page.tsx — benchmark methodology and disclosure rule (threshold and window are set in code)',
  },
  {
    sentence:
      '4+ years product design -figma expertise -saas experience -user research skills',
    reason: 'product-ui',
    layer: 'rendered',
    note: 'app/careers/page.tsx — job listing title or role requirement',
  },
  {
    sentence:
      '5+ years growth marketing -b2b saas experience -analytics expertise -content marketing',
    reason: 'product-ui',
    layer: 'rendered',
    note: 'app/careers/page.tsx — job listing title or role requirement',
  },
  {
    sentence:
      'you can reach fixture business name by phone at +61 2 1111 1111 or visit their website at',
    reason: 'product-ui',
    layer: 'rendered',
    note: "app/clients/[slug]/page.tsx — renders the fixture data a populated page shows (the visitor's own or live cohort figures)",
  },
  {
    sentence: '2.click "connect" on any platform below to enter your api keys',
    reason: 'product-ui',
    layer: 'rendered',
    note: 'app/demo/integrations/page.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence:
      '01resolve buyer uncertainty first78%incomplete comparison and usage proof prevents qualified buyers from resolving uncertainty before purchase.',
    reason: 'product-ui',
    layer: 'rendered',
    note: 'app/intentscape/page.tsx — confidence figure in the sample output of the interactive demo (components/intentscape/demo-data.ts)',
  },
  {
    sentence:
      '02repair offer-to-audience fit69%the active audience prioritises a different outcome, so polished creative attracts attention without intent.target buyer · product owner',
    reason: 'product-ui',
    layer: 'rendered',
    note: 'app/intentscape/page.tsx — confidence figure in the sample output of the interactive demo (components/intentscape/demo-data.ts)',
  },
  {
    sentence:
      '03build a creative learning system73%disconnected asset production prevents the team from learning which proof, format and audience combination changes behaviour.marketing operator · creative team',
    reason: 'product-ui',
    layer: 'rendered',
    note: 'app/intentscape/page.tsx — confidence figure in the sample output of the interactive demo (components/intentscape/demo-data.ts)',
  },
  {
    sentence: 'direction 02repair offer-to-audience fit69% confidence',
    reason: 'product-ui',
    layer: 'rendered',
    note: 'app/intentscape/page.tsx — confidence figure in the sample output of the interactive demo (components/intentscape/demo-data.ts)',
  },
  {
    sentence:
      'synthex turns them into 3 ranked growth directions, showing what it found, what it inferred and what it still needs to learn.',
    reason: 'product-ui',
    layer: 'rendered',
    note: 'app/opportunity-map/page.tsx — describes what the Opportunity Map returns',
  },
  {
    sentence:
      'it returns 3 ranked growth directions, the evidence used, and the gaps still unknown.',
    reason: 'product-ui',
    layer: 'rendered',
    note: 'app/page.tsx — describes what the Opportunity Map returns',
  },
  {
    sentence:
      'synthex returns 3 ranked growth directions, the sources used, and the gaps still unknown.',
    reason: 'product-ui',
    layer: 'rendered',
    note: 'app/page.tsx — describes what the Opportunity Map returns',
  },
  {
    sentence:
      'pilot for the entire training-video system · 4 scenes · ~45 min recording time',
    reason: 'product-ui',
    layer: 'rendered',
    note: 'app/quick-access-preview/page.tsx — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence:
      't+1 origin · t+30 reflection · founder voice tag · placeholder claims need verifying',
    reason: 'product-ui',
    layer: 'rendered',
    note: 'app/quick-access-preview/page.tsx — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence: 'things only you can do · most under 30 minutes',
    reason: 'product-ui',
    layer: 'rendered',
    note: 'app/quick-access-preview/page.tsx — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence: '⏱ 3 minone-time',
    reason: 'product-ui',
    layer: 'rendered',
    note: 'app/quick-access-preview/page.tsx — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence:
      '12 pieces: 1 founder origin · 1 nir explainer · 3 product scenes · 1 carousel comparison · 6 customer-quote placeholders.',
    reason: 'product-ui',
    layer: 'rendered',
    note: 'app/vision-board-preview/ra-launch-2026-05/page.tsx — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence:
      'mirrors linear comments tagged [decision] into ~/synthex-brain-2/04-decisions/',
    reason: 'product-ui',
    layer: 'rendered',
    note: 'app/vision-board-preview/ra-launch-2026-05/page.tsx — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence:
      'synthex ↔ brain-2 ↔ pi-ceo ↔ linear ↔ supabase wiring · checked at request time',
    reason: 'product-ui',
    layer: 'rendered',
    note: 'app/vision-board-preview/ra-launch-2026-05/page.tsx — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence:
      'verify the re-inspection figure used in the linkedin drumbeat t+9 carousel and founder post t+1',
    reason: 'product-ui',
    layer: 'rendered',
    note: 'app/vision-board-preview/ra-launch-2026-05/page.tsx — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence: '8 posts · 1234 reach',
    reason: 'product-ui',
    layer: 'rendered',
    note: "app/welcome/page.tsx — renders the fixture data a populated page shows (the visitor's own or live cohort figures)",
  },
  {
    sentence: '1 claim, 5 steps, the same report at the end.',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/(landing)/restoreassist/insurers/page.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence: 'an mcp app stack has 4 cost layers.',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/add-ons/mcp-app-development/page.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence:
      'cost model: framework (free) vs hosting (alpic or self-host) vs ongoing opsgo/no-go recommendation — no obligation to proceed to buildbuild + launchscoped from discovery — typical aud 12000–35000',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/add-ons/mcp-app-development/page.tsx — indicative service quote for the add-on; an offer term, not a result (pricing out of scope)',
  },
  {
    sentence: 'start with a 30-minute discovery conversation.',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/add-ons/mcp-app-development/page.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence: '9 platforms, 1 brand voice📊no time to analyse what works',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/agencies/page.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence: 'track your social media performance and engagement last 7 days',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/analytics/AnalyticsClient.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence:
      "this is an oauth 1.0a api key; synthex needs the oauth 2.0 client id — copy it from the app's keys-and-tokens 'oauth 2.0 client id and client secret' section",
    reason: 'product-ui',
    layer: 'source',
    note: 'app/api/admin/platform-credentials/route.ts — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence:
      'return a json object with: { "optimized": "the optimized content", "suggestions": ["improvement 1", "improvement 2", ...], "changes": ["change 1", "change 2", ...] } keep the core message but enhance engagement.',
    reason: 'advice',
    layer: 'source',
    note: 'app/api/ai-content/optimize/route.ts — instruction inside an AI prompt; tells the model what to produce, never shown as a claim',
  },
  {
    sentence: '2023-06-01 user',
    reason: 'advice',
    layer: 'source',
    note: 'app/api/demo/caption/route.ts — instruction inside an AI prompt; tells the model what to produce, never shown as a claim',
  },
  {
    sentence:
      'bearer user write a single instagram caption (2-3 sentences, 1-2 hashtags) for a business called "',
    reason: 'advice',
    layer: 'source',
    note: 'app/api/demo/caption/route.ts — instruction inside an AI prompt; tells the model what to produce, never shown as a claim',
  },
  {
    sentence:
      'user write a single instagram caption (2-3 sentences, 1-2 hashtags) for a business called "',
    reason: 'advice',
    layer: 'source',
    note: 'app/api/demo/caption/route.ts — instruction inside an AI prompt; tells the model what to produce, never shown as a claim',
  },
  {
    sentence: '60 rate limit exceeded',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/api/internal/sign-lead/route.ts — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence: 'lead capture temporarily unavailable post 60',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/api/internal/sign-lead/route.ts — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence:
      'adding a 5-second preview clip would let the reviewer hear what the launch will sound like.',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/api/internal/vision-board/ai-commentary/route.ts — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence:
      'have pi-ceo research lead pull pricing + installed-base data for the 3 competitors.',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/api/internal/vision-board/ai-commentary/route.ts — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence: 'scene 4 carries the entire 5-step claim in 18s.',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/api/internal/vision-board/ai-commentary/route.ts — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence: '1.0x engagement',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/api/stats/route.ts — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence: 'users 1.0x',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/api/stats/route.ts — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence:
      'claims are computed over the rolling 90-day window ending at the time the page was last rendered.',
    reason: 'definition',
    layer: 'source',
    note: 'app/benchmark/page.tsx — benchmark methodology and disclosure rule (threshold and window are set in code)',
  },
  {
    sentence:
      'the page revalidates every 10 minutes, so figures refresh throughout the day without changing mid-visit.',
    reason: 'definition',
    layer: 'source',
    note: 'app/benchmark/page.tsx — benchmark methodology and disclosure rule (threshold and window are set in code)',
  },
  {
    sentence:
      'the synthex client cohort has not yet reached our minimum disclosure threshold of 25 accounts.',
    reason: 'definition',
    layer: 'source',
    note: 'app/benchmark/page.tsx — benchmark methodology and disclosure rule (threshold and window are set in code)',
  },
  {
    sentence:
      'we only publish a claim once the cohort contains at least 25 active client accounts.',
    reason: 'definition',
    layer: 'source',
    note: 'app/benchmark/page.tsx — benchmark methodology and disclosure rule (threshold and window are set in code)',
  },
  {
    sentence: '2machine learning engineerremotefull-time',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/careers/CareersClient.tsx — job listing title or role requirement',
  },
  {
    sentence: '4 customer success manager',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/careers/CareersClient.tsx — job listing title or role requirement',
  },
  {
    sentence:
      '4+ years product design figma expertise saas experience user research skills',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/careers/CareersClient.tsx — job listing title or role requirement',
  },
  {
    sentence: '5 growth marketing manager',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/careers/CareersClient.tsx — job listing title or role requirement',
  },
  {
    sentence: '5+ years growth marketing',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/careers/CareersClient.tsx — job listing title or role requirement',
  },
  {
    sentence: 'user research skills 4',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/careers/CareersClient.tsx — job listing title or role requirement',
  },
  {
    sentence: '2-factor authentication supportimproved api rate limiting',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/changelog/page.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence:
      'improved api rate limitingsecurity audit compliance updatesgdpr compliance enhancements1.3.0',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/changelog/page.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence: 'response rate review quality social proof 30',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/clients/[slug]/page.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence:
      'synthex ↔ brain-2 ↔ pi-ceo ↔ linear ↔ supabase wiring · checked at request time',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/dashboard/admin/vision-board/ra-launch-2026-05/panels/ConnectionStatusPanel.tsx — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence:
      '12 pieces: 1 founder origin · 1 nir explainer · 3 product scenes · 1 carousel comparison · 6 customer-quote placeholders.',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/dashboard/admin/vision-board/ra-launch-2026-05/panels/CopyPanel.tsx — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence:
      '2 distinct types — building restoration services vs professional restoration services (iicrc) scope correctly documented · paid in full for work performed customer',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/dashboard/admin/vision-board/ra-launch-2026-05/panels/EvidencePanel.tsx — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence:
      'customer policyholder property habitable · communication · predictability figure 2 — the 3-layer commercial chain in australian insurance restoration',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/dashboard/admin/vision-board/ra-launch-2026-05/panels/EvidencePanel.tsx — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence:
      'pull the senate inquiry "flood failure to future fairness" final report — extract specific cycle-time and complaint-volume figurespull the afca fy24 annual review — extract top-3 complaint reasons and percentages for general insurance',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/dashboard/admin/vision-board/ra-launch-2026-05/panels/EvidencePanel.tsx — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence:
      'verify the re-inspection figure used in the linkedin drumbeat t+9 carousel and founder post t+1',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/dashboard/admin/vision-board/ra-launch-2026-05/panels/EvidencePanel.tsx — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence: 'click "connect" on any platform below to enter your api keys 3.',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/demo/integrations/page.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence:
      'each user connects their own social media accounts using their own api credentials 2.',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/demo/integrations/page.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence:
      'you can revoke access at any time from this page some features may require re-authentication after 30 days',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/demo/integrations/page.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence: 'perfect for growing businesses $249',
    reason: 'product-ui',
    layer: 'source',
    note: "app/demo/settings/page.tsx — plan price shown in the settings demo; pricing is out of this branch's scope",
  },
  {
    sentence: '$24500active users',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/design-system/DesignSystemClient.tsx — component specimen with placeholder values on the design-system reference page',
  },
  {
    sentence: '8420bounce rate',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/design-system/DesignSystemClient.tsx — component specimen with placeholder values on the design-system reference page',
  },
  {
    sentence: 'active users 8420',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/design-system/DesignSystemClient.tsx — component specimen with placeholder values on the design-system reference page',
  },
  {
    sentence: 'bounce rate 32.4%',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/design-system/DesignSystemClient.tsx — component specimen with placeholder values on the design-system reference page',
  },
  {
    sentence: 'last updated 2 hours ago - 1.2000 views - 45 shares',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/design-system/DesignSystemClient.tsx — component specimen with placeholder values on the design-system reference page',
  },
  {
    sentence: 'total revenue$24500',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/design-system/DesignSystemClient.tsx — component specimen with placeholder values on the design-system reference page',
  },
  {
    sentence:
      '02ai builds your brand dnawithin seconds, a complete brand profile is built: your unique tone, values, visual identity, and audience signals.',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/features/ai-content/page.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence:
      'community-focused posts with engagement promptsseo-optimised descriptions with timestampsx (twitter)punchy threads and single posts under 280 chars',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/features/ai-content/page.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence:
      'content that sounds like you,written by ai synthex learns your brand voice and generates platform-native content for all 9 platforms.',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/features/ai-content/page.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence:
      'features should feel like cards, not a maze synthex is easiest to understand as 5 steps: capture the idea, ground the plan, choose assets, approve production and learn from the outcome.',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/features/page.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence: '3 ranked growth directions from your public evidence.',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/opengraph-image.tsx — describes what the Opportunity Map returns',
  },
  {
    sentence:
      'turn your website, social links and rough context into 3 evidence-backed growth directions and 1 clear next move.',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/opportunity-map/page.tsx — describes what the Opportunity Map returns',
  },
  {
    sentence:
      'turn your website and public evidence into 3 ranked growth directions.',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/page.tsx — describes what the Opportunity Map returns',
  },
  {
    sentence:
      'encrypted api calls, no data retention jwt tokens with secure httponly cookies oauth 2.0 support (google, github, linkedin)',
    reason: 'product-ui',
    layer: 'source',
    note: 'app/security/page.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence:
      'copy all 4 values to synthexvisit linkedin.com/developerscreate a new app or select existinggo to "auth" tab for client id & secret',
    reason: 'product-ui',
    layer: 'source',
    note: 'components/IntegrationModal.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence:
      'go to "auth" tab for client id & secretuse oauth 2.0 tools to generate access token',
    reason: 'product-ui',
    layer: 'source',
    note: 'components/IntegrationModal.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence: '3 3 date likes',
    reason: 'product-ui',
    layer: 'source',
    note: 'components/analytics/EngagementTrendsChart.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence: 'view upcoming award submission deadlines within 90 days',
    reason: 'product-ui',
    layer: 'source',
    note: 'components/command-palette/commands.ts — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence: 'synthex returns 3 researched directions and a brief you control',
    reason: 'product-ui',
    layer: 'source',
    note: 'components/intentscape/IntentScapeProductTour.tsx — describes what the Opportunity Map returns',
  },
  {
    sentence: '3 sources linked · confidence high plan audience',
    reason: 'product-ui',
    layer: 'source',
    note: 'components/landing/premium/hero-product-mock.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence:
      'synthex returns 3 ranked growth directions, the sources used, and the gaps still unknown.',
    reason: 'product-ui',
    layer: 'source',
    note: 'components/landing/premium/hero-section.tsx — describes what the Opportunity Map returns',
  },
  {
    sentence:
      'it returns 3 ranked growth directions, the evidence used, and the gaps still unknown.',
    reason: 'product-ui',
    layer: 'source',
    note: 'components/landing/premium/landing-faq-data.ts — describes what the Opportunity Map returns',
  },
  {
    sentence:
      '03 studiocampaign buildsynthex turns the approved direction into storyboards, posts, thumbnails, emails, lead magnets and gen media briefs.',
    reason: 'product-ui',
    layer: 'source',
    note: 'components/landing/public-v2.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence: '04 learn roi feedback',
    reason: 'product-ui',
    layer: 'source',
    note: 'components/landing/public-v2.tsx — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence:
      'synthex turns them into 3 ranked growth directions, showing what it found, what it inferred and what it still needs to learn.',
    reason: 'product-ui',
    layer: 'source',
    note: 'components/opportunity-map/OpportunityMapExperience.tsx — describes what the Opportunity Map returns',
  },
  {
    sentence: '**audience resonance**: [how target audience will perceive] 5.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/ai/agents/strategic-marketing/agent-prompts.ts — instruction inside an AI prompt; tells the model what to produce, never shown as a claim',
  },
  {
    sentence:
      '**competitive differentiation**: [how it stands out psychologically] ## quality filters: - pronunciation ease (avoid cognitive load) - cultural sensitivity check - trademark likelihood assessment - domain availability consideration - social media handle viability ## input: - psychological strategy: {psychology_analysis} - business category: {business_type} - target audience: {demographics} - brand personality: {desired_traits} generate 5 strategically different names, each optimized for different psychological pathways.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/ai/agents/strategic-marketing/agent-prompts.ts — instruction inside an AI prompt; tells the model what to produce, never shown as a claim',
  },
  {
    sentence:
      '**memorability enhancers**: [linguistic devices used] ## optimization criteria: - length: 3-7 words (optimal cognitive processing) - clarity: instantly understandable - uniqueness: psychologically distinctive - scalability: works across platforms ## input: - brand name: {selected_brand_name} - psychology strategy: {identified_triggers} - audience profile: {target_demographics} - brand values: {core_values} create 5 taglines, each emphasizing different psychological pathways.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/ai/agents/strategic-marketing/agent-prompts.ts — instruction inside an AI prompt; tells the model what to produce, never shown as a claim',
  },
  {
    sentence:
      '**motivation & emotion** (1 principle) ## analysis framework: for each client request, identify: ### primary triggers (3-5 most relevant): - **principle name**: [specific psychological effect] - **relevance score**: [1-10 based on audience/product fit] - **implementation strategy**: [how to embed in branding] - **expected impact**: [predicted consumer response] ### supporting triggers (2-3 complementary): - **secondary effects**: [principles that enhance primary triggers] - **amplification methods**: [how to compound psychological impact] ### avoid conflicts: - **contradictory biases**: [principles that would cancel each other] - **audience misalignment**: [effects that might backfire] ## input: business type: {business_type} target demographic: {target_audience} brand goals: {brand_objectives} market position: {competitive_landscape} ## output: provide psychological strategy blueprint in json format for other agents to execute.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/ai/agents/strategic-marketing/agent-prompts.ts — instruction inside an AI prompt; tells the model what to produce, never shown as a claim',
  },
  {
    sentence: "analyze the client's input for implicit psychological needs 2.",
    reason: 'advice',
    layer: 'source',
    note: 'lib/ai/agents/strategic-marketing/agent-prompts.ts — instruction inside an AI prompt; tells the model what to produce, never shown as a claim',
  },
  {
    sentence:
      '"according to the abs, ...") - end with a 3-column summary table: topic | key point | source - write in a factual, authoritative tone — optimise for 0-click answers',
    reason: 'advice',
    layer: 'source',
    note: 'lib/ai/content-generator.ts — instruction inside an AI prompt; tells the model what to produce, never shown as a claim',
  },
  {
    sentence:
      'content structure — comparison: - h1: "[option a] vs [option b]: which is right for you?" - summary table at the top (at least 5 comparison rows) - h2 for each option with pros and cons - conclusion recommending based on use case content structure — case study: - h1: "how [business] helped [client type] [achieve result]" - sections: the challenge | our approach | the results | client testimonial - include specific metrics (numbers, percentages, timeframes) - end with cta to book a consultation',
    reason: 'advice',
    layer: 'source',
    note: 'lib/ai/content-generator.ts — instruction inside an AI prompt; tells the model what to produce, never shown as a claim',
  },
  {
    sentence:
      'content structure — listicle: - h1: "[number] best [thing] in [suburb/area] ([year])" - each item as a numbered h2 - include the business as 1 of the items (not first) - end with a comparison summary table (3 columns: provider | specialty | contact) content structure — news item: - h1: newsy headline with location and date - lead paragraph: who, what, when, where, why (inverted pyramid) - include 1 quote from a named source - end with "about [business name]" boilerplate paragraph',
    reason: 'advice',
    layer: 'source',
    note: 'lib/ai/content-generator.ts — instruction inside an AI prompt; tells the model what to produce, never shown as a claim',
  },
  {
    sentence:
      'content structure — news item: - h1: newsy headline with location and date - lead paragraph: who, what, when, where, why (inverted pyramid) - include 1 quote from a named source - end with "about [business name]" boilerplate paragraphcomparison content structure — comparison: - h1: "[option a] vs [option b]: which is right for you?" - summary table at the top (at least 5 comparison rows) - h2 for each option with pros and cons - conclusion recommending based on use case',
    reason: 'advice',
    layer: 'source',
    note: 'lib/ai/content-generator.ts — instruction inside an AI prompt; tells the model what to produce, never shown as a claim',
  },
  {
    sentence: 'add 1-2 relevant emojis to increase visual appeal and reach',
    reason: 'advice',
    layer: 'source',
    note: 'lib/ai/content-scorer.ts — content-improvement suggestion shown to the user',
  },
  {
    sentence:
      'emojis boost twitter engagement and expand visual presenceinstagraminstagram posts without hashtags have lower discoveryadd 5-15 relevant hashtags for instagram discoverability',
    reason: 'advice',
    layer: 'source',
    note: 'lib/ai/content-scorer.ts — content-improvement suggestion shown to the user',
  },
  {
    sentence:
      'facebook posts with 250-500 characters tend to get better organic reach',
    reason: 'advice',
    layer: 'source',
    note: 'lib/ai/content-scorer.ts — content-improvement suggestion shown to the user',
  },
  {
    sentence:
      "linkedin posts without paragraph breaks have lower reach add blank lines between paragraphs for linkedin's algorithm too many hashtags for linkedin (optimal: 2-5)",
    reason: 'advice',
    layer: 'source',
    note: 'lib/ai/content-scorer.ts — content-improvement suggestion shown to the user',
  },
  {
    sentence: '% engagement no published posts yet **7-day activity:**',
    reason: 'advice',
    layer: 'source',
    note: 'lib/ai/project-manager/context-builder.ts — instruction inside an AI prompt; tells the model what to produce, never shown as a claim',
  },
  {
    sentence: '· response rate (90d):',
    reason: 'advice',
    layer: 'source',
    note: 'lib/ai/project-manager/context-builder.ts — instruction inside an AI prompt; tells the model what to produce, never shown as a claim',
  },
  {
    sentence:
      '## expected format { "actionitems": [ { "title": "short action title", "description": "brief description of what to do", "priority": "high" | "medium" | "low" } ], "suggestions": [ { "type": "content" | "growth" | "optimization" | "feature", "title": "short suggestion title", "description": "brief explanation", "actionurl": "/dashboard/..." (optional path to relevant feature) } ] } rules: - extract only items explicitly mentioned or strongly implied in the response - maximum 3 action items and 3 suggestions - if none found, return empty arrays - priority: "high" = do today, "medium" = this week, "low" = when convenient',
    reason: 'advice',
    layer: 'source',
    note: 'lib/ai/project-manager/system-prompts.ts — instruction inside an AI prompt; tells the model what to produce, never shown as a claim',
  },
  {
    sentence:
      "**competitor intel**: alert them to competitor moves and opportunities ## response format - keep responses concise (under 300 words unless asked to elaborate) - use markdown for structure when helpful - when suggesting actions, include the specific dashboard section or url path - always extract actionable items and tag them (you'll see instructions for structured data below) ## structured data extraction after each response, mentally identify: - **action items**: specific tasks the user should do (with priority: high/medium/low) - **suggestions**: feature recommendations or strategy tips (with type: content/growth/optimization/feature) these will be extracted programmatically — write naturally and the system handles parsing.",
    reason: 'advice',
    layer: 'source',
    note: 'lib/ai/project-manager/system-prompts.ts — instruction inside an AI prompt; tells the model what to produce, never shown as a claim',
  },
  {
    sentence:
      '**growth coaching**: provide actionable tips to grow their audience 7.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/ai/project-manager/system-prompts.ts — instruction inside an AI prompt; tells the model what to produce, never shown as a claim',
  },
  {
    sentence:
      "**opportunities** (1-2 items): growth opportunities based on trends ## tone - energetic and positive — start their week right - data-backed — reference specific numbers - forward-looking — focus on what's ahead, not just what happened - brief — the whole digest should be readable in 2 minutes ## rules - lead with the most exciting metric or win - if it was a tough week (declining metrics), frame it constructively with clear recovery steps - always end with an encouraging forward-looking statement - include specific synthex features that could help with each action item",
    reason: 'advice',
    layer: 'source',
    note: 'lib/ai/project-manager/system-prompts.ts — instruction inside an AI prompt; tells the model what to produce, never shown as a claim',
  },
  {
    sentence:
      '**reputation** (1-2 sentences): review response rate, average rating, any unreplied reviews needing attention 4.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/ai/project-manager/system-prompts.ts — instruction inside an AI prompt; tells the model what to produce, never shown as a claim',
  },
  {
    sentence:
      '>", "suggestedpersonaname": " ", "confidence": <0-100 integer — how confident you are in these results> } rules: - industry must be 1 of the exact values listed above - suggestedtone must be 1 of the exact values listed above - teamsize must be 1 of the exact values listed above - socialhandles should map detected social links to platform keys (twitter, instagram, linkedin, facebook, youtube, tiktok, pinterest, reddit, threads) - if you cannot determine a value, make your best guess and lower the confidence score - return only valid json, no markdown fences or explanation',
    reason: 'advice',
    layer: 'source',
    note: 'lib/ai/website-analyzer.ts — instruction inside an AI prompt; tells the model what to produce, never shown as a claim',
  },
  {
    sentence:
      '— best guess based on signals>", "brandcolors": { "primary": " ", "secondary": " ", "accent": " " }, "socialhandles": { " ": " " }, "keytopics": [" ", " ", " "], "targetaudience": "<1-2 sentence description of target audience>", "suggestedtone": "<1 of:',
    reason: 'advice',
    layer: 'source',
    note: 'lib/ai/website-analyzer.ts — instruction inside an AI prompt; tells the model what to produce, never shown as a claim',
  },
  {
    sentence: 'active synthex client accounts over the prior 90 days.',
    reason: 'definition',
    layer: 'source',
    note: 'lib/analytics/public-benchmarks.ts — benchmark methodology and disclosure rule (threshold and window are set in code)',
  },
  {
    sentence:
      'anonymised synthex client accounts, –posts published in the last 90 days',
    reason: 'definition',
    layer: 'source',
    note: 'lib/analytics/public-benchmarks.ts — benchmark methodology and disclosure rule (threshold and window are set in code)',
  },
  {
    sentence: 'posts published in the last 90 daysactive client accounts',
    reason: 'definition',
    layer: 'source',
    note: 'lib/analytics/public-benchmarks.ts — benchmark methodology and disclosure rule (threshold and window are set in code)',
  },
  {
    sentence: '100 rate limit exceeded.',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/config/scaling.config.ts — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence: '2000 rate limit exceeded.',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/config/scaling.config.ts — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence: '500 rate limit exceeded.',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/config/scaling.config.ts — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence: '" style="font-size:0.875em;color:;" rel="noopener">view',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/content/layout-renderer.ts — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence: 'this link will expire in 24 hours.',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/email/email-service.ts — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence:
      '" style="display:inline-block;background:#f59e0b;color:#050508;font-size:12px;font-weight:500;padding:10px 20px;border-radius:3px;text-decoration:none;"> learn more about synthex <!-- footer --> center you received this email because you joined the synthex waitlist.',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/email/waitlist-email.ts — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence:
      'of 2 , previous_gate_rejections: none return a visionmap that satisfies the structured schema and the system policy.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/intentscape/model-adapters.ts — instruction inside an AI prompt; tells the model what to produce, never shown as a claim',
  },
  {
    sentence: 'critical errors in last 5 minutes',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/observability/health-dashboard.ts — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence: 'errors in last 5 minutes',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/observability/health-dashboard.ts — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence: 'target audience social channels business identifier $1',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/opportunity-map/index.ts — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence:
      'brain-2 ↔ pi-ceo (read)vault sees pi-ceo content for obsidian graph view',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/quick-access/connection-status.ts — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence:
      'mirrors linear comments tagged [decision] into ~/synthex-brain-2/04-decisions/',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/quick-access/connection-status.ts — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence:
      '"flood failure to future fairness" oct 2024 · pull cycle-time + complaint-volume dataraevidence-base §1.1',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/quick-access/items.ts — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence:
      'evidence-base §4.2changes-requiredverificationre-inspection rate figure',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/quick-access/items.ts — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence:
      'land clips at 00-inbox/clips/ with the right template portfolio 1-time',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/quick-access/items.ts — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence:
      'land clips at 00-inbox/clips/ with the right templateportfolioone-time',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/quick-access/items.ts — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence:
      'open synthex-brain-2 in obsidian 1-time vault setup · adds graph view across portfolio operations',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/quick-access/items.ts — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence:
      'open synthex-brain-2 in obsidianone-time vault setup · adds graph view across portfolio operations',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/quick-access/items.ts — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence:
      'pilot for the entire training-video system · 4 scenes · ~45 min recording time',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/quick-access/items.ts — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence:
      're-inspection rate figuresource it or replace with the structural argument (already drafted)ralinkedin t+4 carousel',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/quick-access/items.ts — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence:
      't+1 origin · t+30 reflection · founder voice tag · placeholder claims need verifying',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/quick-access/items.ts — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence: 'things only you can do · most under 30 minutes',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/quick-access/items.ts — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence:
      'unlocks 39 more videoschanges-requiredverificationsenate inquiry · cycle-time figures',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/quick-access/items.ts — internal operator dashboard label, task item or storyboard note',
  },
  {
    sentence: '"1000 engaged followers beat 100000 passive ones" | synthex',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence: '"1000 engaged followers will always beat 100000 passive ones."',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence: '4 to 6 weeks allows enough time for momentum to build.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence: '5 linkedin best practices for business growth | synthex',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence: '5 linkedin best practices for business growth.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence: '5 social media mistakes killing your growth | synthex',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence: '5 social media mistakes that are silently killing your growth.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence: '6 instagram growth tactics that work in 2026 | synthex',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence: '6 instagram growth tactics that work in 2026.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence: '7 ways to increase social media engagement | synthex',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence: '7 ways to increase your social media engagement.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence:
      'a strong content strategy has 4 pillars: clear goals tied to business outcomes, deep audience understanding, a defined content mix across education, entertainment, and promotion,',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence: 'book a 20-minute live demo with the synthex team.',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — describes a Synthex feature or offer in a how-to video',
  },
  {
    sentence:
      'choosing 3 to 5 tone descriptors like friendly, expert, or bold,',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence:
      'competitive analysis tip: spend 30 minutes a month studying your top 3 competitors.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence:
      'conversion social media synthex 3 cta formulas that drive action.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence:
      'defining your brand voice takes 3 things: knowing your audience,',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence: 'divided by total reach, multiplied by 100.',
    reason: 'formula',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — worked formula or example with hypothetical inputs',
  },
  {
    sentence: 'engagement synthex 3 secrets behind viral social media content.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence:
      'example: 10 sign-ups from 500 link clicks equals a 2 percent conversion rate.',
    reason: 'formula',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — worked formula or example with hypothetical inputs',
  },
  {
    sentence:
      'example: 100 interactions on a post seen by 2000 people equals a 5 percent engagement rate.',
    reason: 'formula',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — worked formula or example with hypothetical inputs',
  },
  {
    sentence:
      'example: a post seen by 3000 people without any boosting has a reach of 3000.',
    reason: 'formula',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — worked formula or example with hypothetical inputs',
  },
  {
    sentence:
      'example: a skincare brand partnering with a dermatologist who has 200000 instagram followers.',
    reason: 'formula',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — worked formula or example with hypothetical inputs',
  },
  {
    sentence:
      'example: posting the same content with 2 different opening lines to 2 audience segments,',
    reason: 'formula',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — worked formula or example with hypothetical inputs',
  },
  {
    sentence: 'follower count alone means nothing without these 5.',
    reason: 'definition',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — defines a social media metric',
  },
  {
    sentence:
      'formula: conversions divided by total visitors, multiplied by 100.',
    reason: 'formula',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — worked formula or example with hypothetical inputs',
  },
  {
    sentence:
      'grow your instagram following with these 6 tactics that work right now.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence: 'here are 7 proven content types that build audiences.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence:
      'how to build a linkedin presence that attracts clients — 5 steps.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence:
      'how to run a social media campaign that delivers real results — 5 steps.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence: 'how to write a brand voice guide in 30 minutes | synthex',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence: 'how to write a brand voice guide in 30 minutes — 5 steps.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence:
      'how to write social media captions that drive real engagement — 5 steps.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence:
      'in days 61 to 90: scale what works, experiment with video, and start growing your following intentionally.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence:
      'in this explainer: • the 4 pillars of a content strategy • how to choose your content mix • why strategy beats volume every time start free: #contentstrategy #socialmediamarketing #digitalmarketing #synthex',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence: 'like "100 new leads" or "500 link clicks."',
    reason: 'target',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — example goal to aim for, not a result',
  },
  {
    sentence:
      'mistake 3: only promoting, never educating or entertaining — the 3 to 1 rule keeps audiences engaged.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence: 'most businesses operate with 3 to 5 pillars.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence:
      'open campaign planner, enter your campaign goal and target audience, and synthex generates a 30-day content calendar — 1 post per day, across all your connected',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — describes a Synthex feature or offer in a how-to video',
  },
  {
    sentence:
      'scheduling a month of content in minutes | synthexdiscover how the synthex campaign planner generates a 30-day content calendar across all your platforms — then schedules everything automatically.',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — describes a Synthex feature or offer in a how-to video',
  },
  {
    sentence:
      'see synthex create real content for your business in a live 20-minute demo.',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — describes a Synthex feature or offer in a how-to video',
  },
  {
    sentence:
      'set aside 2 hours once a week to create all your social posts at once.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence: 'social media growth small business 90 day plan',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence: 'spend 15 minutes engaging with accounts in your niche',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence: 'step 4: reply to every comment in the first 60 minutes.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence:
      'the 90-day roadmap every small business should follow for social media growth.',
    reason: 'advice',
    layer: 'source',
    note: 'lib/remotion/educational-content.ts — marketing advice or a listicle title in an educational video script',
  },
  {
    sentence:
      'turn your website and public evidence into 3 ranked growth directions, then run approval-gated campaigns.',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/seo/metadata.ts — describes what the Opportunity Map returns',
  },
  {
    sentence:
      'x oauth 2.0 client credentials (twitter_client_id/secret) not configured',
    reason: 'product-ui',
    layer: 'source',
    note: 'lib/social/twitter-sync-service.ts — describes the product, a limit, a step, a timing or a label',
  },
  {
    sentence:
      "built for users who don't want to hire an agency but want agency-quality output 24/7.",
    reason: 'product-ui',
    layer: 'source',
    note: 'public/llms.txt — describes who the product is built for',
  },
];

export const allowKeys = (layer: AllowEntry['layer']) =>
  new Set(
    ALLOW_LIST.filter(e => e.layer === layer).map(e =>
      e.sentence.replace(/\s+/g, '')
    )
  );
