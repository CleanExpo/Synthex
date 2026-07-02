import type { CampaignEvidenceManifest } from '@/lib/marketing-agency/campaign-authority-manifest';

export function buildApprovedCampaignAuthorityManifest(
  overrides: Partial<CampaignEvidenceManifest> = {}
): CampaignEvidenceManifest {
  return {
    manifestId: 'manifest-test-1',
    campaignId: 'campaign-test-1',
    topic: 'EOFY equipment campaign',
    audience: 'Australian cleaning and restoration operators',
    businessGoal: 'Generate approved EOFY campaign demand',
    sources: [
      {
        id: 'src-ccw-product',
        label: 'CCW product source',
        url: 'https://ccwonline.com.au/products/test',
        sourceType: 'shopify_product',
        role: 'supporting',
        checkedAt: '2026-06-04T00:00:00.000Z',
      },
    ],
    expertNotes: ['Use operational claims only.'],
    consumerObjections: ['Needs stock, pricing, and delivery confirmation.'],
    claims: [
      {
        id: 'claim-product-range',
        statement: 'CCW supplies professional cleaning equipment.',
        status: 'allowed',
        evidenceRefs: ['src-ccw-product'],
        requiresEvidence: true,
      },
    ],
    seoAeoGeoTargets: ['eofy cleaning equipment sale'],
    requiredVisuals: ['Real product image from CCW Shopify'],
    assets: [
      {
        id: 'asset-product-image',
        title: 'CCW product image',
        origin: 'ccw-shopify',
        rightsStatus: 'owned',
        publishable: true,
      },
    ],
    platformOutputs: [
      { platform: 'facebook', status: 'approved', contentRef: 'post-fb' },
      { platform: 'instagram', status: 'approved', contentRef: 'post-ig' },
      { platform: 'linkedin', status: 'approved', contentRef: 'post-li' },
      { platform: 'reddit', status: 'approved', contentRef: 'post-rd' },
    ],
    approval: {
      status: 'approved',
      humanApproved: true,
      approvedBy: 'founder-test',
      approvedAt: '2026-06-04T00:00:00.000Z',
    },
    evaluation: {
      evidenceQuality: 90,
      accuracy: 90,
      balance: 85,
      usefulness: 88,
      brandFit: 90,
      seoAeoGeoValue: 84,
      platformFit: 88,
      riskLevel: 10,
      approvalReadiness: 92,
    },
    publishLinks: [],
    lessons: [],
    ...overrides,
  };
}
