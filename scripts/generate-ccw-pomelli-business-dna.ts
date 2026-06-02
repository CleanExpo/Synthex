#!/usr/bin/env tsx
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CCW_EOFY_CAMPAIGN_NAME,
  CCW_EOFY_CAMPAIGN_SLUG,
  ccwEofyCampaignCalendar,
  ccwEofySourceUrls,
} from '../lib/marketing-agency/ccw-eofy-calendar';

const brandRoot =
  '/Users/phill-mac/Synthex-Brain-2/06-Brands/ccw/Google-Pomelli-Business-DNA';
const docsRoot = path.resolve(
  process.cwd(),
  'docs/marketing-agency/ccw/google-pomelli-business-dna'
);

const generatedAt = '2026-06-02T00:00:00+10:00';

const businessDna = {
  businessName: 'CCW',
  website: 'https://ccwonline.com.au/',
  campaignSlug: CCW_EOFY_CAMPAIGN_SLUG,
  campaignName: CCW_EOFY_CAMPAIGN_NAME,
  pomelliCompatibility: {
    product: 'Google Pomelli Business DNA',
    status: 'synthex_generated_ready_for_external_pomelli_review',
    note: 'No public Pomelli API is wired in this repo. This packet mirrors the Business DNA intake layer and is stored as Synthex-owned campaign evidence.',
  },
  brandCore: {
    positioning:
      'Australian one-stop supplier for professional carpet cleaning and restoration operators who need equipment, consumables, finance-aware planning, and practical buying support.',
    vertical: 'professional cleaning and restoration equipment supply',
    industry: 'trade equipment ecommerce',
    audience: [
      'Carpet cleaning business owners',
      'Water damage and restoration operators',
      'Cleaning technicians planning equipment upgrades',
      'Operations managers building job-ready equipment stacks',
      'Trade buyers who need stock, pricing, finance enquiry, and practical support before EOFY',
    ],
    values: [
      'Practical trade advice',
      'Operator-first equipment selection',
      'Evidence-backed product claims',
      'Stock and price accuracy',
      'No unsupported finance or tax promises',
    ],
  },
  voice: {
    voiceTag: 'trade_practical_direct',
    formality: 3,
    boldness: 3,
    tone: 'Practical, direct, trade-smart, and useful. Speak like a supplier helping a working operator remove bottlenecks, not like a generic ecommerce promo.',
    samplePhrases: [
      'Shortlist the gear that removes real job-site friction.',
      'Check current stock and pricing with CCW before you buy.',
      'Audit extraction, drying, meters, hoses, chemicals, and backups before adding anything new.',
      'Finance is an enquiry pathway, not a promise of approval, rate, repayment, or tax outcome.',
    ],
    avoid: [
      'Hype-led urgency without evidence',
      'Invented sitewide EOFY discounts',
      'Guaranteed drying-time claims',
      'Tax advice',
      'Finance approval or repayment claims',
      'Competitor comparisons without verified evidence',
    ],
  },
  visualSystem: {
    primaryColour: '#0f6b45',
    secondaryColour: '#f5c542',
    neutralColour: '#111827',
    supportingColours: ['#f8fafc', '#d7dde5', '#2f7d5a'],
    typography:
      'Use clear, utilitarian sans-serif typography. Keep headlines short, uppercase only where it improves scan speed, and avoid decorative type.',
    imagery:
      'Use approved CCW product photography and product-category layouts. Draft SVGs are layout proofs only until approved product images are supplied.',
    composition:
      'Dense but clean trade layout: product range, checklist, feature chips, stock/price check CTA, and evidence-led notes.',
  },
  offersAndTopics: [
    'EOFY equipment audit',
    'Carpet cleaning machines and accessories',
    'Air movers and drying-stack planning',
    'Moisture checks and restoration workflow',
    'Chemicals, hoses, wands, sprayers, and consumables',
    'Stock and sale-price verification',
    'Equipment finance enquiry pathway',
  ],
  channelRules: {
    facebook:
      'Useful product-range posts, sale-product spotlights, and final reminders. No Meta publishing or ad spend until credentials and approval are recorded.',
    instagram:
      'Checklist reels, product-category carousels, and saveable visual prompts using approved product imagery.',
    linkedin:
      'Business-owner planning angle: operational bottlenecks, finance-aware shortlist process, and professional equipment planning.',
    reddit:
      'Community-safe advice only. No hard sell. Disclose supplier connection and only post where supplier participation is allowed.',
  },
  evidenceSources: ccwEofySourceUrls,
  campaignGrounding: {
    calendarSlots: ccwEofyCampaignCalendar.length,
    platformExecutions: ccwEofyCampaignCalendar.reduce(
      (count, slot) => count + slot.platforms.length,
      0
    ),
    activeObjective:
      'Generate immediate CCW EOFY sales campaign assets while preserving publishing, claim, and credential gates.',
  },
};

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

function list(items: string[]) {
  return items.map(item => `- ${item}`).join('\n');
}

function renderReadme() {
  return `# CCW Google Pomelli Business DNA

Generated: ${generatedAt}

This folder contains the CCW Business DNA packet for Pomelli-style campaign generation and Synthex campaign governance.

Status: synthex_generated_ready_for_external_pomelli_review

## Files

- 01-business-dna-profile.md
- 02-channel-generation-rules.md
- 03-claim-and-approval-guardrails.md
- 04-pomelli-onboarding-packet.json
- 05-campaign-activation-brief.md
- 06-source-register.md

## Operating note

No public Pomelli API is wired in this repo. This packet is the Synthex-owned Business DNA layer that can be used for Pomelli manual intake, Synthex generation, and campaign QA.
`;
}

function renderProfile() {
  return `# CCW Business DNA Profile

## Business

- Business: ${businessDna.businessName}
- Website: ${businessDna.website}
- Vertical: ${businessDna.brandCore.vertical}
- Industry: ${businessDna.brandCore.industry}
- Campaign: ${businessDna.campaignName}

## Positioning

${businessDna.brandCore.positioning}

## Audience

${list(businessDna.brandCore.audience)}

## Values

${list(businessDna.brandCore.values)}

## Voice

${businessDna.voice.tone}

## Sample Phrases

${list(businessDna.voice.samplePhrases)}

## Avoid

${list(businessDna.voice.avoid)}

## Visual System

- Primary colour: ${businessDna.visualSystem.primaryColour}
- Secondary colour: ${businessDna.visualSystem.secondaryColour}
- Neutral colour: ${businessDna.visualSystem.neutralColour}
- Typography: ${businessDna.visualSystem.typography}
- Imagery: ${businessDna.visualSystem.imagery}
- Composition: ${businessDna.visualSystem.composition}
`;
}

function renderChannelRules() {
  return `# CCW Channel Generation Rules

## Offers and Topics

${list(businessDna.offersAndTopics)}

## Facebook

${businessDna.channelRules.facebook}

## Instagram

${businessDna.channelRules.instagram}

## LinkedIn

${businessDna.channelRules.linkedin}

## Reddit

${businessDna.channelRules.reddit}
`;
}

function renderGuardrails() {
  return `# CCW Claim and Approval Guardrails

## Required Checks Before Publishing

- Confirm current stock and listed pricing on publish day.
- Confirm each product image is approved CCW-owned or licensed imagery.
- Keep finance wording to enquiry pathways only.
- Do not give tax advice or imply deductibility.
- Do not claim finance approval, rates, repayment amounts, or terms.
- Do not publish to Meta, LinkedIn, or Reddit until credentials and final CCW approval are recorded.
- For Reddit, confirm community rules and disclose supplier participation.

## Approved Claim Pattern

Use practical statements grounded in CCW source pages and campaign evidence.

## Blocked Claim Pattern

Avoid invented sale duration, sitewide discount language, guaranteed drying outcomes, unsupported comparisons, and unverified product availability.
`;
}

function renderActivationBrief() {
  return `# CCW Campaign Activation Brief

## Objective

Activate the CCW EOFY sales campaign with Business DNA already generated, approved guardrails in place, and platform drafts ready for credential-secure publishing.

## Generation Inputs

- Brand DNA: this folder
- Campaign materials: /Users/phill-mac/Synthex-Brain-2/06-Brands/ccw/EOFY-2026-Campaign-Materials
- Live Synthex campaign slug: ${CCW_EOFY_CAMPAIGN_SLUG}
- Calendar slots: ${businessDna.campaignGrounding.calendarSlots}
- Platform executions: ${businessDna.campaignGrounding.platformExecutions}

## Activation State

- Business DNA: complete inside Synthex
- External Pomelli API upload: not available in repo
- Campaign copy: complete
- Draft SVG layout assets: complete
- Live campaign records: ready for finalizer attachment
- External publishing: blocked until CCW credentials and approval
`;
}

function renderSourceRegister() {
  return `# CCW Business DNA Source Register

${businessDna.evidenceSources
  .map((source, index) => `${index + 1}. ${source}`)
  .join('\n')}

Additional local source: /Users/phill-mac/Synthex-Brain-2/03-Research/2026-06-01-pomelli-synthex-integration-brief.md
`;
}

writeBoth('README.md', renderReadme());
writeBoth('01-business-dna-profile.md', renderProfile());
writeBoth('02-channel-generation-rules.md', renderChannelRules());
writeBoth('03-claim-and-approval-guardrails.md', renderGuardrails());
writeBoth(
  '04-pomelli-onboarding-packet.json',
  `${JSON.stringify({ generatedAt, ...businessDna }, null, 2)}\n`
);
writeBoth('05-campaign-activation-brief.md', renderActivationBrief());
writeBoth('06-source-register.md', renderSourceRegister());

console.log(
  JSON.stringify(
    {
      brandRoot,
      docsRoot,
      files: 6,
      status: businessDna.pomelliCompatibility.status,
    },
    null,
    2
  )
);
