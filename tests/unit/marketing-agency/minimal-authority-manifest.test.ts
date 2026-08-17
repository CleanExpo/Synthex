import {
  CAMPAIGN_AUTHORITY_MANIFEST_KEY,
  evaluateCampaignEvidenceManifest,
} from '@/lib/marketing-agency/campaign-authority-manifest';
import {
  buildMinimalCampaignAuthorityManifest,
  ensureCampaignAuthorityManifest,
} from '@/lib/marketing-agency/minimal-authority-manifest';
import { buildCcwEofyCampaignAuthorityManifest } from '@/lib/marketing-agency/ccw-eofy-authority-manifest';

// SYN-1157: a minimal manifest must now name the human who scheduled the post
// and when. These three cases gained scheduledBy/scheduledAt because the
// CONTRACT was tightened, not to make a red test go green — the gate refusing an
// unattributed post is the new correct behaviour, and it is asserted directly in
// `should NOT publish when nobody is named` below and in
// tests/unit/marketing-agency/self-authored-approval.test.ts.
const SCHEDULED_BY = 'user-abc-123';
const SCHEDULED_AT = '2026-08-01T10:00:00.000Z';

describe('minimal campaign authority manifest auto-generation', () => {
  it('an ordinary self-authored post passes the publish gate (P0 fix)', () => {
    const manifest = buildMinimalCampaignAuthorityManifest({
      campaignId: 'org-123',
      platforms: ['facebook'],
      topic: 'New product update',
      idSeed: 'post-abc',
      scheduledBy: SCHEDULED_BY,
      scheduledAt: SCHEDULED_AT,
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
      scheduledBy: SCHEDULED_BY,
      scheduledAt: SCHEDULED_AT,
    });

    const result = evaluateCampaignEvidenceManifest(manifest, { platforms });

    expect(result.allowed).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('should NOT publish when nobody is named as the scheduler', () => {
    // The tightened contract, asserted in the same file that relies on it. An
    // unattributed post is not a self-authored post, so it gates instead of
    // publishing. Without this case the three additions above would be
    // indistinguishable from bending the tests to fit the code.
    const manifest = buildMinimalCampaignAuthorityManifest({
      platforms: ['facebook'],
      idSeed: 'unattributed',
    });

    const result = evaluateCampaignEvidenceManifest(manifest, {
      platforms: ['facebook'],
    });

    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain(
      'campaign_self_authored_scheduler_missing'
    );
  });

  it('ensureCampaignAuthorityManifest builds a minimal manifest when none exists', () => {
    const manifest = ensureCampaignAuthorityManifest(
      {
        platforms: ['facebook'],
        idSeed: 'post-1',
        scheduledBy: SCHEDULED_BY,
        scheduledAt: SCHEDULED_AT,
      },
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
