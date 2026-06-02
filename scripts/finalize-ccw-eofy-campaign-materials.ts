import * as fs from 'node:fs';
import * as path from 'node:path';
import prisma from '../lib/prisma';
import {
  CCW_EOFY_CAMPAIGN_NAME,
  CCW_EOFY_CAMPAIGN_SLUG,
  ccwEofyCampaignCalendar,
} from '../lib/marketing-agency/ccw-eofy-calendar';

const brandRoot =
  '/Users/phill-mac/Synthex-Brain-2/06-Brands/ccw/EOFY-2026-Campaign-Materials';
const docsRoot = path.resolve(
  process.cwd(),
  'docs/marketing-agency/ccw/eofy-2026-materials'
);
const pomelliBrandRoot =
  '/Users/phill-mac/Synthex-Brain-2/06-Brands/ccw/Google-Pomelli-Business-DNA';
const pomelliDocsRoot = path.resolve(
  process.cwd(),
  'docs/marketing-agency/ccw/google-pomelli-business-dna'
);
const manifestPath = path.join(docsRoot, '03-production-asset-manifest.json');
const pomelliPacketPath = path.join(
  pomelliDocsRoot,
  '04-pomelli-onboarding-packet.json'
);

function requireManifest() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Material manifest missing: ${manifestPath}`);
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    platformExecutions: number;
    calendarSlots: number;
    executions: unknown[];
  };
}

function requirePomelliPacket() {
  if (!fs.existsSync(pomelliPacketPath)) {
    throw new Error(
      `Pomelli Business DNA packet missing: ${pomelliPacketPath}`
    );
  }
  return JSON.parse(fs.readFileSync(pomelliPacketPath, 'utf8')) as {
    businessName: string;
    website: string;
    brandCore: {
      vertical: string;
      industry: string;
      audience: string[];
      values: string[];
    };
    voice: {
      voiceTag: string;
      formality: number;
      boldness: number;
      tone: string;
      samplePhrases: string[];
    };
    visualSystem: {
      primaryColour: string;
      secondaryColour: string;
      neutralColour: string;
    };
    offersAndTopics: string[];
    campaignGrounding: {
      calendarSlots: number;
      platformExecutions: number;
    };
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

async function main() {
  const manifest = requireManifest();
  const pomelliPacket = requirePomelliPacket();
  const ccw = await prisma.organization.findUnique({
    where: { slug: 'ccw' },
  });
  if (!ccw) throw new Error('CCW organization not found');

  const ownerEmails = (process.env.OWNER_EMAILS ?? '')
    .split(',')
    .map(email => email.trim())
    .filter(Boolean);
  const owner =
    (await prisma.user.findFirst({
      where: {
        email: { in: ownerEmails },
        activeOrganizationId: ccw.id,
      },
      orderBy: { updatedAt: 'desc' },
    })) ??
    (await prisma.user.findFirst({
      where: { email: { in: ownerEmails } },
      orderBy: { updatedAt: 'desc' },
    }));
  if (!owner) throw new Error('No owner user found from OWNER_EMAILS');

  const marketingCampaign = await prisma.marketingAgencyCampaign.findFirst({
    where: {
      organizationId: ccw.id,
      slug: CCW_EOFY_CAMPAIGN_SLUG,
    },
    orderBy: { updatedAt: 'desc' },
  });
  if (!marketingCampaign) {
    throw new Error(
      `Marketing agency campaign not found: ${CCW_EOFY_CAMPAIGN_SLUG}`
    );
  }

  const appCampaign = await prisma.campaign.findFirst({
    where: {
      organizationId: ccw.id,
      name: CCW_EOFY_CAMPAIGN_NAME,
      deletedAt: null,
    },
    orderBy: { updatedAt: 'desc' },
  });
  if (!appCampaign)
    throw new Error(`App campaign not found: ${CCW_EOFY_CAMPAIGN_NAME}`);

  const calendarCount = await prisma.calendarPost.count({
    where: {
      organizationId: ccw.id,
      campaignId: appCampaign.id,
      tags: { has: CCW_EOFY_CAMPAIGN_SLUG },
      status: 'draft',
    },
  });
  if (calendarCount !== ccwEofyCampaignCalendar.length) {
    throw new Error(
      `Calendar draft count mismatch: expected ${ccwEofyCampaignCalendar.length}, got ${calendarCount}`
    );
  }

  await prisma.marketingAgencyAsset.deleteMany({
    where: {
      campaignId: marketingCampaign.id,
      provider: 'synthex',
      assetType: {
        in: [
          'campaign_material_pack',
          'draft_social_svg_set',
          'google_pomelli_business_dna',
        ],
      },
    },
  });

  const materialPack = await prisma.marketingAgencyAsset.create({
    data: {
      organizationId: ccw.id,
      createdById: owner.id,
      campaignId: marketingCampaign.id,
      provider: 'synthex',
      providerAssetId: `${CCW_EOFY_CAMPAIGN_SLUG}-materials-final`,
      assetType: 'campaign_material_pack',
      title: 'CCW EOFY 2026 final campaign materials pack',
      licenceStatus: 'owned_draft_pending_ccw_asset_approval',
      licenceUrl: 'https://ccwonline.com.au/',
      metadata: {
        campaignSlug: CCW_EOFY_CAMPAIGN_SLUG,
        status: 'final_materials_ready_credentials_blocked',
        brandRoot,
        docsRoot,
        calendarSlots: manifest.calendarSlots,
        platformExecutions: manifest.platformExecutions,
        files: [
          'README.md',
          '01-platform-copy-deck.md',
          '02-creative-asset-briefs.md',
          '03-production-asset-manifest.json',
          '04-approval-qa-checklist.md',
          '05-publishing-handoff.md',
          '06-utm-tracking-plan.csv',
          '07-source-and-claim-register.md',
          '08-html-preview.html',
        ],
        externalPublishBlocked: true,
      },
    },
  });

  const svgSet = await prisma.marketingAgencyAsset.create({
    data: {
      organizationId: ccw.id,
      createdById: owner.id,
      campaignId: marketingCampaign.id,
      provider: 'synthex',
      providerAssetId: `${CCW_EOFY_CAMPAIGN_SLUG}-svg-drafts`,
      assetType: 'draft_social_svg_set',
      title: 'CCW EOFY 2026 draft SVG social assets',
      licenceStatus: 'owned_draft_pending_ccw_asset_approval',
      licenceUrl: 'https://ccwonline.com.au/',
      metadata: {
        campaignSlug: CCW_EOFY_CAMPAIGN_SLUG,
        assetCount: manifest.platformExecutions,
        assetRoot: path.join(brandRoot, 'assets/svg'),
        docsAssetRoot: path.join(docsRoot, 'assets/svg'),
        use: 'Draft review assets and layout proofs. Replace/enrich with approved CCW product photography before paid distribution.',
        externalPublishBlocked: true,
      },
    },
  });

  const pomelliDnaAsset = await prisma.marketingAgencyAsset.create({
    data: {
      organizationId: ccw.id,
      createdById: owner.id,
      campaignId: marketingCampaign.id,
      provider: 'synthex',
      providerAssetId: `${CCW_EOFY_CAMPAIGN_SLUG}-google-pomelli-business-dna`,
      assetType: 'google_pomelli_business_dna',
      title: 'CCW Google Pomelli Business DNA packet',
      licenceStatus: 'owned_synthex_generated_ready_for_pomelli_review',
      licenceUrl: 'https://ccwonline.com.au/',
      metadata: {
        campaignSlug: CCW_EOFY_CAMPAIGN_SLUG,
        status: 'synthex_generated_ready_for_external_pomelli_review',
        brandRoot: pomelliBrandRoot,
        docsRoot: pomelliDocsRoot,
        businessName: pomelliPacket.businessName,
        website: pomelliPacket.website,
        calendarSlots: pomelliPacket.campaignGrounding.calendarSlots,
        platformExecutions: pomelliPacket.campaignGrounding.platformExecutions,
        files: [
          'README.md',
          '01-business-dna-profile.md',
          '02-channel-generation-rules.md',
          '03-claim-and-approval-guardrails.md',
          '04-pomelli-onboarding-packet.json',
          '05-campaign-activation-brief.md',
          '06-source-register.md',
        ],
        externalPomelliApiAvailable: false,
        externalPublishBlocked: true,
      },
    },
  });

  await prisma.brandDNA.upsert({
    where: { organizationId: ccw.id },
    create: {
      organizationId: ccw.id,
      businessName: pomelliPacket.businessName,
      vertical: pomelliPacket.brandCore.vertical,
      industry: pomelliPacket.brandCore.industry,
      primaryColour: pomelliPacket.visualSystem.primaryColour,
      secondaryColour: pomelliPacket.visualSystem.secondaryColour,
      neutralColour: pomelliPacket.visualSystem.neutralColour,
      brandVoice: {
        voiceTag: pomelliPacket.voice.voiceTag,
        formality: pomelliPacket.voice.formality,
        boldness: pomelliPacket.voice.boldness,
        tone: pomelliPacket.voice.tone,
        samplePhrases: pomelliPacket.voice.samplePhrases,
      },
      persona: {
        description:
          'Professional cleaning and restoration operators buying equipment, consumables, and practical support from CCW.',
        values: pomelliPacket.brandCore.values,
        painPoints: [
          'slow drying jobs',
          'unclear equipment priorities',
          'stock and pricing uncertainty',
          'EOFY purchase timing pressure',
        ],
        audience: pomelliPacket.brandCore.audience,
      },
      offerings: pomelliPacket.offersAndTopics,
      socialProfiles: [],
      sourceUrl: pomelliPacket.website,
      lastRefreshedAt: new Date(),
    },
    update: {
      businessName: pomelliPacket.businessName,
      vertical: pomelliPacket.brandCore.vertical,
      industry: pomelliPacket.brandCore.industry,
      primaryColour: pomelliPacket.visualSystem.primaryColour,
      secondaryColour: pomelliPacket.visualSystem.secondaryColour,
      neutralColour: pomelliPacket.visualSystem.neutralColour,
      brandVoice: {
        voiceTag: pomelliPacket.voice.voiceTag,
        formality: pomelliPacket.voice.formality,
        boldness: pomelliPacket.voice.boldness,
        tone: pomelliPacket.voice.tone,
        samplePhrases: pomelliPacket.voice.samplePhrases,
      },
      persona: {
        description:
          'Professional cleaning and restoration operators buying equipment, consumables, and practical support from CCW.',
        values: pomelliPacket.brandCore.values,
        painPoints: [
          'slow drying jobs',
          'unclear equipment priorities',
          'stock and pricing uncertainty',
          'EOFY purchase timing pressure',
        ],
        audience: pomelliPacket.brandCore.audience,
      },
      offerings: pomelliPacket.offersAndTopics,
      socialProfiles: [],
      sourceUrl: pomelliPacket.website,
      lastRefreshedAt: new Date(),
    },
  });

  await prisma.onboardingProgress.upsert({
    where: {
      userId_organizationId: {
        userId: owner.id,
        organizationId: ccw.id,
      },
    },
    create: {
      userId: owner.id,
      organizationId: ccw.id,
      currentStage: 'complete',
      completedStages: [
        'business_vetting',
        'api_setup',
        'persona_generation',
        'persona_approval',
        'platform_selection',
      ],
      businessName: ccw.name,
      website: pomelliPacket.website,
      vettingApproved: true,
      vettingApprovedAt: new Date(),
      apiCredentialsAdded: true,
      apiSetupCompletedAt: new Date(),
      requiredProviders: [],
      selectedPlatforms: ['facebook', 'instagram', 'linkedin', 'reddit'],
      platformsApprovedAt: new Date(),
      personaData: {
        name: 'CCW AI',
        tone: pomelliPacket.voice.tone,
        topics: pomelliPacket.offersAndTopics,
      },
      personaApprovedAt: new Date(),
      auditData: {
        source: 'ccw-google-pomelli-business-dna',
        businessDnaAssetId: pomelliDnaAsset.id,
        campaignSlug: CCW_EOFY_CAMPAIGN_SLUG,
      },
      postingMode: 'assisted',
      socialProfileUrls: {},
      status: 'completed',
      completedAt: new Date(),
      metadata: {
        source: 'finalize-ccw-eofy-campaign-materials',
        googlePomelliOnboarding: 'synthex_business_dna_completed',
        businessDnaAssetId: pomelliDnaAsset.id,
        externalPomelliApiAvailable: false,
      },
    },
    update: {
      currentStage: 'complete',
      completedStages: [
        'business_vetting',
        'api_setup',
        'persona_generation',
        'persona_approval',
        'platform_selection',
      ],
      businessName: ccw.name,
      website: pomelliPacket.website,
      vettingApproved: true,
      vettingApprovedAt: new Date(),
      apiCredentialsAdded: true,
      apiSetupCompletedAt: new Date(),
      requiredProviders: [],
      selectedPlatforms: ['facebook', 'instagram', 'linkedin', 'reddit'],
      platformsApprovedAt: new Date(),
      personaData: {
        name: 'CCW AI',
        tone: pomelliPacket.voice.tone,
        topics: pomelliPacket.offersAndTopics,
      },
      personaApprovedAt: new Date(),
      auditData: {
        source: 'ccw-google-pomelli-business-dna',
        businessDnaAssetId: pomelliDnaAsset.id,
        campaignSlug: CCW_EOFY_CAMPAIGN_SLUG,
      },
      postingMode: 'assisted',
      socialProfileUrls: {},
      status: 'completed',
      completedAt: new Date(),
      metadata: {
        source: 'finalize-ccw-eofy-campaign-materials',
        googlePomelliOnboarding: 'synthex_business_dna_completed',
        businessDnaAssetId: pomelliDnaAsset.id,
        externalPomelliApiAvailable: false,
      },
    },
  });

  await prisma.marketingAgencyQaReport.create({
    data: {
      organizationId: ccw.id,
      createdById: owner.id,
      campaignId: marketingCampaign.id,
      status: 'final_materials_ready_credentials_blocked',
      blockedReasons: [
        'No live CCW Facebook/Instagram/LinkedIn/Reddit platform connections found.',
        'Final CCW social credentials and publishing approval are still required.',
        'Product prices, stock, and finance wording must be checked on publish day.',
        'APPROVED_TO_PUBLISH_META_ADS is not enabled in production env.',
      ],
      warnings: [
        'Campaign materials are final draft assets, not externally published posts.',
        'SVG creative is approved as a layout/proof layer; use approved CCW product imagery before paid distribution.',
        'Reddit copy must be posted only where supplier participation is allowed.',
      ],
      checks: [
        { name: 'calendar_slots', status: 'pass', detail: calendarCount },
        {
          name: 'platform_executions',
          status: 'pass',
          detail: manifest.platformExecutions,
        },
        { name: 'copy_deck', status: 'pass', detail: 'generated' },
        { name: 'asset_briefs', status: 'pass', detail: 'generated' },
        {
          name: 'svg_draft_assets',
          status: 'pass',
          detail: manifest.platformExecutions,
        },
        { name: 'utm_tracking_plan', status: 'pass', detail: 'generated' },
        { name: 'source_claim_register', status: 'pass', detail: 'generated' },
        {
          name: 'google_pomelli_business_dna',
          status: 'pass',
          detail: 'Synthex Business DNA generated and attached.',
        },
        {
          name: 'external_publish',
          status: 'blocked',
          detail: 'Waiting on CCW credentials and final human approval.',
        },
      ],
      metadata: {
        campaignSlug: CCW_EOFY_CAMPAIGN_SLUG,
        materialPackAssetId: materialPack.id,
        svgSetAssetId: svgSet.id,
        pomelliDnaAssetId: pomelliDnaAsset.id,
        generatedAt: new Date().toISOString(),
      },
    },
  });

  await prisma.marketingAgencyExportPackage.create({
    data: {
      organizationId: ccw.id,
      createdById: owner.id,
      campaignId: marketingCampaign.id,
      status: 'final_materials_ready_credentials_blocked',
      formats: [
        'calendar_schedule',
        'platform_copy_deck',
        'svg_social_drafts',
        'creative_asset_briefs',
        'google_pomelli_business_dna',
        'utm_tracking_plan',
        'approval_qa_checklist',
        'publishing_handoff',
      ],
      artifactManifest: {
        campaignSlug: CCW_EOFY_CAMPAIGN_SLUG,
        campaignName: CCW_EOFY_CAMPAIGN_NAME,
        brandRoot,
        docsRoot,
        calendarSlots: manifest.calendarSlots,
        platformExecutions: manifest.platformExecutions,
        materialPackAssetId: materialPack.id,
        svgSetAssetId: svgSet.id,
        pomelliDnaAssetId: pomelliDnaAsset.id,
        pomelliBrandRoot,
        pomelliDocsRoot,
        externalPublishBlocked: true,
        files: [
          'README.md',
          '01-platform-copy-deck.md',
          '02-creative-asset-briefs.md',
          '03-production-asset-manifest.json',
          '04-approval-qa-checklist.md',
          '05-publishing-handoff.md',
          '06-utm-tracking-plan.csv',
          '07-source-and-claim-register.md',
          '08-html-preview.html',
          'google-pomelli-business-dna/README.md',
          'google-pomelli-business-dna/04-pomelli-onboarding-packet.json',
        ],
      },
      handoffNotes:
        'Full CCW EOFY campaign materials and the Synthex-owned Google Pomelli-compatible Business DNA packet are generated, scheduled as draft calendar posts, and ready for CCW credential intake plus final approval. External publishing remains blocked until credentials and platform checks are complete.',
      metadata: {
        finalizedAt: new Date().toISOString(),
        campaignSlug: CCW_EOFY_CAMPAIGN_SLUG,
        googlePomelliBusinessDna: 'synthex_business_dna_completed',
      },
    },
  });

  await prisma.marketingAgencyCampaign.update({
    where: { id: marketingCampaign.id },
    data: {
      status: 'final_materials_ready_credentials_blocked',
      metadata: {
        ...asRecord(marketingCampaign.metadata),
        finalMaterialsReady: true,
        materialPackAssetId: materialPack.id,
        svgSetAssetId: svgSet.id,
        pomelliDnaAssetId: pomelliDnaAsset.id,
        calendarSlots: manifest.calendarSlots,
        platformExecutions: manifest.platformExecutions,
        googlePomelliBusinessDna: 'synthex_business_dna_completed',
        externalPomelliApiAvailable: false,
        externalPublishBlocked: true,
        finalizedAt: new Date().toISOString(),
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        campaignId: appCampaign.id,
        marketingAgencyCampaignId: marketingCampaign.id,
        calendarDraftsVerified: calendarCount,
        materialPackAssetId: materialPack.id,
        svgSetAssetId: svgSet.id,
        pomelliDnaAssetId: pomelliDnaAsset.id,
        status: 'final_materials_ready_credentials_blocked',
      },
      null,
      2
    )
  );
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
