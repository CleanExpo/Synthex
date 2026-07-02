import {
  CAMPAIGN_AUTHORITY_MANIFEST_KEY,
  evaluateCampaignEvidenceManifest,
  extractCampaignAuthorityManifest,
} from '@/lib/marketing-agency/campaign-authority-manifest';
import { buildApprovedCampaignAuthorityManifest } from '@/tests/helpers/campaign-authority-manifest';

describe('campaign authority manifest gate', () => {
  it('passes an approved, sourced, rights-cleared campaign manifest', () => {
    const manifest = buildApprovedCampaignAuthorityManifest();
    const result = evaluateCampaignEvidenceManifest(manifest, {
      platforms: ['facebook', 'linkedin'],
    });

    expect(result.allowed).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.manifestId).toBe(manifest.manifestId);
  });

  it('blocks missing manifests before publishing', () => {
    const result = evaluateCampaignEvidenceManifest(null, {
      platforms: ['facebook'],
    });

    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain('campaign_authority_manifest_missing');
  });

  it('blocks unsupported claims without evidence references', () => {
    const manifest = buildApprovedCampaignAuthorityManifest({
      claims: [
        {
          id: 'claim-unsupported',
          statement: 'This campaign makes a claim without evidence.',
          status: 'needs_evidence',
          evidenceRefs: [],
          requiresEvidence: true,
        },
      ],
    });
    const result = evaluateCampaignEvidenceManifest(manifest, {
      platforms: ['facebook'],
    });

    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain('claim-unsupported_status_needs_evidence');
    expect(result.blockers).toContain('claim-unsupported_evidence_missing');
  });

  it('extracts manifests from campaign metadata-compatible containers', () => {
    const manifest = buildApprovedCampaignAuthorityManifest();
    const extracted = extractCampaignAuthorityManifest({
      [CAMPAIGN_AUTHORITY_MANIFEST_KEY]: manifest,
    });

    expect(extracted).toBe(manifest);
  });
});
