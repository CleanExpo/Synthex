#!/usr/bin/env tsx
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  type AuthorityCampaignPack,
  generateFullAuthorityCampaign,
} from '../lib/marketing-agency/full-campaign-generator';
import { renderPublishingHandoff } from '../lib/marketing-agency/publishing-handoff';

const generatedAt = '2026-06-11T11:30:00+10:00';
const campaignId = 'carsi-restoration-training-authority-2026-06-11';
const docsRoot = path.resolve(
  process.cwd(),
  'docs/marketing-agency/full-authority-campaigns',
  campaignId
);
const publicRoot = path.resolve(process.cwd(), 'public/campaigns');
const publicFile = path.join(publicRoot, `${campaignId}.html`);

const pack = generateFullAuthorityCampaign({
  campaignId,
  generatedAt,
  manifestTopic: 'CARSI restoration training authority campaign',
  business: {
    slug: 'carsi',
    name: 'CARSI',
    websiteUrl: 'https://carsi.com.au',
    positioning:
      'An Australian online training platform for cleaning and restoration professionals, focused on IICRC CEC-approved continuing education and verifiable learning records.',
    audience: [
      'cleaning and restoration technicians maintaining IICRC CECs',
      'restoration business owners training field teams',
      'commercial cleaning operators adding restoration capability',
      'regional Australian technicians who need self-paced online training',
      'insurance, strata, property, and facility teams evaluating training evidence',
    ],
    offers: [
      '83-course online restoration training catalogue',
      'IICRC CEC-approved continuing education courses',
      'self-paced 24/7 learning with certificate records',
      'Foundation and Growth membership options',
      'team training pathways for restoration businesses',
      'free restoration and cleaning resources library',
    ],
    voiceRules: [
      'patient',
      'instructional',
      'exact',
      'plain-English technical explanations',
      'avoid sensational or generic marketing language',
    ],
    forbiddenClaims: [
      'Do not describe CARSI as an RTO.',
      'Do not claim IICRC endorsement; approved CEC status is not certification endorsement.',
      'Do not invent course availability, CEC hours, prices, reviews, partners, insurer recognition, or outcomes.',
      'Do not publish health, safety, mould, infection-control, insurance, legal, or compliance advice without elevated review.',
      'Do not use customer stories, likenesses, images, or testimonials without recorded consent and source links.',
      'Do not claim external social posts are live without platform receipts.',
    ],
  },
  objective:
    'Launch CARSI as the first client authority campaign, building knowledge, interest, trust, and association through source-backed restoration training education.',
  operatingMandate:
    'Use official CARSI pages and official IICRC material first. Keep all training, safety, compliance, and credential claims source-gated. Publish owned media only after the quality gate passes; keep external platforms credential, rights, and approval gated.',
  coreEvidenceRefs: [
    'carsi-official-home',
    'carsi-official-courses',
    'carsi-official-about',
    'carsi-official-pricing',
    'iicrc-official-home',
    'iicrc-accepted-cecs',
    'internal-consent-evidence-policy',
  ],
  pillarCopy: {
    how_to: {
      title: 'How to choose restoration training without guessing',
      angle:
        'Show technicians how to start with their current certification need, match it to a CARSI course or pathway, and keep evidence of completed learning.',
      body: 'Choosing training should start with the job requirement, not a random course title.\n\nFor restoration technicians, the practical sequence is: identify the IICRC discipline involved, check whether continuing education credits are needed, select the matching CARSI course or membership path, then keep the certificate record where employers or clients can verify it.\n\nCARSI is positioned for self-paced online learning, with a published course catalogue and membership options. The claims in this campaign stay tied to official CARSI and IICRC sources so technicians can check the details before enrolling.\n\nApplied offer: 83-course online restoration training catalogue.',
      youtubeScript: [
        'Hook: Do not pick a restoration course because the title sounds useful.',
        'Step 1: Start with the discipline you need: water restoration, microbial remediation, carpet cleaning, odour control, or drying.',
        'Step 2: Check the CARSI catalogue and confirm whether the course is listed for IICRC CEC continuing education.',
        'Step 3: Keep the completion certificate with your renewal records.',
        'Close: CARSI is online restoration training built for technicians who need evidence, not guesswork.',
      ],
      instagramSlides: [
        'Slide 1: Choose restoration training without guessing',
        'Slide 2: Start with the work type or IICRC discipline',
        'Slide 3: Check the CARSI course listing before enrolling',
        'Slide 4: Keep certificate records for renewal and employer checks',
        'Slide 5: Source: CARSI catalogue and IICRC CEC guidance',
      ],
    },
    did_you_know: {
      title:
        'Did you know: CECs are about maintenance, not a shortcut to certification',
      angle:
        'Explain the difference between IICRC CEC-approved continuing education and unsupported claims that a course creates certification by itself.',
      body: 'A useful distinction matters here: continuing education credits help technicians maintain professional learning records, but they are not the same thing as an unsupported promise of certification.\n\nCARSI publishes IICRC CEC-approved courses and also states that approved status does not award IICRC Certification by itself. That caveat is important because it keeps marketing accurate and helps technicians avoid misunderstanding what a course can and cannot do.\n\nFor every campaign draft, credential language must stay exact: say CEC-approved when the source supports it, and do not imply endorsement or certification outcomes beyond the evidence.',
      youtubeScript: [
        'Hook: CEC-approved does not mean "instant certification".',
        'Point 1: CARSI publishes online training for continuing education credits.',
        'Point 2: IICRC certification and renewal requirements have their own rules.',
        'Point 3: The campaign will use exact credential language only.',
        'Close: That is how training content stays useful and verifiable.',
      ],
      instagramSlides: [
        'Slide 1: CEC-approved is not a shortcut claim',
        'Slide 2: CECs support ongoing education records',
        'Slide 3: Certification rules remain with IICRC',
        'Slide 4: Marketing copy must not blur the difference',
        'Slide 5: Exact words protect the learner and the brand',
      ],
    },
    on_this_day: {
      title:
        'On this day: CARSI becomes the first evidence-gated client campaign',
      angle:
        'Mark the transition from generic campaign generation to a client-specific system that can be checked against official sources.',
      body: 'Today this campaign moves from a general authority engine into a CARSI-specific client pack.\n\nThat means the content calendar, social drafts, public owned-media page, and source register are built around CARSI public pages, IICRC official information, and internal consent policy. The campaign is not allowed to invent testimonials, prices, certification claims, platform access, or publish status.\n\nThe useful milestone is simple: CARSI gets the first repeatable campaign pack where every educational claim has a place to be checked.',
      youtubeScript: [
        'Hook: This is the point where campaign automation becomes client-specific.',
        'Point 1: CARSI is the first client in the source-gated campaign system.',
        'Point 2: The source register controls what the copy can claim.',
        'Point 3: Owned media can move first; external posts wait for approvals and credentials.',
        'Close: This is how the system avoids fake completion.',
      ],
      instagramSlides: [
        'Slide 1: CARSI is the first client campaign',
        'Slide 2: Source register before copy',
        'Slide 3: Owned media before external platform claims',
        'Slide 4: Credentials and approvals still gate publishing',
        'Slide 5: Useful content, verifiable data',
      ],
    },
    missing_industry_info: {
      title: 'The missing information: what training proof actually needs',
      angle:
        'Explain the documents, source links, and review checkpoints that make training content testable instead of promotional.',
      body: 'Most training marketing talks about outcomes before it proves the basics.\n\nFor CARSI, the missing information is practical: source URL, course or membership page, discipline reference, CEC wording, last-checked date, visual asset rights, and review status. Without those fields, the campaign cannot honestly say that a post is ready for wider publishing.\n\nThis pack treats those fields as part of the product. Every draft has evidence references, a media format, peer-test metrics, and a publishing instruction.',
      youtubeScript: [
        'Hook: A training post is not ready just because the copy sounds polished.',
        'Point 1: It needs source links.',
        'Point 2: It needs exact credential wording.',
        'Point 3: It needs asset rights and human review for sensitive claims.',
        'Close: That is the difference between useful education and noise.',
      ],
      instagramSlides: [
        'Slide 1: What training proof needs',
        'Slide 2: Source URL',
        'Slide 3: Exact credential wording',
        'Slide 4: Asset rights and review status',
        'Slide 5: No source, no claim',
      ],
    },
    tips_and_tricks: {
      title: 'Practical tips before posting restoration training content',
      angle:
        'Give a concise pre-publish checklist for CARSI education posts, especially where safety, mould, infection control, or credential language appears.',
      body: 'Before publishing CARSI training content, run a short check.\n\nFirst, confirm the course or topic appears on an official CARSI page. Second, check whether the wording says CEC-approved, IICRC-aligned, or certification; these are not interchangeable. Third, avoid turning training content into safety or compliance advice without elevated review. Fourth, use original, owned, or licensed visuals only. Fifth, keep the source register attached.\n\nThat checklist is how the campaign keeps speed without drifting into unsupported claims.',
      youtubeScript: [
        'Hook: Five checks before posting restoration training content.',
        'One: Is the topic on an official CARSI page?',
        'Two: Is the credential wording exact?',
        'Three: Does it need safety or compliance review?',
        'Four: Are the visuals owned or licensed?',
        'Five: Is the source register attached?',
      ],
      instagramSlides: [
        'Slide 1: Five checks before posting',
        'Slide 2: Official CARSI source?',
        'Slide 3: Exact credential wording?',
        'Slide 4: Safety or compliance review needed?',
        'Slide 5: Rights checked and source register attached?',
      ],
    },
    product_meaning: {
      title: 'What CARSI means in practice: training that can be checked',
      angle:
        'Translate CARSI from a brand name into an operational promise: online restoration learning with traceable sources and certificate records.',
      body: 'CARSI should not be treated as a vague training brand in this campaign.\n\nThe practical meaning is narrower and stronger: online restoration and cleaning industry education, continuing education credit pathways, published course information, and certificate records that can be retained or shared where appropriate.\n\nThat framing lets the campaign teach real topics without overclaiming. It also gives every designer, writer, and publisher a clear rule: if the claim cannot be checked, it does not go out.',
      youtubeScript: [
        'Hook: CARSI is not a vague training slogan.',
        'Point 1: The campaign frames CARSI as online restoration learning.',
        'Point 2: Claims are checked against official course, pricing, and IICRC information.',
        'Point 3: Certificate and CEC wording stays exact.',
        'Close: That is what makes the content useful.',
      ],
      instagramSlides: [
        'Slide 1: CARSI in practice',
        'Slide 2: Online restoration learning',
        'Slide 3: CEC and certificate language kept exact',
        'Slide 4: Claims checked before publishing',
        'Slide 5: Training content that can be verified',
      ],
    },
    ten_ways: {
      title: '10 ways to turn one CARSI source page into useful content',
      angle:
        'Break a verified CARSI page into repeatable blog, email, social, video, FAQ, and checklist assets without inventing extra facts.',
      body: 'One verified CARSI page can become ten useful assets without inventing anything.\n\nUse it as a course-selection guide, a CEC terminology explainer, a technician checklist, a business-owner training note, a short video script, an FAQ block, an email briefing, a visual source card, a myth-versus-fact post, and a renewal-record reminder.\n\nThe constraint is the advantage: every asset must stay inside the source. That keeps the campaign fast, useful, and testable.',
      youtubeScript: [
        'Hook: One source page can power ten useful CARSI posts.',
        'Examples: course guide, CEC explainer, checklist, FAQ, short video, email, source card, myth-versus-fact, renewal reminder, and team training note.',
        'Rule: Stay inside the source.',
        'Close: That is how the campaign scales without making things up.',
      ],
      instagramSlides: [
        'Slide 1: One source, ten useful assets',
        'Slide 2: Guide, checklist, FAQ',
        'Slide 3: Email, short video, source card',
        'Slide 4: Myth-versus-fact, team training note',
        'Slide 5: Stay inside the source',
      ],
    },
    myth_vs_fact: {
      title: 'Myth vs fact: online restoration training claims',
      angle:
        'Separate practical online training facts from common overclaims about certification, endorsement, compliance, and guaranteed outcomes.',
      body: 'Myth: online training content can say anything as long as the intent is educational.\n\nFact: CARSI content still needs exact source-backed wording, especially around IICRC, CECs, certification, safety, mould, infection control, pricing, and outcomes.\n\nMyth: a campaign is live once drafts are generated.\n\nFact: owned media can move after quality checks, but external platforms need credentials, approval, asset rights, and publish receipts before anything is called live.',
      youtubeScript: [
        'Hook: Two myths can break a restoration training campaign.',
        'Myth one: educational content can be loose with credential wording.',
        'Fact: CEC, certification, and endorsement language must be exact.',
        'Myth two: generated social drafts are live posts.',
        'Fact: external publishing needs credentials, approvals, rights checks, and receipts.',
      ],
      instagramSlides: [
        'Slide 1: Myth vs fact: CARSI campaign claims',
        'Slide 2: Myth: credential wording can be loose',
        'Slide 3: Fact: CEC and certification wording must be exact',
        'Slide 4: Myth: drafts mean posts are live',
        'Slide 5: Fact: receipts prove publishing',
      ],
    },
  },
  channelCtas: {
    blog: 'Check the CARSI source register before choosing the next training topic.',
    newsletter:
      'Send the next CARSI course or industry page for a source-backed content pack.',
    linkedin:
      'Save this checklist before drafting training or credential content.',
    facebook:
      'Use this before sharing course or CEC information with a technician.',
    instagram: 'Save this source-first training checklist.',
    youtube_shorts:
      'Follow CARSI for source-backed restoration training explainers.',
    reddit:
      'Discuss training evidence and disclose affiliation before sharing CARSI links.',
  },
  expertNotes: [
    'Use official CARSI pages for course, pricing, industry, pathway, and contact facts.',
    'Use official IICRC material for CEC and standards-body context.',
    'Avoid unsupported claims of certification, endorsement, insurer acceptance, compliance, or guaranteed outcomes.',
    'Flag safety, mould, infection-control, insurance, and compliance content for elevated human review.',
  ],
  consumerObjections: [
    'Is CARSI actually IICRC CEC-approved or just using credential language loosely?',
    'Can a technician verify the course, price, or certificate claim before enrolling?',
    'Is this training content practical, or is it generic marketing copy?',
    'Does the campaign invent reviews, outcomes, or external publish status?',
  ],
  seoAeoGeoTargets: [
    'IICRC CEC online courses Australia',
    'restoration training online Australia',
    'water damage restoration continuing education',
    'cleaning and restoration training for technicians',
    'CARSI restoration training courses',
    'IICRC CEC certificate records',
  ],
  requiredVisuals: [
    'CARSI source register card',
    'IICRC CEC terminology explainer',
    'course-selection checklist',
    'credential wording do-and-dont carousel',
    'owned-media campaign status board',
  ],
  lessons: [
    'Credential language must stay exact and source-backed.',
    'Owned media can move first after the quality gate passes.',
    'External social remains blocked until credentials, rights checks, approvals, and publish receipts exist.',
    'Client stories and testimonials require source and consent evidence before campaign use.',
  ],
  sources: [
    {
      id: 'carsi-official-home',
      label: 'CARSI official home page',
      sourceType: 'official_business_site',
      url: 'https://carsi.com.au/',
      checkedAt: generatedAt,
    },
    {
      id: 'carsi-official-courses',
      label: 'CARSI official course catalogue',
      sourceType: 'official_business_site',
      url: 'https://carsi.com.au/courses',
      checkedAt: generatedAt,
    },
    {
      id: 'carsi-official-about',
      label: 'CARSI official about page and IICRC disclaimer',
      sourceType: 'official_business_site',
      url: 'https://carsi.com.au/about',
      checkedAt: generatedAt,
    },
    {
      id: 'carsi-official-pricing',
      label: 'CARSI official membership and pricing page',
      sourceType: 'official_business_site',
      url: 'https://carsi.com.au/pricing',
      checkedAt: generatedAt,
    },
    {
      id: 'carsi-official-industries',
      label: 'CARSI official industry training solutions page',
      sourceType: 'official_business_site',
      url: 'https://carsi.com.au/industries',
      checkedAt: generatedAt,
    },
    {
      id: 'carsi-official-pathways',
      label: 'CARSI official pathways page',
      sourceType: 'official_business_site',
      url: 'https://carsi.com.au/pathways',
      checkedAt: generatedAt,
    },
    {
      id: 'iicrc-official-home',
      label: 'IICRC official site',
      sourceType: 'official_standards_body',
      url: 'https://iicrc.org/',
      checkedAt: generatedAt,
    },
    {
      id: 'iicrc-accepted-cecs',
      label: 'IICRC accepted Continuing Education Credits guidance',
      sourceType: 'official_standards_body',
      url: 'https://iicrc.org/accepted-cecs/',
      checkedAt: generatedAt,
    },
    {
      id: 'iicrc-standards',
      label: 'IICRC standards information',
      sourceType: 'official_standards_body',
      url: 'https://iicrc.org/iicrcstandards/',
      checkedAt: generatedAt,
    },
    {
      id: 'carsi-brand-config',
      label: 'CARSI brand runtime configuration',
      sourceType: 'internal_brand_config',
      path: 'packages/brand-config/src/brands/carsi.ts',
      checkedAt: generatedAt,
    },
    {
      id: 'carsi-design-config',
      label: 'CARSI design system notes',
      sourceType: 'internal_brand_config',
      path: 'packages/brand-config/src/brands/carsi.design.md',
      checkedAt: generatedAt,
    },
    {
      id: 'platform-linkedin-posts-api',
      label: 'LinkedIn Posts API - Microsoft Learn',
      sourceType: 'official_platform_documentation',
      url: 'https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-05',
      checkedAt: generatedAt,
    },
    {
      id: 'platform-meta-pages-api',
      label: 'Facebook Pages API - Meta for Developers',
      sourceType: 'official_platform_documentation',
      url: 'https://developers.facebook.com/docs/pages-api/posts/',
      checkedAt: generatedAt,
    },
    {
      id: 'platform-meta-instagram-publishing',
      label: 'Instagram Platform Content Publishing - Meta for Developers',
      sourceType: 'official_platform_documentation',
      url: 'https://developers.facebook.com/docs/instagram-platform/content-publishing/',
      checkedAt: generatedAt,
    },
    {
      id: 'platform-youtube-videos-insert',
      label: 'YouTube Data API videos.insert - Google for Developers',
      sourceType: 'official_platform_documentation',
      url: 'https://developers.google.com/youtube/v3/docs/videos/insert',
      checkedAt: generatedAt,
    },
    {
      id: 'platform-reddit-data-api',
      label: 'Reddit Data API Wiki - Reddit Help',
      sourceType: 'official_platform_documentation',
      url: 'https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki',
      checkedAt: generatedAt,
    },
    {
      id: 'internal-consent-evidence-policy',
      label: 'Synthex Consent and Story Evidence Policy',
      sourceType: 'internal_policy',
      path: 'docs/marketing-agency/CONSENT-AND-STORY-EVIDENCE-POLICY.md',
      checkedAt: generatedAt,
    },
  ],
  horizonDays: 21,
});

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath: string, content: string) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

function json(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sourceList(pack: AuthorityCampaignPack) {
  return pack.evidenceManifest.sources
    .map(source => {
      const target = source.url ?? source.path ?? 'source path pending';
      return `- ${source.id}: ${source.label} (${target})`;
    })
    .join('\n');
}

function renderReadme(pack: AuthorityCampaignPack) {
  return `# CARSI Restoration Training Authority Campaign

Generated: ${pack.generatedAt}

Campaign ID: ${pack.campaignId}

## Objective

${pack.objective}

## Operating Mandate

${pack.operatingMandate}

## Live Owned Media

- Public page: /campaigns/${campaignId}.html
- Owned media gate: ${pack.ownedMediaGate.allowed ? 'pass' : 'blocked'}
- Quality gate: ${pack.qualityGate.allowed ? 'pass' : 'blocked'} (${pack.qualityGate.overallScore}/100)

## Verifiability Rules

- Use CARSI official pages for course, pricing, pathway, industry, and contact facts.
- Use IICRC official sources for CEC and standards-body context.
- Do not describe CARSI as an RTO.
- Do not imply IICRC endorsement or guaranteed certification outcomes.
- Treat safety, mould, infection-control, insurance, and compliance content as elevated-review content.
- Do not use testimonials, images, likenesses, or customer stories without consent evidence.

## External Publish State

External social publishing is intentionally blocked until credentials, client approval, rights checks, and community rules are recorded. This prevents fake "published" status while still generating the campaign now.

## Files

- campaign-pack.json
- evidence-manifest.json
- quality-gate.json
- platform-drafts.md
- source-register.md
- publishing-handoff.md
- public page: public/campaigns/${campaignId}.html
`;
}

function renderSourceRegister(pack: AuthorityCampaignPack) {
  return `# CARSI Source Register

Every factual or operational claim in this campaign must map to a source below.

## Current Verified Claim Boundaries

- CARSI is represented as an Australian online training platform for cleaning and restoration professionals.
- CARSI course, pricing, pathway, and industry claims must be checked against official CARSI pages before publishing.
- IICRC CEC and standards-body claims must be checked against official IICRC material.
- CARSI's own about page includes a non-endorsement and non-certification caveat for IICRC approved status.
- Social publishing is draft-only until platform credentials, approval, asset rights, and publish receipts exist.

## Sources

${sourceList(pack)}
`;
}

function renderDrafts(pack: AuthorityCampaignPack) {
  const sections = pack.drafts.map(
    draft => `## ${draft.channel} - ${draft.title}

Slot: ${draft.slotId}

${draft.body}

CTA: ${draft.cta}

Evidence refs: ${draft.evidenceRefs.join(', ')}

Asset brief: ${draft.assetBrief}

Media format: ${draft.mediaPlan.format}

Media review checks:
${draft.mediaPlan.reviewChecks.map(check => `- ${check}`).join('\n')}

Peer test: ${draft.peerBenchmark.testMethod}

Peer metrics: ${draft.peerBenchmark.comparableMetrics.join(', ')}

Peer data status: ${draft.peerBenchmark.status}

Publish instruction: ${draft.publishInstruction}
`
  );

  return `# CARSI Platform Drafts

These are ready-to-review campaign drafts. Blog/newsletter can publish as owned media after final human review. External channels stay gated.

${sections.join('\n')}
`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPublicHtml(pack: AuthorityCampaignPack) {
  const ownedDrafts = pack.drafts.filter(
    draft => draft.channel === 'blog' || draft.channel === 'newsletter'
  );
  const socialDrafts = pack.drafts.filter(
    draft => draft.channel !== 'blog' && draft.channel !== 'newsletter'
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CARSI Restoration Training Authority Campaign</title>
  <meta name="description" content="Source-backed CARSI campaign pack for restoration training education, CEC explainers, and credential-safe publishing." />
  <style>
    body { margin: 0; font-family: Inter, Arial, Helvetica, sans-serif; background: #f2e8d5; color: #2d2a26; line-height: 1.55; }
    main { max-width: 1040px; margin: 0 auto; padding: 40px 20px 64px; }
    header { border-bottom: 2px solid #2d2a26; padding-bottom: 24px; margin-bottom: 28px; }
    h1 { font-family: Lora, Georgia, serif; font-size: clamp(2rem, 5vw, 4rem); line-height: 1.05; margin: 0 0 16px; }
    h2 { margin-top: 34px; font-size: 1.35rem; }
    h3 { margin: 0 0 8px; }
    .badge { display: inline-block; padding: 4px 8px; border: 1px solid #2d2a26; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
    .card { background: #fbf8f2; border: 1px solid #736b5e; border-radius: 8px; padding: 18px; }
    .ok { color: #166534; font-weight: 700; }
    .blocked { color: #8a3a00; font-weight: 700; }
    code { background: #edeae2; padding: 2px 5px; border-radius: 4px; }
    ul { padding-left: 20px; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <main>
    <header>
      <span class="badge">Generated ${escapeHtml(pack.generatedAt)}</span>
      <h1>CARSI Restoration Training Authority</h1>
      <p>${escapeHtml(pack.objective)}</p>
      <p><strong>Campaign:</strong> <code>${escapeHtml(pack.campaignId)}</code></p>
    </header>

    <section>
      <h2>What this starts</h2>
      <div class="grid">
        <div class="card"><h3>Knowledge</h3><p>Restoration training explainers tied to official CARSI and IICRC sources.</p></div>
        <div class="card"><h3>Interest</h3><p>How-to, did-you-know, checklist, myth-versus-fact, and short-video drafts for practical technicians.</p></div>
        <div class="card"><h3>Association</h3><p>CARSI repeatedly appears beside useful, checkable training guidance instead of unsupported promotion.</p></div>
      </div>
    </section>

    <section>
      <h2>Owned media status</h2>
      <p class="${pack.ownedMediaGate.allowed ? 'ok' : 'blocked'}">${pack.ownedMediaGate.allowed ? 'Ready for owned media after final human review.' : 'Blocked by authority gate.'}</p>
    </section>

    <section>
      <h2>Quality gate</h2>
      <div class="grid">
        <div class="card"><h3>Evidence</h3><p>${pack.qualityGate.sourceSummary.checkedSources}/${pack.qualityGate.sourceSummary.totalSources} sources checked with locator, type, and timestamp.</p></div>
        <div class="card"><h3>Media</h3><p>Every draft includes a format, review checks, and owned/licensed/original-only asset policy.</p></div>
        <div class="card"><h3>Peer test</h3><p>Social metrics remain <code>DATA_REQUIRED</code> until OAuth provides native analytics, but the benchmark method is defined now.</p></div>
      </div>
      <p class="${pack.qualityGate.allowed ? 'ok' : 'blocked'}">${pack.qualityGate.allowed ? `Passed at ${pack.qualityGate.overallScore}/100.` : `Blocked: ${pack.qualityGate.blockers.join(', ')}`}</p>
    </section>

    <section>
      <h2>First owned-media drafts</h2>
      ${ownedDrafts
        .slice(0, 4)
        .map(
          draft =>
            `<article class="card"><h3>${escapeHtml(draft.title)}</h3><p>${escapeHtml(draft.body).replace(/\n/g, '<br />')}</p><p><strong>CTA:</strong> ${escapeHtml(draft.cta)}</p></article>`
        )
        .join('\n')}
    </section>

    <section>
      <h2>External social queue</h2>
      <p>These drafts are generated but not claimed live. They require credentials, approval, rights checks, and platform/community rules.</p>
      <ul>
        ${socialDrafts
          .slice(0, 8)
          .map(
            draft =>
              `<li><strong>${escapeHtml(draft.channel)}:</strong> ${escapeHtml(draft.title)}</li>`
          )
          .join('\n')}
      </ul>
    </section>

    <section>
      <h2>Source register</h2>
      <ul>
        ${pack.evidenceManifest.sources
          .map(
            source =>
              `<li>${escapeHtml(source.label)} - ${escapeHtml(source.url ?? source.path ?? source.id)}</li>`
          )
          .join('\n')}
      </ul>
    </section>
  </main>
</body>
</html>
`;
}

writeFile(path.join(docsRoot, 'README.md'), renderReadme(pack));
writeFile(path.join(docsRoot, 'campaign-pack.json'), json(pack));
writeFile(
  path.join(docsRoot, 'evidence-manifest.json'),
  json(pack.evidenceManifest)
);
writeFile(path.join(docsRoot, 'quality-gate.json'), json(pack.qualityGate));
writeFile(path.join(docsRoot, 'platform-drafts.md'), renderDrafts(pack));
writeFile(
  path.join(docsRoot, 'source-register.md'),
  renderSourceRegister(pack)
);
writeFile(
  path.join(docsRoot, 'publishing-handoff.md'),
  renderPublishingHandoff(pack, { titlePrefix: 'CARSI' })
);
writeFile(publicFile, renderPublicHtml(pack));

console.info(`Generated ${pack.campaignId}`);
console.info(`Docs: ${docsRoot}`);
console.info(`Public: ${publicFile}`);
console.info(
  `Owned media gate: ${pack.ownedMediaGate.allowed ? 'pass' : 'blocked'}`
);
console.info(
  `Quality gate: ${pack.qualityGate.allowed ? 'pass' : 'blocked'} (${pack.qualityGate.overallScore}/100)`
);
