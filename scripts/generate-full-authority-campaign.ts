#!/usr/bin/env tsx
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  type AuthorityCampaignPack,
  generateFullAuthorityCampaign,
} from '../lib/marketing-agency/full-campaign-generator';

const generatedAt = '2026-06-11T10:15:00+10:00';
const campaignId = 'unite-group-authority-flywheel-2026-06-11';
const docsRoot = path.resolve(
  process.cwd(),
  'docs/marketing-agency/full-authority-campaigns',
  campaignId,
);
const publicRoot = path.resolve(process.cwd(), 'public/campaigns');
const publicFile = path.join(publicRoot, `${campaignId}.html`);

const pack = generateFullAuthorityCampaign({
  campaignId,
  generatedAt,
  business: {
    slug: 'unite-group-nexus',
    name: 'Unite Group Nexus',
    websiteUrl: 'https://synthex.social',
    positioning:
      'A connected operating system for turning founder intent, client data, and verified evidence into shippable business execution.',
    audience: [
      'Phill and Unite Group operators',
      'Carpet Cleaners Warehouse',
      'IT R Button / Duncan Perkins',
      'service-business owners who need useful content without unsupported claims',
    ],
    offers: [
      'source-first business profile intake',
      'evidence-backed social campaign generation',
      'platform-aware publishing calendar',
      'visual and voice-first executive updates',
      'approval-gated external publishing',
    ],
    voiceRules: [
      'direct',
      'practical',
      'evidence-backed',
      'low waffle',
      'clear next action',
    ],
    forbiddenClaims: [
      'Do not claim external social posts are live without publish receipts.',
      'Do not invent client facts, ABNs, product data, prices, or manufacturer claims.',
      'Do not imply ad spend is active without an explicit approved spend flag.',
      'Do not use unlicensed assets or client stories without consent.',
    ],
  },
  objective:
    'Start a reusable authority campaign that builds knowledge, interest, trust, and association through consistent real, verifiable information.',
  operatingMandate:
    'Convert the latest Plaud mandate into a source-first campaign engine: ingest evidence, create useful platform-specific content, publish owned media immediately, and keep external channels gated until credentials, rights, and approvals are recorded.',
  sources: [
    {
      id: 'plaud-systemic-overhaul-mandate',
      label:
        'Plaud recording: 06-11 Bridging the Execution Gap in an AI-Driven Business Ecosystem',
      sourceType: 'founder_recording_transcript',
      path: 'Plaud file 9a86c34c7ec50a6082ccafb48fa0d7aa',
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
    .map((source) => {
      const target = source.url ?? source.path ?? 'source path pending';
      return `- ${source.id}: ${source.label} (${target})`;
    })
    .join('\n');
}

function renderReadme(pack: AuthorityCampaignPack) {
  return `# Unite Group Authority Flywheel Campaign

Generated: ${pack.generatedAt}

Campaign ID: ${pack.campaignId}

## Objective

${pack.objective}

## Operating Mandate

${pack.operatingMandate}

## Live Owned Media

- Public page: /campaigns/${campaignId}.html
- Owned media gate: ${pack.ownedMediaGate.allowed ? 'pass' : 'blocked'}

## External Publish State

External social publishing is intentionally blocked until credentials, client approval, rights checks, and community rules are recorded. This prevents fake "published" status while still generating the campaign now.

## Files

- campaign-pack.json
- evidence-manifest.json
- platform-drafts.md
- source-register.md
- publishing-handoff.md
- public page: public/campaigns/${campaignId}.html
`;
}

function renderSourceRegister(pack: AuthorityCampaignPack) {
  return `# Source Register

Every factual or operational claim in this campaign must map to a source below.

${sourceList(pack)}
`;
}

function renderDrafts(pack: AuthorityCampaignPack) {
  const sections = pack.drafts.map(
    (draft) => `## ${draft.channel} - ${draft.title}

Slot: ${draft.slotId}

${draft.body}

CTA: ${draft.cta}

Evidence refs: ${draft.evidenceRefs.join(', ')}

Asset brief: ${draft.assetBrief}

Publish instruction: ${draft.publishInstruction}
`,
  );

  return `# Platform Drafts

These are ready-to-review campaign drafts. Blog/newsletter can publish as owned media. External channels stay gated.

${sections.join('\n')}
`;
}

function renderPublishingHandoff(pack: AuthorityCampaignPack) {
  return `# Publishing Handoff

## Owned Media

- Blog: ${pack.ownedMediaGate.allowed ? 'ready' : 'blocked'}
- Newsletter: ${pack.ownedMediaGate.allowed ? 'ready' : 'blocked'}

## External Social Blocks

${Object.entries(pack.externalPublishBlocks)
  .map(([channel, blocks]) => `### ${channel}\n\n${blocks.map((block) => `- ${block}`).join('\n')}`)
  .join('\n\n')}

## Publish Rule

No external platform post is marked as live unless there is a platform receipt, URL, or API response stored back into the campaign pack.
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
    (draft) => draft.channel === 'blog' || draft.channel === 'newsletter',
  );
  const socialDrafts = pack.drafts.filter(
    (draft) => draft.channel !== 'blog' && draft.channel !== 'newsletter',
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Unite Group Authority Flywheel Campaign</title>
  <meta name="description" content="Evidence-backed campaign pack generated from the Unite Group Nexus execution mandate." />
  <style>
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; background: #f7f8fa; color: #111827; line-height: 1.55; }
    main { max-width: 980px; margin: 0 auto; padding: 40px 20px 64px; }
    header { border-bottom: 2px solid #111827; padding-bottom: 24px; margin-bottom: 28px; }
    h1 { font-size: clamp(2rem, 5vw, 4rem); line-height: 1; margin: 0 0 16px; }
    h2 { margin-top: 34px; font-size: 1.35rem; }
    h3 { margin: 0 0 8px; }
    .badge { display: inline-block; padding: 4px 8px; border: 1px solid #111827; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
    .card { background: #fff; border: 1px solid #d8dde6; border-radius: 8px; padding: 18px; }
    .ok { color: #0f6b45; font-weight: 700; }
    .blocked { color: #8a3a00; font-weight: 700; }
    code { background: #eef1f5; padding: 2px 5px; border-radius: 4px; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>
  <main>
    <header>
      <span class="badge">Generated ${escapeHtml(pack.generatedAt)}</span>
      <h1>Unite Group Authority Flywheel</h1>
      <p>${escapeHtml(pack.objective)}</p>
      <p><strong>Campaign:</strong> <code>${escapeHtml(pack.campaignId)}</code></p>
    </header>

    <section>
      <h2>What this starts</h2>
      <div class="grid">
        <div class="card"><h3>Knowledge</h3><p>Every post starts from a source register, not a generic prompt.</p></div>
        <div class="card"><h3>Interest</h3><p>Each source becomes how-to, did-you-know, checklist, myth-vs-fact, and short-video angles.</p></div>
        <div class="card"><h3>Association</h3><p>The audience repeatedly sees Unite Group tied to useful, verifiable execution.</p></div>
      </div>
    </section>

    <section>
      <h2>Owned media status</h2>
      <p class="${pack.ownedMediaGate.allowed ? 'ok' : 'blocked'}">${pack.ownedMediaGate.allowed ? 'Ready to publish on owned media.' : 'Blocked by authority gate.'}</p>
    </section>

    <section>
      <h2>First owned-media drafts</h2>
      ${ownedDrafts
        .slice(0, 4)
        .map(
          (draft) => `<article class="card"><h3>${escapeHtml(draft.title)}</h3><p>${escapeHtml(draft.body).replace(/\n/g, '<br />')}</p><p><strong>CTA:</strong> ${escapeHtml(draft.cta)}</p></article>`,
        )
        .join('\n')}
    </section>

    <section>
      <h2>External social queue</h2>
      <p>These drafts are generated but not claimed live. They require credentials, approval, rights checks, and platform/community rules.</p>
      <ul>
        ${socialDrafts
          .slice(0, 8)
          .map((draft) => `<li><strong>${escapeHtml(draft.channel)}:</strong> ${escapeHtml(draft.title)}</li>`)
          .join('\n')}
      </ul>
    </section>

    <section>
      <h2>Source register</h2>
      <ul>
        ${pack.evidenceManifest.sources
          .map((source) => `<li>${escapeHtml(source.label)} - ${escapeHtml(source.url ?? source.path ?? source.id)}</li>`)
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
writeFile(path.join(docsRoot, 'evidence-manifest.json'), json(pack.evidenceManifest));
writeFile(path.join(docsRoot, 'platform-drafts.md'), renderDrafts(pack));
writeFile(path.join(docsRoot, 'source-register.md'), renderSourceRegister(pack));
writeFile(path.join(docsRoot, 'publishing-handoff.md'), renderPublishingHandoff(pack));
writeFile(publicFile, renderPublicHtml(pack));

console.info(`Generated ${pack.campaignId}`);
console.info(`Docs: ${docsRoot}`);
console.info(`Public: ${publicFile}`);
console.info(`Owned media gate: ${pack.ownedMediaGate.allowed ? 'pass' : 'blocked'}`);
