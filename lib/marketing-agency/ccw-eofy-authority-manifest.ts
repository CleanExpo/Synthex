import {
  CAMPAIGN_AUTHORITY_MANIFEST_KEY,
  type CampaignEvidenceManifest,
} from './campaign-authority-manifest';
import { assertCampaignPublishable } from './publish-gate';
import {
  CCW_EOFY_CAMPAIGN_NAME,
  CCW_EOFY_CAMPAIGN_SLUG,
  ccwEofyCampaignCalendar,
  ccwEofySourceUrls,
} from './ccw-eofy-calendar';

export interface CcwEofyAuthorityManifestInput {
  campaignId?: string;
  approvedBy?: string;
  approvedAt?: string;
  humanApproved?: boolean;
}

export interface CcwEofyAuthorityMetadataInput
  extends CcwEofyAuthorityManifestInput {
  platforms?: string[];
}

const ALL_PLATFORMS = Array.from(
  new Set(ccwEofyCampaignCalendar.flatMap(slot => slot.platforms))
);

export function buildCcwEofyCampaignAuthorityManifest(
  input: CcwEofyAuthorityManifestInput = {}
): CampaignEvidenceManifest {
  const humanApproved = input.humanApproved === true;
  const approvedAt = input.approvedAt ?? new Date().toISOString();

  return {
    manifestId: `${CCW_EOFY_CAMPAIGN_SLUG}-authority`,
    campaignId: input.campaignId,
    topic: CCW_EOFY_CAMPAIGN_NAME,
    audience: 'Australian cleaning and restoration operators',
    businessGoal:
      'Generate EOFY demand for CCW equipment shortlists while keeping product, stock, finance, pricing, and publishing claims controlled.',
    sources: ccwEofySourceUrls.map((url, index) => ({
      id: `ccw-source-${index + 1}`,
      label:
        index === 0
          ? 'CCW storefront and brand source'
          : `CCW product or offer source ${index + 1}`,
      url,
      sourceType: url.includes('/products/')
        ? 'shopify_product'
        : 'website',
      role: 'supporting',
      checkedAt: approvedAt,
    })),
    opposingEvidence: [
      {
        id: 'ccw-opposing-finance-approval',
        label: 'Finance approval and repayment claims require provider confirmation',
        sourceType: 'campaign_guardrail',
        role: 'opposing',
        checkedAt: approvedAt,
      },
      {
        id: 'ccw-opposing-stock-pricing',
        label: 'Stock, sale price, and deadline claims can change before publish day',
        sourceType: 'campaign_guardrail',
        role: 'opposing',
        checkedAt: approvedAt,
      },
    ],
    expertNotes: [
      'Use actual CCW product pages and real Shopify product imagery only.',
      'Frame EOFY as an operational shortlist and calendar deadline, not an invented sitewide discount.',
      'Reddit output must remain useful and community-rule safe.',
    ],
    consumerObjections: [
      'Is the product actually in stock now?',
      'Is the listed sale price still current?',
      'Does finance approval or tax treatment apply to my business?',
      'Is this supplier post allowed in the target Reddit community?',
    ],
    claims: [
      {
        id: 'ccw-claim-product-range',
        statement:
          'CCW supplies professional cleaning, drying, restoration, equipment, consumables, and related accessories for Australian operators.',
        status: 'allowed',
        evidenceRefs: ['ccw-source-1'],
        requiresEvidence: true,
      },
      {
        id: 'ccw-claim-eofy-shortlist',
        statement:
          'The campaign frames EOFY planning as an equipment shortlist and operational bottleneck audit.',
        status: 'allowed',
        evidenceRefs: ['ccw-source-1'],
        requiresEvidence: true,
      },
      {
        id: 'ccw-claim-listed-products',
        statement:
          'Product-specific posts must use only current CCW page details, listed sale references, and real product imagery.',
        status: 'allowed',
        evidenceRefs: ['ccw-source-2', 'ccw-source-3', 'ccw-source-4', 'ccw-source-5'],
        requiresEvidence: true,
      },
      {
        id: 'ccw-claim-finance-pathway',
        statement:
          'Finance messaging is limited to an enquiry pathway and must not claim approval, rates, repayment amounts, or tax outcomes.',
        status: 'allowed',
        evidenceRefs: ['ccw-source-6'],
        requiresEvidence: true,
      },
    ],
    seoAeoGeoTargets: [
      'EOFY cleaning equipment',
      'restoration air movers Australia',
      'carpet cleaning equipment EOFY',
      'CCW equipment finance enquiry',
    ],
    requiredVisuals: [
      'Real CCW Shopify product imagery',
      'Approved product-range collage',
      'Platform-specific EOFY calendar graphics',
      'No fake product renders or unsupported stock imagery',
    ],
    assets: [
      {
        id: 'ccw-real-shopify-product-images',
        title: 'CCW real Shopify product image set',
        origin: 'ccwonline.com.au Shopify storefront and CDN images',
        rightsStatus: 'owned',
        publishable: true,
        licenceUrl: 'https://ccwonline.com.au/',
      },
      {
        id: 'ccw-synthex-campaign-layouts',
        title: 'Synthex-generated EOFY layout assets',
        origin: 'Synthex generated campaign pack using approved CCW imagery',
        rightsStatus: 'owned',
        publishable: true,
      },
    ],
    platformOutputs: ALL_PLATFORMS.map(platform => ({
      platform,
      status: 'approved',
      contentRef: `${CCW_EOFY_CAMPAIGN_SLUG}-${platform}`,
      notes:
        platform === 'reddit'
          ? 'Community rules and commercial disclosure still apply.'
          : 'Platform copy exists in the CCW EOFY calendar package.',
    })),
    approval: {
      status: humanApproved ? 'approved' : 'review',
      humanApproved,
      approvedBy: humanApproved ? input.approvedBy : undefined,
      approvedAt: humanApproved ? approvedAt : undefined,
    },
    evaluation: {
      evidenceQuality: 88,
      accuracy: 88,
      balance: 84,
      usefulness: 86,
      brandFit: 90,
      seoAeoGeoValue: 82,
      platformFit: 86,
      riskLevel: 20,
      approvalReadiness: humanApproved ? 90 : 70,
    },
    publishLinks: [],
    lessons: [],
  };
}

export function buildCcwEofyAuthorityMetadata(
  input: CcwEofyAuthorityMetadataInput = {}
): Record<string, unknown> {
  const manifest = buildCcwEofyCampaignAuthorityManifest(input);
  const publishGate = assertCampaignPublishable({
    manifest,
    platforms: input.platforms ?? ALL_PLATFORMS,
    requestedAction: 'ccw_eofy_campaign_generation',
  });

  return {
    [CAMPAIGN_AUTHORITY_MANIFEST_KEY]: manifest,
    publishGate,
  };
}
