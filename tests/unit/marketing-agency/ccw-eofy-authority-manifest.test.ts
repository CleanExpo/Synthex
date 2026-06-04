import {
  CAMPAIGN_AUTHORITY_MANIFEST_KEY,
  evaluateCampaignEvidenceManifest,
} from '@/lib/marketing-agency/campaign-authority-manifest';
import {
  CCW_EOFY_CAMPAIGN_SLUG,
  ccwEofyCampaignCalendar,
} from '@/lib/marketing-agency/ccw-eofy-calendar';
import {
  buildCcwEofyAuthorityMetadata,
  buildCcwEofyCampaignAuthorityManifest,
} from '@/lib/marketing-agency/ccw-eofy-authority-manifest';

describe('CCW EOFY campaign authority manifest', () => {
  it('builds a manifest with every CCW calendar platform output covered', () => {
    const manifest = buildCcwEofyCampaignAuthorityManifest({
      campaignId: 'campaign-1',
      approvedBy: 'founder',
      approvedAt: '2026-06-04T00:00:00.000Z',
      humanApproved: true,
    });
    const expectedPlatforms = new Set(
      ccwEofyCampaignCalendar.flatMap(slot => slot.platforms)
    );

    expect(manifest.manifestId).toBe(`${CCW_EOFY_CAMPAIGN_SLUG}-authority`);
    expect(new Set(manifest.platformOutputs.map(o => o.platform))).toEqual(
      expectedPlatforms
    );
    expect(manifest.sources.length).toBeGreaterThan(0);
    expect(manifest.claims.every(claim => claim.evidenceRefs?.length)).toBe(
      true
    );
  });

  it('passes the publish gate when the campaign has human approval', () => {
    const manifest = buildCcwEofyCampaignAuthorityManifest({
      campaignId: 'campaign-1',
      approvedBy: 'founder',
      approvedAt: '2026-06-04T00:00:00.000Z',
      humanApproved: true,
    });
    const gate = evaluateCampaignEvidenceManifest(manifest, {
      platforms: ['facebook', 'instagram', 'linkedin', 'reddit'],
    });

    expect(gate.allowed).toBe(true);
    expect(gate.blockers).toEqual([]);
  });

  it('keeps generated CCW packs blocked until human approval is present', () => {
    const metadata = buildCcwEofyAuthorityMetadata({
      campaignId: 'campaign-1',
      platforms: ['facebook'],
    });

    expect(metadata[CAMPAIGN_AUTHORITY_MANIFEST_KEY]).toEqual(
      expect.objectContaining({
        approval: expect.objectContaining({
          status: 'review',
          humanApproved: false,
        }),
      })
    );
    expect(metadata.publishGate).toEqual(
      expect.objectContaining({
        allowed: false,
        blockers: expect.arrayContaining(['campaign_human_approval_missing']),
      })
    );
  });
});
