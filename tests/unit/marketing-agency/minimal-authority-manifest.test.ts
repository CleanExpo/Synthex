import {
  CAMPAIGN_AUTHORITY_MANIFEST_KEY,
  evaluateCampaignEvidenceManifest,
} from '@/lib/marketing-agency/campaign-authority-manifest';
import {
  buildMinimalCampaignAuthorityManifest,
  ensureCampaignAuthorityManifest,
} from '@/lib/marketing-agency/minimal-authority-manifest';
import { buildCcwEofyCampaignAuthorityManifest } from '@/lib/marketing-agency/ccw-eofy-authority-manifest';

describe('minimal campaign authority manifest auto-generation', () => {
  it('an ordinary self-authored post passes the publish gate (P0 fix)', () => {
    const manifest = buildMinimalCampaignAuthorityManifest({
      campaignId: 'org-123',
      platforms: ['facebook'],
      topic: 'New product update',
      idSeed: 'post-abc',
    });

    const result = evaluateCampaignEvidenceManifest(manifest, {
      platforms: ['facebook'],
    });

    expect(result.blockers).toEqual([]);
    expect(result.allowed).toBe(true);
  });

  it('passes the gate for every requested platform', () => {
    const platforms = ['facebook', 'instagram', 'linkedin', 'threads'];
    const manifest = buildMinimalCampaignAuthorityManifest({
      platforms,
      idSeed: 'multi-platform',
    });

    const result = evaluateCampaignEvidenceManifest(manifest, { platforms });

    expect(result.allowed).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('ensureCampaignAuthorityManifest builds a minimal manifest when none exists', () => {
    const manifest = ensureCampaignAuthorityManifest(
      { platforms: ['facebook'], idSeed: 'post-1' },
      // ordinary scheduler metadata — no manifest of any kind
      { hashtags: ['#launch'], images: [], mentions: [] }
    );

    const result = evaluateCampaignEvidenceManifest(manifest, {
      platforms: ['facebook'],
    });

    expect(manifest.manifestId).toMatch(/^minimal-/);
    expect(result.allowed).toBe(true);
  });

  it('ensureCampaignAuthorityManifest NEVER overrides an existing manifest', () => {
    // A real, already-approved manifest carried in campaign metadata.
    const existing = buildCcwEofyCampaignAuthorityManifest({
      humanApproved: true,
      approvedBy: 'founder',
    });

    const returned = ensureCampaignAuthorityManifest(
      { platforms: ['facebook'], idSeed: 'should-not-be-used' },
      { [CAMPAIGN_AUTHORITY_MANIFEST_KEY]: existing }
    );

    // The CCW manifest is returned untouched — not replaced by a minimal one.
    expect(returned).toBe(existing);
    expect(returned.manifestId).not.toMatch(/^minimal-/);
  });

  it('a CCW-style campaign still gates when NOT human-approved', () => {
    // CCW manifest awaiting human sign-off (humanApproved omitted → false).
    const ccwUnapproved = buildCcwEofyCampaignAuthorityManifest();

    // ensure must surface this real manifest, not paper over it with a minimal one.
    const returned = ensureCampaignAuthorityManifest(
      { platforms: ['facebook'] },
      { [CAMPAIGN_AUTHORITY_MANIFEST_KEY]: ccwUnapproved }
    );
    expect(returned).toBe(ccwUnapproved);

    const result = evaluateCampaignEvidenceManifest(returned, {
      platforms: ['facebook'],
    });

    // The CCW approval control is preserved: still blocked on human approval.
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain('campaign_human_approval_missing');
  });

  it('a CCW-style campaign publishes once its real manifest is human-approved', () => {
    const ccwApproved = buildCcwEofyCampaignAuthorityManifest({
      humanApproved: true,
      approvedBy: 'founder',
    });

    const result = evaluateCampaignEvidenceManifest(ccwApproved, {
      platforms: ['facebook'],
    });

    expect(result.allowed).toBe(true);
  });
});
