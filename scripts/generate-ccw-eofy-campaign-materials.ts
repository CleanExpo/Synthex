import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CCW_EOFY_CAMPAIGN_NAME,
  CCW_EOFY_CAMPAIGN_SLUG,
  ccwEofyCampaignCalendar,
  ccwEofySourceUrls,
} from '../lib/marketing-agency/ccw-eofy-calendar';

const brandRoot =
  '/Users/phill-mac/Synthex-Brain-2/06-Brands/ccw/EOFY-2026-Campaign-Materials';
const docsRoot = path.resolve(
  process.cwd(),
  'docs/marketing-agency/ccw/eofy-2026-materials'
);

type PlatformSize = {
  width: number;
  height: number;
  label: string;
};

const platformSizes: Record<string, PlatformSize> = {
  linkedin: { width: 1200, height: 627, label: 'LinkedIn feed' },
  facebook: { width: 1080, height: 1080, label: 'Facebook feed' },
  instagram: { width: 1080, height: 1350, label: 'Instagram feed/reel cover' },
  reddit: { width: 1080, height: 1080, label: 'Reddit optional image' },
};

const productProof = [
  {
    label: 'CCW positioning',
    proof:
      'CCW positions itself as a one stop shop in Australia for professional carpet cleaners and restorers.',
    source: ccwEofySourceUrls[0],
    approvedUse:
      'Use for broad campaign positioning and equipment-stack messaging.',
  },
  {
    label: 'XPOWER PL700A',
    proof:
      'Listed as a sale product with stackable design, 3-speed control, built-in power outlet, and compact low-profile form factor.',
    source: 'https://ccwonline.com.au/products/xpower-low-profile-airmover',
    approvedUse:
      'Use for low-profile air mover product spotlight after stock and price check.',
  },
  {
    label: 'Dri-Eaz Velo',
    proof:
      'Listed as a sale product with low profile, multiple operating positions, low amp draw, and stackable storage.',
    source:
      'https://ccwonline.com.au/products/dri-eaz-velo-low-profile-air-mover',
    approvedUse:
      'Use as supporting product proof in drying-stack creative and FAQs.',
  },
  {
    label: 'Razorback AAM Pro',
    proof:
      'Listed by CCW as a sale axial air mover product for restoration operators.',
    source:
      'https://ccwonline.com.au/collections/airmovers/products/razorback-aam-pro-axial-air-mover',
    approvedUse: 'Use for air mover spotlight after stock and price check.',
  },
  {
    label: 'Finance options',
    proof:
      'CCW references equipment finance discussions through its finance options pathway.',
    source: 'https://ccwonline.com.au/pages/finance-options',
    approvedUse:
      'Use as an enquiry CTA only. Do not claim approval, rates, tax outcomes, or repayment amounts.',
  },
];

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeBoth(relativePath: string, content: string) {
  for (const root of [brandRoot, docsRoot]) {
    const filePath = path.join(root, relativePath);
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content);
  }
}

function slug(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function xmlEscape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function csvEscape(value: string) {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

function wrapText(text: string, maxChars: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function renderSvg(
  slot: (typeof ccwEofyCampaignCalendar)[number],
  platform: string
) {
  const size = platformSizes[platform] ?? platformSizes.facebook;
  const headline = wrapText(
    slot.title.toUpperCase(),
    size.width > 1100 ? 28 : 20
  );
  const body = wrapText(slot.objective, size.width > 1100 ? 58 : 38).slice(
    0,
    4
  );
  const cta = wrapText(slot.cta, size.width > 1100 ? 52 : 34).slice(0, 3);
  const yStart = size.height > 1000 ? 250 : 150;
  const headlineSvg = headline
    .map(
      (line, index) =>
        `<text x="72" y="${yStart + index * 58}" font-size="48" font-weight="800" fill="#f8fafc">${xmlEscape(line)}</text>`
    )
    .join('\n');
  const bodyY = yStart + headline.length * 58 + 58;
  const bodySvg = body
    .map(
      (line, index) =>
        `<text x="72" y="${bodyY + index * 36}" font-size="28" fill="#dbe7ef">${xmlEscape(line)}</text>`
    )
    .join('\n');
  const ctaY = size.height - 190;
  const ctaSvg = cta
    .map(
      (line, index) =>
        `<text x="72" y="${ctaY + index * 34}" font-size="27" font-weight="700" fill="#12201b">${xmlEscape(line)}</text>`
    )
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}" role="img" aria-label="${xmlEscape(slot.title)}">
  <rect width="100%" height="100%" fill="#10231f"/>
  <rect x="34" y="34" width="${size.width - 68}" height="${size.height - 68}" rx="18" fill="#17332d" stroke="#78d6a3" stroke-width="3"/>
  <rect x="72" y="72" width="250" height="42" rx="21" fill="#78d6a3"/>
  <text x="94" y="100" font-size="22" font-weight="800" fill="#10231f">CCW EOFY 2026</text>
  <text x="${size.width - 72}" y="100" text-anchor="end" font-size="22" font-weight="700" fill="#a7f3d0">${xmlEscape(platform.toUpperCase())}</text>
  ${headlineSvg}
  ${bodySvg}
  <rect x="72" y="${ctaY - 45}" width="${size.width - 144}" height="${Math.max(118, cta.length * 40 + 42)}" rx="16" fill="#a7f3d0"/>
  ${ctaSvg}
  <text x="72" y="${size.height - 74}" font-size="18" fill="#94a3b8">Draft asset. Verify credentials, product claims, stock and pricing before publishing.</text>
  <text x="${size.width - 72}" y="${size.height - 74}" text-anchor="end" font-size="18" fill="#94a3b8">${slot.date} ${slot.timeAest} AEST</text>
</svg>
`;
}

function platformLabel(platform: string) {
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

const executions = ccwEofyCampaignCalendar.flatMap(slot =>
  slot.platforms.map(platform => ({
    slot,
    platform,
    assetName: `${slot.date}-${platform}-${slug(slot.title)}.svg`,
  }))
);

function generateReadme() {
  return `# ${CCW_EOFY_CAMPAIGN_NAME}

Status: final campaign material pack generated and applied to Synthex as draft content.

Campaign slug: \`${CCW_EOFY_CAMPAIGN_SLUG}\`
Window: 3 June 2026 to 30 June 2026
Calendar slots: ${ccwEofyCampaignCalendar.length}
Platform executions: ${executions.length}

This pack contains the full copy deck, creative asset briefs, SVG draft assets, UTM plan, QA checklist, and publishing handoff. External publishing remains blocked until CCW social credentials are provided and final human approval is recorded.

## Files

- \`01-platform-copy-deck.md\` - final platform copy for every scheduled post.
- \`02-creative-asset-briefs.md\` - production instructions for visual assets, reels, and carousels.
- \`03-production-asset-manifest.json\` - machine-readable execution and asset manifest.
- \`04-approval-qa-checklist.md\` - final approval checklist and claim gates.
- \`05-publishing-handoff.md\` - handoff for the CCW team and publishing operator.
- \`06-utm-tracking-plan.csv\` - tracking plan for each platform execution.
- \`07-source-and-claim-register.md\` - sourced claim register.
- \`08-html-preview.html\` - local preview of the campaign pack.
- \`assets/svg/\` - draft social creative assets.
`;
}

function generateCopyDeck() {
  const sections = ccwEofyCampaignCalendar
    .map(slot => {
      const platformBlocks = slot.platforms
        .map(
          platform => `### ${platformLabel(platform)}

Status: draft, final approval required

Post copy:

${slot.content}

${slot.cta}

Hashtags: ${slot.hashtags.join(' ')}

Visual: ${slot.assetBrief}

Gate: ${slot.gate}`
        )
        .join('\n\n');

      return `## ${slot.date} ${slot.timeAest} AEST - ${slot.title}

Objective: ${slot.objective}

${platformBlocks}`;
    })
    .join('\n\n');

  return `# Platform Copy Deck

Campaign: ${CCW_EOFY_CAMPAIGN_NAME}

${sections}
`;
}

function generateAssetBriefs() {
  const rows = executions
    .map(({ slot, platform, assetName }) => {
      const size = platformSizes[platform] ?? platformSizes.facebook;
      return `## ${slot.date} - ${platformLabel(platform)} - ${slot.title}

Asset file: \`assets/svg/${assetName}\`
Format: ${size.label}, ${size.width}x${size.height}
Brief: ${slot.assetBrief}
Alt text: CCW EOFY campaign graphic for ${slot.title.toLowerCase()}.
On-screen text: ${slot.title}
Caption CTA: ${slot.cta}
Approval gate: ${slot.gate}
`;
    })
    .join('\n');

  return `# Creative Asset Briefs

All SVG files are draft social creative assets. Replace or enrich with approved CCW product photography before paid promotion. Text-only Reddit entries can publish without image where community rules favour plain text.

${rows}
`;
}

function generateQaChecklist() {
  return `# Approval QA Checklist

Campaign: ${CCW_EOFY_CAMPAIGN_NAME}

## Hard Gates

- [ ] CCW confirms social credentials for Facebook, Instagram, LinkedIn, and Reddit.
- [ ] CCW approves final offer wording.
- [ ] Current product prices and stock are checked on publish day.
- [ ] No unapproved sitewide EOFY discount is implied.
- [ ] No finance approval, repayment, tax, rate, or guarantee claim is present.
- [ ] Product imagery is approved by CCW before paid distribution.
- [ ] Reddit post placement complies with community rules and supplier disclosure.
- [ ] Meta ad spend remains disabled until explicit approval is recorded.

## Final Content Checks

- [ ] 19 scheduled draft calendar rows exist in Synthex.
- [ ] ${executions.length} platform executions have copy and visual briefs.
- [ ] Source and claim register is attached.
- [ ] UTM plan is ready for all post URLs.
- [ ] External publishing is blocked until credentials and final approval are both complete.
`;
}

function generateHandoff() {
  return `# Publishing Handoff

Campaign: ${CCW_EOFY_CAMPAIGN_NAME}

The campaign is production-ready as a Synthex draft pack. It is not externally publishable until CCW supplies credentials and approves final wording.

## Operator Instructions

1. Confirm CCW credentials are submitted through the secure intake flow.
2. Confirm Facebook/Instagram, LinkedIn, and Reddit connections appear active in Synthex.
3. Re-check product pages for stock, pricing, and current sale state on the publish day.
4. Run the approval checklist in \`04-approval-qa-checklist.md\`.
5. Publish only approved slots and keep Reddit community-safe.

## Final Handoff State

- Calendar applied to Synthex: yes.
- Draft calendar post count: 19.
- Platform executions prepared: ${executions.length}.
- SVG draft assets generated: ${executions.length}.
- External publish status: blocked pending credentials and final approval.
`;
}

function generateClaimRegister() {
  const rows = productProof
    .map(
      item => `## ${item.label}

Claim/use: ${item.proof}

Approved use: ${item.approvedUse}

Source: ${item.source}
`
    )
    .join('\n');
  return `# Source And Claim Register

${rows}
`;
}

function generateUtmCsv() {
  const header = [
    'date',
    'time_aest',
    'platform',
    'title',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'status',
  ];
  const rows = executions.map(({ slot, platform }) => [
    slot.date,
    slot.timeAest,
    platform,
    slot.title,
    platform,
    'organic_social',
    CCW_EOFY_CAMPAIGN_SLUG,
    slot.id,
    'draft_blocked',
  ]);
  return [header, ...rows]
    .map(row => row.map(value => csvEscape(String(value))).join(','))
    .join('\n');
}

function generateManifest() {
  return JSON.stringify(
    {
      campaignSlug: CCW_EOFY_CAMPAIGN_SLUG,
      campaignName: CCW_EOFY_CAMPAIGN_NAME,
      status: 'final_materials_ready_credentials_blocked',
      calendarSlots: ccwEofyCampaignCalendar.length,
      platformExecutions: executions.length,
      generatedAt: new Date().toISOString(),
      roots: {
        brandRoot,
        docsRoot,
      },
      hardGates: [
        'CCW social credentials required',
        'Final human approval required',
        'Product price and stock check required on publish day',
        'No Meta ad spend without explicit approval',
      ],
      sourceUrls: ccwEofySourceUrls,
      executions: executions.map(({ slot, platform, assetName }) => ({
        id: `${slot.id}-${platform}`,
        slotId: slot.id,
        date: slot.date,
        timeAest: slot.timeAest,
        platform,
        title: slot.title,
        content: slot.content,
        cta: slot.cta,
        hashtags: slot.hashtags,
        asset: `assets/svg/${assetName}`,
        assetBrief: slot.assetBrief,
        gate: slot.gate,
      })),
    },
    null,
    2
  );
}

function generateHtmlPreview() {
  const cards = executions
    .map(
      ({ slot, platform, assetName }) => `<article>
  <img src="assets/svg/${assetName}" alt="${xmlEscape(slot.title)}" />
  <h2>${xmlEscape(slot.title)}</h2>
  <p><strong>${xmlEscape(platformLabel(platform))}</strong> ${slot.date} ${slot.timeAest} AEST</p>
  <p>${xmlEscape(slot.content)}</p>
  <p><strong>${xmlEscape(slot.cta)}</strong></p>
</article>`
    )
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${CCW_EOFY_CAMPAIGN_NAME}</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #0f1f1c; color: #f8fafc; }
    main { max-width: 1180px; margin: 0 auto; padding: 32px; }
    h1 { font-size: 36px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
    article { border: 1px solid rgba(255,255,255,.16); padding: 16px; background: #162b27; }
    img { width: 100%; height: auto; background: #10231f; display: block; }
    p { color: #dbe7ef; line-height: 1.5; }
  </style>
</head>
<body>
  <main>
    <h1>${CCW_EOFY_CAMPAIGN_NAME}</h1>
    <p>${ccwEofyCampaignCalendar.length} calendar slots. ${executions.length} platform executions. Draft only until credentials and final approval are complete.</p>
    <section class="grid">${cards}</section>
  </main>
</body>
</html>
`;
}

function generateAssetsReadme() {
  return `# Draft SVG Assets

These assets are draft campaign materials generated from the approved CCW EOFY campaign schedule.

Use them for review, layout, and handoff. Replace or enrich with approved CCW product photography before paid distribution.
`;
}

function main() {
  ensureDir(brandRoot);
  ensureDir(docsRoot);

  writeBoth('README.md', generateReadme());
  writeBoth('01-platform-copy-deck.md', generateCopyDeck());
  writeBoth('02-creative-asset-briefs.md', generateAssetBriefs());
  writeBoth('03-production-asset-manifest.json', generateManifest());
  writeBoth('04-approval-qa-checklist.md', generateQaChecklist());
  writeBoth('05-publishing-handoff.md', generateHandoff());
  writeBoth('06-utm-tracking-plan.csv', generateUtmCsv());
  writeBoth('07-source-and-claim-register.md', generateClaimRegister());
  writeBoth('08-html-preview.html', generateHtmlPreview());
  writeBoth('assets/README.md', generateAssetsReadme());

  for (const { slot, platform, assetName } of executions) {
    writeBoth(`assets/svg/${assetName}`, renderSvg(slot, platform));
  }

  console.log(
    JSON.stringify(
      {
        brandRoot,
        docsRoot,
        calendarSlots: ccwEofyCampaignCalendar.length,
        platformExecutions: executions.length,
      },
      null,
      2
    )
  );
}

main();
