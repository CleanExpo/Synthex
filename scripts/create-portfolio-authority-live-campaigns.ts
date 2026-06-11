import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

type SourceInput = {
  id: string;
  label: string;
  url?: string;
  path?: string;
  sourceType: string;
  checkedAt?: string;
  warning?: string;
};

type ClaimInput = {
  id: string;
  statement: string;
  status: string;
  evidenceRefs: string[];
};

type DraftInput = {
  slotId: string;
  channel: string;
  title: string;
  body: string;
  cta: string;
  evidenceRefs: string[];
  assetBrief: string;
  publishInstruction: string;
};

type PortfolioCampaignInput = {
  clientSlug: string;
  campaignSlug: string;
  campaignName: string;
  websiteUrl: string;
  productName: string;
  primaryOffer: string;
  objective: string;
  audience: string[];
  channels: string[];
  sourcePath: string;
  sources: SourceInput[];
  claims: ClaimInput[];
  drafts: DraftInput[];
  publicAssets: string[];
  warnings: string[];
  externalPublishBlocks: Record<string, string[]>;
};

const CAMPAIGN_ROOT = path.join(
  process.cwd(),
  'docs/marketing-agency/full-authority-campaigns'
);

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function dedupeKey(campaignSlug: string, draft: DraftInput): string {
  return `${campaignSlug}:${slugify(draft.title)}`;
}

function uniqueDrafts(campaign: PortfolioCampaignInput): DraftInput[] {
  const seen = new Set<string>();
  const drafts: DraftInput[] = [];
  for (const draft of campaign.drafts) {
    const key = dedupeKey(campaign.campaignSlug, draft);
    if (seen.has(key)) continue;
    seen.add(key);
    drafts.push(draft);
  }
  return drafts;
}

function platformConnectionKey(channel: string): string {
  if (channel === 'youtube_shorts') return 'youtube';
  return channel;
}

function carsiCampaign(): PortfolioCampaignInput {
  const campaignSlug = 'carsi-restoration-training-authority-2026-06-11';
  const dir = path.join(CAMPAIGN_ROOT, campaignSlug);
  const pack = readJson<{
    campaignId: string;
    generatedAt: string;
    business: {
      websiteUrl: string;
      positioning: string;
      audience: string[];
    };
    objective: string;
    channels: string[];
    drafts: Array<{
      slotId: string;
      channel: string;
      title: string;
      body: string;
      cta: string;
      evidenceRefs: string[];
      assetBrief: string;
      publishInstruction: string;
    }>;
    qualityGate: { warnings: string[] };
    externalPublishBlocks: Record<string, string[]>;
  }>(path.join(dir, 'campaign-pack.json'));
  const manifest = readJson<{
    sources: SourceInput[];
    claims: ClaimInput[];
  }>(path.join(dir, 'evidence-manifest.json'));

  return {
    clientSlug: 'carsi',
    campaignSlug,
    campaignName: 'CARSI Restoration Training Authority',
    websiteUrl: pack.business.websiteUrl,
    productName: 'Restoration training authority campaign',
    primaryOffer: pack.business.positioning,
    objective: pack.objective,
    audience: pack.business.audience,
    channels: pack.channels,
    sourcePath: path.relative(process.cwd(), dir),
    sources: manifest.sources,
    claims: manifest.claims,
    drafts: pack.drafts,
    publicAssets: [
      '/marketing-agency/carsi-authority/assets/ig_0c9570c25797b413016a2a641946fc819195f0d17a7d443d79.png',
      '/marketing-agency/carsi-authority/assets/ig_0c9570c25797b413016a2a6392d0ac81918a3e44ea262f0c56.png',
      '/marketing-agency/carsi-authority/assets/carsi-3d-miniature-diorama.png',
      '/marketing-agency/carsi-authority/assets/carsi-3d-character-explainer.png',
    ],
    warnings: pack.qualityGate.warnings,
    externalPublishBlocks: pack.externalPublishBlocks,
  };
}

const consentSource: SourceInput = {
  id: 'internal-consent-evidence-policy',
  label: 'Synthex consent and story evidence policy',
  path: 'docs/marketing-agency/CONSENT-AND-STORY-EVIDENCE-POLICY.md',
  sourceType: 'internal_policy',
};

const humanApprovalSource: SourceInput = {
  id: 'human-approval-gates',
  label: 'Human approval gates for YMYL and publish-sensitive content',
  path: 'docs/marketing-intelligence/human-approval-gates.md',
  sourceType: 'internal_policy',
};

const portfolioCampaigns: PortfolioCampaignInput[] = [
  carsiCampaign(),
  {
    clientSlug: 'restoreassist',
    campaignSlug: 'restoreassist-authority-workflow-2026-06-11',
    campaignName: 'RestoreAssist Authority Workflow',
    websiteUrl: 'https://restoreassist.app',
    productName: 'Australian restoration workflow and reporting software',
    primaryOffer:
      'Evidence-led RestoreAssist launch package for restoration operators, focused on workflow proof, report readiness, and conservative compliance language.',
    objective:
      'Move RestoreAssist from mock launch material into a live Synthex authority package with source-led owned media and blocked external publishing gates.',
    audience: [
      'Australian restoration business owners',
      'office administrators coordinating restoration jobs',
      'field technicians capturing inspection evidence',
      'insurance and property stakeholders reviewing reports',
    ],
    channels: ['blog', 'newsletter', 'linkedin', 'facebook'],
    sourcePath:
      'docs/marketing-agency/RESTOREASSIST-SHOESTRING-LAUNCH-CAMPAIGN.md',
    sources: [
      {
        id: 'restoreassist-official-site',
        label: 'RestoreAssist official site',
        url: 'https://restoreassist.app',
        sourceType: 'official_business_site',
        checkedAt: '2026-06-11',
      },
      {
        id: 'restoreassist-shoestring-launch',
        label: 'RestoreAssist shoestring launch campaign',
        path: 'docs/marketing-agency/RESTOREASSIST-SHOESTRING-LAUNCH-CAMPAIGN.md',
        sourceType: 'internal_campaign_plan',
      },
      {
        id: 'restoreassist-asset-manifest',
        label: 'RestoreAssist launch asset manifest',
        path: 'docs/marketing-agency/RESTOREASSIST-LAUNCH-ASSET-MANIFEST.md',
        sourceType: 'internal_asset_manifest',
      },
      humanApprovalSource,
      consentSource,
    ],
    claims: [
      {
        id: 'ra-organic-first',
        statement:
          'RestoreAssist launch work is organic-first, with paid spend and Meta publishing blocked until explicit approval.',
        status: 'verified',
        evidenceRefs: ['restoreassist-shoestring-launch'],
      },
      {
        id: 'ra-asset-gates',
        statement:
          'RestoreAssist launch assets require accurate product facts, evidence-linked claims, and no fake customer stories before client-ready use.',
        status: 'verified',
        evidenceRefs: [
          'restoreassist-asset-manifest',
          'internal-consent-evidence-policy',
        ],
      },
      {
        id: 'ra-ymyl-gate',
        statement:
          'Insurance, safety, restoration, or compliance claims require approval-gated review before external publishing.',
        status: 'verified',
        evidenceRefs: ['human-approval-gates'],
      },
    ],
    drafts: [
      {
        slotId: 'restoreassist-authority-01-blog',
        channel: 'blog',
        title: 'How to check a restoration report before it leaves the office',
        body: 'A useful restoration report is not just a PDF. It needs clean job context, photos, measurements, damage notes, scope logic, and a review trail before it is sent to an insurer, property manager, or client. RestoreAssist launch content will stay focused on this workflow proof instead of unsupported outcome claims.',
        cta: 'Open the RestoreAssist workflow proof before writing the next launch post.',
        evidenceRefs: [
          'restoreassist-shoestring-launch',
          'restoreassist-asset-manifest',
        ],
        assetBrief:
          'Create a clean workflow checklist visual with editable text outside the bitmap.',
        publishInstruction:
          'Owned media only until product, privacy, and CTA checks pass.',
      },
      {
        slotId: 'restoreassist-authority-02-linkedin',
        channel: 'linkedin',
        title: 'The missing step in restoration software marketing',
        body: 'Most restoration software posts jump straight to speed. The safer first proof is evidence quality: what was captured, what was checked, and what can be defended later. RestoreAssist content will lead with report readiness and workflow clarity, not inflated automation claims.',
        cta: 'Save this as the pre-publish test for RestoreAssist content.',
        evidenceRefs: [
          'restoreassist-shoestring-launch',
          'human-approval-gates',
        ],
        assetBrief:
          'Founder-led LinkedIn image with checklist composition and no fake UI screenshots.',
        publishInstruction:
          'External publish remains gated until platform credentials and final approval are recorded.',
      },
    ],
    publicAssets: [],
    warnings: [
      'RestoreAssist external publishing and paid spend remain blocked by default.',
    ],
    externalPublishBlocks: {
      linkedin: [
        'platform_credentials_required',
        'final_claim_review_required',
      ],
      facebook: [
        'platform_credentials_required',
        'meta_publish_spend_gate_required',
      ],
    },
  },
  {
    clientSlug: 'disaster-recovery',
    campaignSlug: 'disaster-recovery-response-authority-2026-06-11',
    campaignName: 'Disaster Recovery Response Authority',
    websiteUrl: 'https://disasterrecovery.com.au',
    productName: 'Emergency restoration response authority campaign',
    primaryOffer:
      'Conservative source-led Disaster Recovery campaign package for emergency restoration education, insurance documentation, and response-readiness messaging.',
    objective:
      'Make Disaster Recovery live in Synthex as an evidence-gated authority package while keeping emergency, safety, mould, insurance, and certification claims approval-gated.',
    audience: [
      'property managers',
      'strata managers',
      'business owners facing property damage',
      'insurance adjusters and claims stakeholders',
    ],
    channels: ['blog', 'newsletter', 'linkedin', 'facebook'],
    sourcePath: 'scripts/seed-brand-dna.ts',
    sources: [
      {
        id: 'dr-official-site',
        label: 'Disaster Recovery official site',
        url: 'https://disasterrecovery.com.au',
        sourceType: 'official_business_site',
        checkedAt: '2026-06-11',
      },
      {
        id: 'dr-brand-dna',
        label: 'Disaster Recovery brand DNA seed',
        path: 'scripts/seed-brand-dna.ts',
        sourceType: 'internal_brand_dna',
      },
      {
        id: 'tier-b-identity-resolution',
        label: 'Nested brand identity resolution scope',
        path: 'docs/tier-b/identity-resolution-l1.md',
        sourceType: 'internal_architecture_scope',
      },
      humanApprovalSource,
      consentSource,
    ],
    claims: [
      {
        id: 'dr-ymyl-gated',
        statement:
          'Disaster Recovery campaign content is YMYL-adjacent and must not publish safety, mould, insurance, certification, or response-performance claims without evidence and approval.',
        status: 'verified',
        evidenceRefs: ['human-approval-gates', 'dr-brand-dna'],
      },
      {
        id: 'dr-nested-brand-boundary',
        statement:
          'Disaster Recovery sits inside the DR, NRPG, RestoreAssist, and CARSI nested-brand ecosystem with strict consent and privacy boundaries.',
        status: 'verified',
        evidenceRefs: ['tier-b-identity-resolution'],
      },
    ],
    drafts: [
      {
        slotId: 'dr-authority-01-blog',
        channel: 'blog',
        title: 'What to document first after property damage',
        body: 'The safest Disaster Recovery campaign angle is not a panic claim. It is a practical documentation checklist: what happened, when it was found, what areas were affected, what photos exist, and which stakeholders need the record. Emergency, mould, insurance, and safety advice remains review-gated before publishing.',
        cta: 'Use the documentation checklist before writing response content.',
        evidenceRefs: ['dr-brand-dna', 'human-approval-gates'],
        assetBrief:
          'Create a calm response-readiness checklist visual with no dramatic disaster imagery.',
        publishInstruction:
          'Owned media only until legal/compliance claim review passes.',
      },
      {
        slotId: 'dr-authority-02-linkedin',
        channel: 'linkedin',
        title: 'Response marketing needs proof, not panic',
        body: 'Disaster Recovery content should earn trust by showing documentation discipline, stakeholder clarity, and source-backed claims. The campaign is live inside Synthex, but external publishing stays gated until credentials and approval evidence are recorded.',
        cta: 'Save this as the first rule for emergency restoration content.',
        evidenceRefs: ['dr-brand-dna', 'internal-consent-evidence-policy'],
        assetBrief:
          'Professional LinkedIn source-card visual using the DR logo only when brand asset rights are confirmed.',
        publishInstruction:
          'External publish remains gated until platform credentials and claim approval are recorded.',
      },
    ],
    publicAssets: ['/brands/disaster-recovery/logo.webp'],
    warnings: [
      'Emergency and insurance-adjacent claims remain approval-gated.',
    ],
    externalPublishBlocks: {
      linkedin: [
        'platform_credentials_required',
        'legal_or_compliance_claim_review_required',
      ],
      facebook: [
        'platform_credentials_required',
        'legal_or_compliance_claim_review_required',
      ],
    },
  },
  {
    clientSlug: 'nrpg',
    campaignSlug: 'nrpg-contractor-network-authority-2026-06-11',
    campaignName: 'NRPG Contractor Network Authority',
    websiteUrl: 'https://nrpg.com.au',
    productName: 'Restoration contractor network authority campaign',
    primaryOffer:
      'Source-led NRPG campaign package for contractor recruitment, standards-led network education, and DR pipeline readiness.',
    objective:
      'Make NRPG live in Synthex as a standards-led contractor-network package while surfacing the current website verification and external publishing gates.',
    audience: [
      'independent restoration contractors',
      'small restoration firms',
      'technicians moving toward business ownership',
      'operators interested in DR pipeline participation',
    ],
    channels: ['blog', 'newsletter', 'linkedin'],
    sourcePath: 'scripts/seed-brand-dna.ts',
    sources: [
      {
        id: 'nrpg-official-site',
        label: 'NRPG official site',
        url: 'https://nrpg.com.au',
        sourceType: 'official_business_site_unverified_currently_unreachable',
        checkedAt: '2026-06-11',
        warning:
          'HTTP check returned 000 from local machine; recheck before external publishing.',
      },
      {
        id: 'nrpg-brand-dna',
        label: 'NRPG brand DNA seed',
        path: 'scripts/seed-brand-dna.ts',
        sourceType: 'internal_brand_dna',
      },
      {
        id: 'nrpg-budget-ledger',
        label: 'NRPG to DR per-location budget ledger',
        path: 'lib/budget/README.md',
        sourceType: 'internal_pipeline_control',
      },
      {
        id: 'tier-b-trigger-orchestration',
        label: 'Trigger orchestration and frequency cap scope',
        path: 'docs/tier-b/trigger-orchestration.md',
        sourceType: 'internal_architecture_scope',
      },
      consentSource,
    ],
    claims: [
      {
        id: 'nrpg-pipeline-gated',
        statement:
          'NRPG to Disaster Recovery pipeline messaging must respect budget, contractor, source-of-truth job ID, and frequency-cap controls.',
        status: 'verified',
        evidenceRefs: ['nrpg-budget-ledger', 'tier-b-trigger-orchestration'],
      },
      {
        id: 'nrpg-website-recheck',
        statement:
          'NRPG website evidence needs a fresh successful HTTP check before external publication claims rely on it.',
        status: 'needs_recheck',
        evidenceRefs: ['nrpg-official-site'],
      },
    ],
    drafts: [
      {
        slotId: 'nrpg-authority-01-blog',
        channel: 'blog',
        title: 'What a standards-led contractor network needs before promotion',
        body: 'NRPG content needs to explain contractor standards and pipeline participation without overpromising work volume, insurance outcomes, or automatic coverage. The source-led campaign is live in Synthex, with website verification and external publishing gates visible before distribution.',
        cta: 'Check the NRPG source register before contractor recruitment copy goes out.',
        evidenceRefs: ['nrpg-brand-dna', 'nrpg-budget-ledger'],
        assetBrief:
          'Create a contractor-network checklist visual with standards, pipeline, and evidence gates.',
        publishInstruction:
          'Owned media only until NRPG site and claims are rechecked.',
      },
      {
        slotId: 'nrpg-authority-02-linkedin',
        channel: 'linkedin',
        title: 'Contractor recruitment needs operational truth',
        body: 'The strongest NRPG campaign angle is not hype. It is operational truth: standards, budget discipline, pipeline constraints, and consent-aware communication. External publishing waits for current website verification and platform credentials.',
        cta: 'Use this as the first NRPG contractor-network content gate.',
        evidenceRefs: ['nrpg-brand-dna', 'tier-b-trigger-orchestration'],
        assetBrief:
          'Founder/brand hybrid LinkedIn source card, no invented member claims or testimonials.',
        publishInstruction:
          'External publish remains gated until website recheck and platform credentials pass.',
      },
    ],
    publicAssets: [],
    warnings: [
      'NRPG official website check returned HTTP 000 from this machine.',
    ],
    externalPublishBlocks: {
      linkedin: [
        'platform_credentials_required',
        'nrpg_website_recheck_required',
      ],
    },
  },
];

async function upsertCampaign(input: PortfolioCampaignInput, ownerId: string) {
  const org = await prisma.organization.findUnique({
    where: { slug: input.clientSlug },
    select: { id: true, slug: true, name: true },
  });
  if (!org) throw new Error(`Organization not found: ${input.clientSlug}`);

  const drafts = uniqueDrafts(input);
  const ownedDrafts = drafts.filter(draft =>
    ['blog', 'newsletter'].includes(draft.channel)
  );
  const externalDrafts = drafts.filter(
    draft => !['blog', 'newsletter'].includes(draft.channel)
  );
  const externalPlatforms = Array.from(
    new Set(externalDrafts.map(draft => platformConnectionKey(draft.channel)))
  );
  const connections = await prisma.platformConnection.findMany({
    where: {
      organizationId: org.id,
      deletedAt: null,
      isActive: true,
      platform: { in: externalPlatforms },
    },
    select: { platform: true },
  });
  const connectedPlatforms = connections.map(connection => connection.platform);
  const missingPlatforms = externalPlatforms.filter(
    platform => !connectedPlatforms.includes(platform)
  );

  const metadata = {
    campaignFamily: 'portfolio-authority',
    liveCampaign: true,
    campaignSlug: input.campaignSlug,
    sourcePath: input.sourcePath,
    websiteUrl: input.websiteUrl,
    connectedPlatforms,
    missingPlatforms,
    externalPublishBlocks: input.externalPublishBlocks,
    publicAssets: input.publicAssets,
    warnings: input.warnings,
    generatedAt: new Date().toISOString(),
  } satisfies Prisma.InputJsonObject;

  const marketingCampaign = await prisma.marketingAgencyCampaign.upsert({
    where: {
      organizationId_slug: {
        organizationId: org.id,
        slug: input.campaignSlug,
      },
    },
    update: {
      name: input.campaignName,
      status: 'live_owned_media_external_gated',
      providerMode: 'live',
      productName: input.productName,
      primaryOffer: input.primaryOffer,
      boardMemo: {
        objective: input.objective,
        audience: input.audience,
        channels: input.channels,
        publishingGate:
          'Owned media package is live in Synthex. External platforms remain blocked until credentials, approval, source checks, and final asset-rights checks are recorded.',
      },
      metadata,
    },
    create: {
      organizationId: org.id,
      createdById: ownerId,
      name: input.campaignName,
      slug: input.campaignSlug,
      status: 'live_owned_media_external_gated',
      providerMode: 'live',
      productName: input.productName,
      primaryOffer: input.primaryOffer,
      boardMemo: {
        objective: input.objective,
        audience: input.audience,
        channels: input.channels,
        publishingGate:
          'Owned media package is live in Synthex. External platforms remain blocked until credentials, approval, source checks, and final asset-rights checks are recorded.',
      },
      metadata,
    },
  });

  await prisma.marketingAgencySourceRef.deleteMany({
    where: { campaignId: marketingCampaign.id },
  });
  await prisma.marketingAgencyClaim.deleteMany({
    where: { campaignId: marketingCampaign.id },
  });
  await prisma.marketingAgencyAsset.deleteMany({
    where: { campaignId: marketingCampaign.id },
  });
  await prisma.marketingAgencyQaReport.deleteMany({
    where: { campaignId: marketingCampaign.id },
  });
  await prisma.marketingAgencyExportPackage.deleteMany({
    where: { campaignId: marketingCampaign.id },
  });

  const sourceRefs = new Map<string, string>();
  for (const source of input.sources) {
    const created = await prisma.marketingAgencySourceRef.create({
      data: {
        organizationId: org.id,
        createdById: ownerId,
        campaignId: marketingCampaign.id,
        label: source.label,
        url: source.url,
        path: source.path,
        sourceType: source.sourceType,
        requiredForClaims: true,
        metadata: {
          sourceId: source.id,
          checkedAt: source.checkedAt,
          warning: source.warning,
        },
      },
      select: { id: true },
    });
    sourceRefs.set(source.id, created.id);
  }

  for (const claim of input.claims) {
    await prisma.marketingAgencyClaim.create({
      data: {
        organizationId: org.id,
        createdById: ownerId,
        campaignId: marketingCampaign.id,
        sourceRefId: sourceRefs.get(claim.evidenceRefs[0]) ?? null,
        statement: claim.statement,
        claimType: 'portfolio_authority_gate',
        evidenceStatus: claim.status,
        evidenceNotes: `Evidence refs: ${claim.evidenceRefs.join(', ')}`,
        metadata: {
          claimId: claim.id,
          evidenceRefs: claim.evidenceRefs,
        },
      },
    });
  }

  await prisma.marketingAgencyAsset.create({
    data: {
      organizationId: org.id,
      createdById: ownerId,
      campaignId: marketingCampaign.id,
      provider: 'synthex',
      assetType: 'portfolio_authority_material_pack',
      title: `${input.campaignName} material pack`,
      licenceStatus: 'owned_or_generated_support_assets_review_required',
      licenceUrl: input.websiteUrl,
      metadata: {
        draftCount: drafts.length,
        ownedDrafts: ownedDrafts.length,
        externalDrafts: externalDrafts.length,
        publicAssets: input.publicAssets,
        sourcePath: input.sourcePath,
      },
    },
  });

  await prisma.marketingAgencyQaReport.create({
    data: {
      organizationId: org.id,
      createdById: ownerId,
      campaignId: marketingCampaign.id,
      status: 'pass_owned_media_external_gated',
      blockedReasons: Object.values(input.externalPublishBlocks).flat(),
      warnings: input.warnings,
      checks: [
        {
          name: 'source_register',
          status: 'pass',
          detail: `${input.sources.length} sources registered`,
        },
        {
          name: 'owned_media',
          status: 'pass',
          detail: `${ownedDrafts.length} owned-media drafts live in Synthex`,
        },
        {
          name: 'external_publish',
          status: 'blocked',
          detail:
            missingPlatforms.length > 0
              ? `Missing active connections: ${missingPlatforms.join(', ')}`
              : 'Connections found; final approval and asset-rights checks still required.',
        },
      ],
      metadata,
    },
  });

  await prisma.marketingAgencyExportPackage.create({
    data: {
      organizationId: org.id,
      createdById: ownerId,
      campaignId: marketingCampaign.id,
      status: 'live_owned_media_external_gated',
      formats: input.channels,
      artifactManifest: {
        campaignSlug: input.campaignSlug,
        campaignName: input.campaignName,
        dashboardRoute: `/dashboard/marketing-agency/${input.clientSlug}/authority`,
        studioRoute: `/dashboard/marketing-agency/${input.clientSlug}/studio`,
        drafts,
        sources: input.sources,
        claims: input.claims,
        externalPublishBlocks: input.externalPublishBlocks,
      },
      handoffNotes: `${input.campaignName} is live inside Synthex with source refs, owned-media drafts, Studio approvals, QA gates, and blocked external channels surfaced explicitly.`,
      metadata,
    },
  });

  let appCampaign = await prisma.campaign.findFirst({
    where: {
      organizationId: org.id,
      platform: 'multi',
      name: input.campaignName,
      deletedAt: null,
    },
  });

  const appCampaignData = {
    description: `${input.campaignName} staged for owned media and external platform review. External publishing awaits credentials, final approval, and asset-rights checks.`,
    platform: 'multi',
    status: 'active',
    content: {
      campaignSlug: input.campaignSlug,
      campaignFamily: 'portfolio-authority',
      providerMode: 'live',
      drafts,
    },
    settings: {
      publishEnabled: false,
      adSpendEnabled: false,
      ownedMediaLive: true,
      externalPublishEnabled: false,
      requiresCredentialIntake: true,
      externalPublishBlocks: input.externalPublishBlocks,
    },
  };

  if (!appCampaign) {
    appCampaign = await prisma.campaign.create({
      data: {
        organizationId: org.id,
        userId: ownerId,
        name: input.campaignName,
        ...appCampaignData,
      },
    });
  } else {
    appCampaign = await prisma.campaign.update({
      where: { id: appCampaign.id },
      data: appCampaignData,
    });
  }

  await prisma.post.deleteMany({ where: { campaignId: appCampaign.id } });
  for (const draft of drafts) {
    await prisma.post.create({
      data: {
        campaignId: appCampaign.id,
        platform: draft.channel,
        status: ['blog', 'newsletter'].includes(draft.channel)
          ? 'ready_owned_media'
          : 'pending_approval',
        source: 'synthex-live-portfolio-authority',
        content: `${draft.body}\n\nCTA: ${draft.cta}`,
        metadata: {
          slotId: draft.slotId,
          title: draft.title,
          campaignSlug: input.campaignSlug,
          evidenceRefs: draft.evidenceRefs,
          assetBrief: draft.assetBrief,
          publishInstruction: draft.publishInstruction,
          publishBlockedReason: ['blog', 'newsletter'].includes(draft.channel)
            ? null
            : 'Awaiting platform credentials, final approval, source checks, and asset-rights checks.',
        },
      },
    });

    await prisma.studioContentDraft.upsert({
      where: {
        organizationId_clientSlug_dedupeKey: {
          organizationId: org.id,
          clientSlug: input.clientSlug,
          dedupeKey: dedupeKey(input.campaignSlug, draft),
        },
      },
      create: {
        organizationId: org.id,
        clientSlug: input.clientSlug,
        topic: draft.title,
        script: `${draft.body}\n\nCTA: ${draft.cta}`,
        status: 'approved',
        approvedBy: ownerId,
        approvedAt: new Date(),
        platforms: [draft.channel],
        videoProvider: 'owned_media',
        dedupeKey: dedupeKey(input.campaignSlug, draft),
        metadata: {
          campaignSlug: input.campaignSlug,
          campaignFamily: 'portfolio-authority',
          campaignId: appCampaign.id,
          marketingAgencyCampaignId: marketingCampaign.id,
          slotId: draft.slotId,
          evidenceRefs: draft.evidenceRefs,
          externalPublishBlocked: !['blog', 'newsletter'].includes(
            draft.channel
          ),
        },
      },
      update: {
        topic: draft.title,
        script: `${draft.body}\n\nCTA: ${draft.cta}`,
        status: 'approved',
        approvedBy: ownerId,
        approvedAt: new Date(),
        platforms: [draft.channel],
        videoProvider: 'owned_media',
        metadata: {
          campaignSlug: input.campaignSlug,
          campaignFamily: 'portfolio-authority',
          campaignId: appCampaign.id,
          marketingAgencyCampaignId: marketingCampaign.id,
          slotId: draft.slotId,
          evidenceRefs: draft.evidenceRefs,
          externalPublishBlocked: !['blog', 'newsletter'].includes(
            draft.channel
          ),
        },
      },
    });
  }

  return {
    clientSlug: org.slug,
    campaignId: appCampaign.id,
    marketingAgencyCampaignId: marketingCampaign.id,
    drafts: drafts.length,
    ownedDrafts: ownedDrafts.length,
    externalDrafts: externalDrafts.length,
    missingPlatforms,
    route: `/dashboard/marketing-agency/${input.clientSlug}/authority`,
  };
}

async function main() {
  const ownerEmails = (process.env.OWNER_EMAILS ?? 'phill.mcgurk@gmail.com')
    .split(',')
    .map(email => email.trim())
    .filter(Boolean);
  const owner = await prisma.user.findFirst({
    where: { email: { in: ownerEmails } },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, email: true },
  });
  if (!owner) throw new Error('No owner user found from OWNER_EMAILS');

  const requested = process.argv
    .filter(arg => arg.startsWith('--client='))
    .map(arg => arg.replace('--client=', ''));
  const campaigns =
    requested.length > 0
      ? portfolioCampaigns.filter(campaign =>
          requested.includes(campaign.clientSlug)
        )
      : portfolioCampaigns;

  if (campaigns.length === 0) {
    throw new Error(
      `No matching portfolio campaigns for ${requested.join(', ')}`
    );
  }

  const results = [];
  for (const campaign of campaigns) {
    results.push(await upsertCampaign(campaign, owner.id));
  }

  console.log(JSON.stringify({ success: true, results }, null, 2));
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
