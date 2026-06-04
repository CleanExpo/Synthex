import { createClient } from '@supabase/supabase-js';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import prisma from '../lib/prisma';
import { buildCcwEofyAuthorityMetadata } from '../lib/marketing-agency/ccw-eofy-authority-manifest';

const CAMPAIGN_SLUG = 'ccw-eofy-sales-2026';
const CAMPAIGN_NAME = 'CCW EOFY Sales Acceleration 2026';
const TMP_CREDS_PATH =
  '/private/tmp/synthex-ccw-live-uat-login-2026-06-02.json';

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

const ccwSources = [
  {
    label: 'CCW Online homepage',
    url: 'https://ccwonline.com.au/',
    sourceType: 'website',
    requiredForClaims: true,
    metadata: {
      notes:
        'Primary storefront and brand source for CCW equipment, consumables, and support positioning.',
    },
  },
  {
    label: 'CCW Online carpet cleaning machines',
    url: 'https://ccwonline.com.au/product-category/carpet-cleaning-machines/',
    sourceType: 'website',
    requiredForClaims: true,
    metadata: {
      notes:
        'Category source for professional extraction and carpet cleaning machine offer framing.',
    },
  },
  {
    label: 'CCW Online air movers and drying',
    url: 'https://ccwonline.com.au/product-category/air-movers-dryers/',
    sourceType: 'website',
    requiredForClaims: true,
    metadata: {
      notes:
        'Category source for drying/restoration equipment and listed sale-price references.',
    },
  },
  {
    label: 'CCW Online finance page',
    url: 'https://ccwonline.com.au/finance/',
    sourceType: 'website',
    requiredForClaims: true,
    metadata: {
      notes:
        'Source for financing CTA; final finance wording remains subject to CCW approval.',
    },
  },
];

const claims = [
  {
    statement:
      'CCW supplies professional carpet cleaning, restoration, drying, and moisture-detection equipment for Australian cleaning and restoration operators.',
    claimType: 'business_positioning',
    evidenceStatus: 'verified',
    evidenceNotes:
      'Supported by CCW website category and homepage positioning.',
  },
  {
    statement:
      'The EOFY push should frame selected listed sale products as an equipment upgrade shortlist, not as an invented sitewide EOFY discount.',
    claimType: 'campaign_guardrail',
    evidenceStatus: 'verified',
    evidenceNotes:
      'Production campaign uses current listed sale/product pages and requires CCW confirmation before any unlisted discount or deadline claim.',
  },
  {
    statement:
      'Facebook, Instagram, LinkedIn, and Reddit publishing are blocked until CCW provides social account credentials through the secure intake flow.',
    claimType: 'publishing_gate',
    evidenceStatus: 'verified',
    evidenceNotes:
      'Production readiness check found no CCW platform_connections for social providers and no Meta publish approval env flag.',
  },
];

const platformDrafts = [
  {
    platform: 'facebook',
    title: 'Facebook primary post',
    content:
      'EOFY is the practical time to tighten up the gear that makes every job smoother. CCW has professional carpet cleaning, restoration, drying, and moisture-detection equipment ready for Australian operators who need reliable kit without the runaround.\n\nUse this week to shortlist the machines, air movers, meters, hoses, chemicals, and accessories your team actually needs before the June rush gets louder.\n\nStart with the current CCW range, confirm stock and pricing, then speak with the team if finance or a package quote would help get the upgrade moving.\n\nCTA: Build your EOFY equipment shortlist with CCW.',
    hashtags: ['#EOFY', '#CarpetCleaning', '#RestorationEquipment', '#CCW'],
  },
  {
    platform: 'instagram',
    title: 'Instagram/Reels caption',
    content:
      'EOFY gear check: machines, dryers, meters, chemicals, hoses, and the job-site essentials that stop small problems becoming slow jobs.\n\nCCW is ready for Australian cleaning and restoration operators building a smarter equipment setup for the new financial year.\n\nSave this, check the current range, and get the upgrade list moving before June disappears.\n\nCTA: Tap through to build the CCW EOFY shortlist.',
    hashtags: ['#EOFY', '#CarpetCleaningBusiness', '#Restoration', '#CleaningEquipment'],
  },
  {
    platform: 'linkedin',
    title: 'LinkedIn post',
    content:
      'EOFY planning is not only a finance task. For cleaning and restoration operators, it is also the moment to remove weak points in the equipment stack.\n\nCCW supports Australian operators with professional carpet cleaning machines, restoration and drying equipment, moisture-detection tools, chemicals, hoses, accessories, and support from a specialist supplier.\n\nThe strongest campaign angle is practical: audit the gear that slows jobs down, shortlist the upgrades that improve turnaround, confirm stock and pricing, then move before the end-of-financial-year window closes.\n\nCTA: Review the CCW EOFY equipment shortlist and speak with the team about the right setup.',
    hashtags: ['#EOFYPlanning', '#CleaningIndustry', '#RestorationIndustry', '#Equipment'],
  },
  {
    platform: 'reddit',
    title: 'Reddit community-safe draft',
    content:
      'For operators doing EOFY planning: this is a good time to audit the equipment that slows jobs down before buying anything new.\n\nUseful checklist:\n- extraction machines and recovery performance\n- air movers and drying coverage\n- moisture meters and inspection gear\n- hoses, wands, sprayers, and consumables\n- backup items that prevent job delays\n\nCCW has a professional range for Australian carpet cleaning and restoration operators. If you are building an EOFY shortlist, start with the current product range, verify stock/pricing, and only buy what removes a real operational bottleneck.\n\nNote: keep this educational in trade communities; do not post as a hard-sell ad unless the community rules explicitly allow it.',
    hashtags: ['EOFY', 'carpetcleaning', 'restoration'],
  },
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function randomPassword(): string {
  return `CCW-UAT-${crypto.randomBytes(12).toString('base64url')}!9a`;
}

async function ensureTempUatUser(organizationId: string) {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = `synthex-ccw-uat-${Date.now()}@synthex.social`;
  const password = randomPassword();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name: 'Synthex CCW Live UAT',
      purpose: 'ccw-eofy-live-campaign-verification',
    },
  });
  if (error || !data.user) {
    throw new Error(`Supabase UAT user create failed: ${error?.message}`);
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: 'Synthex CCW Live UAT',
      authProvider: 'email',
      emailVerified: true,
      organizationId,
      activeOrganizationId: organizationId,
      onboardingComplete: true,
      businessProfileComplete: true,
      apiKeyConfigured: true,
      apiKeyValid: true,
      isMultiBusinessOwner: true,
    },
    create: {
      id: data.user.id,
      email,
      name: 'Synthex CCW Live UAT',
      authProvider: 'email',
      emailVerified: true,
      organizationId,
      activeOrganizationId: organizationId,
      onboardingComplete: true,
      businessProfileComplete: true,
      apiKeyConfigured: true,
      apiKeyValid: true,
      isMultiBusinessOwner: true,
      preferences: {
        purpose: 'ccw-eofy-live-campaign-verification',
        temporary: true,
      },
    },
  });

  await prisma.businessOwnership.upsert({
    where: {
      ownerId_organizationId: {
        ownerId: user.id,
        organizationId,
      },
    },
    update: {
      isActive: true,
      billingStatus: 'active',
      displayName: 'CCW',
    },
    create: {
      ownerId: user.id,
      organizationId,
      displayName: 'CCW',
      isActive: true,
      billingStatus: 'active',
      monthlyRate: 0,
    },
  });

  const payload = {
    email,
    password,
    userId: user.id,
    organizationId,
    createdAt: new Date().toISOString(),
    cleanupCommand:
      'npx dotenv -e .env.local -- npx tsx scripts/create-ccw-eofy-live-campaign.ts --cleanup-uat',
  };
  fs.writeFileSync(TMP_CREDS_PATH, JSON.stringify(payload, null, 2), {
    mode: 0o600,
  });
  fs.chmodSync(TMP_CREDS_PATH, 0o600);

  return { email, userId: user.id, path: TMP_CREDS_PATH };
}

async function cleanupTempUatUsers() {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const users = await prisma.user.findMany({
    where: { email: { startsWith: 'synthex-ccw-uat-' } },
    select: { id: true, email: true },
  });

  for (const user of users) {
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.businessOwnership.deleteMany({ where: { ownerId: user.id } });
    await prisma.auditLog.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await supabase.auth.admin.deleteUser(user.id).catch(() => null);
  }

  if (fs.existsSync(TMP_CREDS_PATH)) fs.unlinkSync(TMP_CREDS_PATH);
  return users.length;
}

async function upsertLiveCampaign() {
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

  const socialConnections = await prisma.platformConnection.findMany({
    where: {
      organizationId: ccw.id,
      deletedAt: null,
      isActive: true,
      platform: { in: ['facebook', 'instagram', 'linkedin', 'reddit'] },
    },
    select: { platform: true },
  });
  const connectedPlatforms = socialConnections.map(c => c.platform);
  const marketingAuthorityMetadata = buildCcwEofyAuthorityMetadata();

  const marketingCampaign = await prisma.marketingAgencyCampaign.upsert({
    where: {
      organizationId_slug: {
        organizationId: ccw.id,
        slug: CAMPAIGN_SLUG,
      },
    },
    update: {
      name: CAMPAIGN_NAME,
      status: 'ready_for_social_credentials',
      providerMode: 'live',
      productName: 'Professional cleaning and restoration equipment',
      primaryOffer:
        'EOFY equipment-upgrade shortlist using CCW current product range, selected listed sale items, and finance enquiry CTA.',
      boardMemo: {
        objective:
          'Generate CCW EOFY sales demand today without inventing unapproved discounts or publishing before credentials are supplied.',
        audience:
          'Australian carpet cleaning and restoration operators who need extraction, drying, moisture, chemical, hose, and accessory upgrades before 30 June.',
        channels: ['facebook', 'instagram', 'linkedin', 'reddit'],
        offerGuardrail:
          'Use current CCW range and listed sale pricing only. Any additional EOFY discount, bundle, deadline, or finance claim needs CCW approval.',
        publishingGate:
          'External publishing remains blocked until CCW provides social credentials and server-side approval flags are enabled.',
      },
      metadata: {
        liveCampaign: true,
        createdFor: 'ccw-eofy-sales-today',
        connectedPlatforms,
        missingPlatforms: ['facebook', 'instagram', 'linkedin', 'reddit'].filter(
          p => !connectedPlatforms.includes(p)
        ),
        secureCredentialIntake:
          '/private/tmp/synthex-ccw-credential-intake-link-2026-06-02.txt',
        ...marketingAuthorityMetadata,
        generatedAt: new Date().toISOString(),
      },
    },
    create: {
      organizationId: ccw.id,
      createdById: owner.id,
      name: CAMPAIGN_NAME,
      slug: CAMPAIGN_SLUG,
      status: 'ready_for_social_credentials',
      providerMode: 'live',
      productName: 'Professional cleaning and restoration equipment',
      primaryOffer:
        'EOFY equipment-upgrade shortlist using CCW current product range, selected listed sale items, and finance enquiry CTA.',
      boardMemo: {
        objective:
          'Generate CCW EOFY sales demand today without inventing unapproved discounts or publishing before credentials are supplied.',
        audience:
          'Australian carpet cleaning and restoration operators who need extraction, drying, moisture, chemical, hose, and accessory upgrades before 30 June.',
        channels: ['facebook', 'instagram', 'linkedin', 'reddit'],
        offerGuardrail:
          'Use current CCW range and listed sale pricing only. Any additional EOFY discount, bundle, deadline, or finance claim needs CCW approval.',
        publishingGate:
          'External publishing remains blocked until CCW provides social credentials and server-side approval flags are enabled.',
      },
      metadata: {
        liveCampaign: true,
        createdFor: 'ccw-eofy-sales-today',
        connectedPlatforms,
        missingPlatforms: ['facebook', 'instagram', 'linkedin', 'reddit'].filter(
          p => !connectedPlatforms.includes(p)
        ),
        secureCredentialIntake:
          '/private/tmp/synthex-ccw-credential-intake-link-2026-06-02.txt',
        ...marketingAuthorityMetadata,
        generatedAt: new Date().toISOString(),
      },
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

  const sourceRefs = [];
  for (const source of ccwSources) {
    sourceRefs.push(
      await prisma.marketingAgencySourceRef.create({
        data: {
          organizationId: ccw.id,
          createdById: owner.id,
          campaignId: marketingCampaign.id,
          ...source,
        },
      })
    );
  }

  for (const claim of claims) {
    await prisma.marketingAgencyClaim.create({
      data: {
        organizationId: ccw.id,
        createdById: owner.id,
        campaignId: marketingCampaign.id,
        sourceRefId: sourceRefs[0]?.id,
        ...claim,
      },
    });
  }

  await prisma.marketingAgencyAsset.create({
    data: {
      organizationId: ccw.id,
      createdById: owner.id,
      campaignId: marketingCampaign.id,
      provider: 'ccwonline',
      assetType: 'source_reference_pack',
      title: 'CCW EOFY source and offer reference pack',
      licenceStatus: 'owned_or_public_product_reference',
      licenceUrl: 'https://ccwonline.com.au/',
      metadata: {
        sources: ccwSources.map(s => s.url),
        usage:
          'Use as source references for copy and campaign handoff. Final product imagery must be approved by CCW before paid distribution.',
      },
    },
  });

  await prisma.marketingAgencyQaReport.create({
    data: {
      organizationId: ccw.id,
      createdById: owner.id,
      campaignId: marketingCampaign.id,
      status: 'ready_for_review_credentials_blocked',
      blockedReasons: [
        'No live CCW Facebook/Instagram/LinkedIn/Reddit platform connections found.',
        'APPROVED_TO_PUBLISH_META_ADS is not enabled in production env.',
        'Any unlisted EOFY discount, bundle, expiry, or finance claim requires CCW approval.',
      ],
      warnings: [
        'Campaign drafts are ready for review and credential intake, not external publication.',
        'Reddit draft must be posted only where community rules allow commercial supplier content.',
      ],
      checks: [
        { name: 'production_org', status: 'pass', detail: ccw.id },
        { name: 'provider_mode', status: 'pass', detail: 'live' },
        { name: 'source_refs', status: 'pass', detail: ccwSources.length },
        { name: 'platform_drafts', status: 'pass', detail: platformDrafts.length },
        {
          name: 'external_publish',
          status: 'blocked',
          detail: 'Waiting on secure credential intake and server-side approval gates.',
        },
      ],
      metadata: {
        ...marketingAuthorityMetadata,
        generatedAt: new Date().toISOString(),
      },
    },
  });

  await prisma.marketingAgencyExportPackage.create({
    data: {
      organizationId: ccw.id,
      createdById: owner.id,
      campaignId: marketingCampaign.id,
      status: 'ready_for_handoff_credentials_blocked',
      formats: ['facebook_feed', 'instagram_caption', 'linkedin_post', 'reddit_text'],
      artifactManifest: {
        campaignSlug: CAMPAIGN_SLUG,
        campaignName: CAMPAIGN_NAME,
        platforms: platformDrafts.map(d => d.platform),
        sourceRefs: ccwSources,
        drafts: platformDrafts,
        publishingGate:
          'Do not publish until CCW credentials are submitted and verified.',
        ...marketingAuthorityMetadata,
      },
      handoffNotes:
        'Live production CCW EOFY campaign package is staged. Social posting credentials are the only current execution blocker for external channels.',
      metadata: {
        ...marketingAuthorityMetadata,
        generatedAt: new Date().toISOString(),
      },
    },
  });

  let appCampaign = await prisma.campaign.findFirst({
    where: {
      organizationId: ccw.id,
      platform: 'multi',
      name: CAMPAIGN_NAME,
      deletedAt: null,
    },
  });
  if (!appCampaign) {
    appCampaign = await prisma.campaign.create({
      data: {
        organizationId: ccw.id,
        userId: owner.id,
        name: CAMPAIGN_NAME,
        description:
          'Live CCW EOFY sales campaign staged for Facebook, Instagram, LinkedIn, and Reddit. Publishing awaits secure social credential intake.',
        platform: 'multi',
        status: 'active',
        content: {
          campaignSlug: CAMPAIGN_SLUG,
          providerMode: 'live',
          drafts: platformDrafts,
        },
        settings: {
          publishEnabled: false,
          adSpendEnabled: false,
          requiresCredentialIntake: true,
        },
      },
    });
  } else {
    appCampaign = await prisma.campaign.update({
      where: { id: appCampaign.id },
      data: {
        status: 'active',
        description:
          'Live CCW EOFY sales campaign staged for Facebook, Instagram, LinkedIn, and Reddit. Publishing awaits secure social credential intake.',
        content: {
          campaignSlug: CAMPAIGN_SLUG,
          providerMode: 'live',
          drafts: platformDrafts,
        },
        settings: {
          publishEnabled: false,
          adSpendEnabled: false,
          requiresCredentialIntake: true,
        },
      },
    });
  }

  const appCampaignAuthorityMetadata = buildCcwEofyAuthorityMetadata({
    campaignId: appCampaign.id,
  });
  appCampaign = await prisma.campaign.update({
    where: { id: appCampaign.id },
    data: {
      content: {
        ...asRecord(appCampaign.content),
        ...appCampaignAuthorityMetadata,
      },
      settings: {
        ...asRecord(appCampaign.settings),
        publishEnabled: false,
        adSpendEnabled: false,
        requiresCredentialIntake: true,
        ...appCampaignAuthorityMetadata,
      },
    },
  });

  await prisma.post.deleteMany({ where: { campaignId: appCampaign.id } });
  for (const draft of platformDrafts) {
    const draftAuthorityMetadata = buildCcwEofyAuthorityMetadata({
      campaignId: appCampaign.id,
      platforms: [draft.platform],
    });
    await prisma.post.create({
      data: {
        campaignId: appCampaign.id,
        platform: draft.platform,
        status: 'pending_approval',
        source: 'synthex-live-ccw-eofy',
        content: draft.content,
        metadata: {
          title: draft.title,
          hashtags: draft.hashtags,
          campaignSlug: CAMPAIGN_SLUG,
          providerMode: 'live',
          publishBlockedReason:
            'Awaiting CCW social credentials and final human approval.',
          ...draftAuthorityMetadata,
        },
      },
    });
  }

  await prisma.studioContentDraft.deleteMany({
    where: {
      organizationId: ccw.id,
      clientSlug: 'ccw',
      metadata: { path: ['campaignSlug'], equals: CAMPAIGN_SLUG },
    },
  });
  const studioDraft = await prisma.studioContentDraft.create({
    data: {
      organizationId: ccw.id,
      clientSlug: 'ccw',
      topic: 'CCW EOFY sales campaign handoff',
      script:
        'Live CCW EOFY campaign package is staged with Facebook, Instagram, LinkedIn, and Reddit drafts. The creative angle is an EOFY equipment-upgrade shortlist for Australian cleaning and restoration operators. Publishing remains blocked until CCW submits social credentials through secure intake and approves final offer wording.',
      platforms: ['facebook', 'instagram', 'linkedin', 'reddit'],
      videoProvider: 'live-copy-package',
      status: 'awaiting_approval',
      metadata: {
        campaignSlug: CAMPAIGN_SLUG,
        campaignId: appCampaign.id,
        marketingAgencyCampaignId: marketingCampaign.id,
        providerMode: 'live',
        externalPublishBlocked: true,
        ...appCampaignAuthorityMetadata,
      },
    },
  });

  const tempUser = await ensureTempUatUser(ccw.id);

  return {
    organizationId: ccw.id,
    ownerId: owner.id,
    campaignId: appCampaign.id,
    marketingAgencyCampaignId: marketingCampaign.id,
    studioDraftId: studioDraft.id,
    postDrafts: platformDrafts.length,
    providerMode: 'live',
    tempUat: {
      email: tempUser.email.replace(/^(.{2}).+(@.+)$/, '$1***$2'),
      userId: tempUser.userId,
      credentialsPath: tempUser.path,
    },
    socialConnections: connectedPlatforms,
    externalPublishingReady: false,
  };
}

async function main() {
  if (process.argv.includes('--cleanup-uat')) {
    const deleted = await cleanupTempUatUsers();
    console.log(JSON.stringify({ cleanedUpTempUsers: deleted }, null, 2));
    return;
  }

  const result = await upsertLiveCampaign();
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
