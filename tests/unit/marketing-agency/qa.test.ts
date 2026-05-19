import { evaluateClaimEvidence } from '@/lib/marketing-agency/evidence';
import { evaluateAssetLicences } from '@/lib/marketing-agency/licensing';
import { runCampaignQa } from '@/lib/marketing-agency/qa';

describe('marketing agency QA gates', () => {
  it('blocks factual claims without evidence references', () => {
    const result = evaluateClaimEvidence([
      {
        id: 'claim-1',
        text: 'RestoreAssist guarantees claim approval.',
        type: 'outcome',
        evidenceRefs: [],
      },
    ]);

    expect(result.status).toBe('blocked');
    expect(result.blockedReasons[0]).toContain('claim-1');
  });

  it('blocks unlicensed production assets', () => {
    const result = evaluateAssetLicences([
      {
        id: 'asset-1',
        assetType: 'audio',
        provider: 'artlist',
        licenceStatus: 'pending',
      },
    ]);

    expect(result.status).toBe('blocked');
    expect(result.blockedReasons[0]).toContain('asset-1');
  });

  it('keeps publishing blocked by default', () => {
    const result = runCampaignQa({
      claimGate: { status: 'pass', blockedReasons: [], warnings: [] },
      licenceGate: { status: 'pass', blockedReasons: [], warnings: [] },
      consentGate: { status: 'pass', blockedReasons: [], warnings: [] },
      formatGate: { status: 'pass', blockedReasons: [], warnings: [] },
      publishApproved: false,
    });

    expect(result.publishGate.status).toBe('blocked');
  });
});
