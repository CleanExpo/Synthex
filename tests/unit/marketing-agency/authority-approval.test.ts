import {
  CAMPAIGN_AUTHORITY_MANIFEST_KEY,
  evaluateCampaignEvidenceManifest,
} from '@/lib/marketing-agency/campaign-authority-manifest';
import {
  approveCampaignAuthorityManifest,
  approveCampaignAuthorityMetadata,
  campaignPlatformFallback,
} from '@/lib/marketing-agency/authority-approval';
import { buildApprovedCampaignAuthorityManifest } from '@/tests/helpers/campaign-authority-manifest';

// `approveCampaignAuthorityManifest` is the ONLY human-initiated approval path left now that the
// generator no longer self-approves. Nothing tested it. An independent reviewer read the helper
// and reported a P0 — that it never sets `status`/`humanApproved`, leaving the legitimate approval
// path unreachable. That reading was wrong, but the branch had no executable way to show it, so
// the refutation rested on someone re-reading the same file. These tests make the answer runnable.
//
// The first test is a POSITIVE CONTROL and it is the load-bearing one: it proves
// `campaign_human_approval_missing` actually FIRES on an unapproved manifest. Without it, the
// second test passing would be indistinguishable from a blocker that never fires for any input.
describe('campaign authority human approval path', () => {
  // An otherwise-publishable manifest whose only defect is that no human has approved it.
  const pendingManifest = () =>
    buildApprovedCampaignAuthorityManifest({
      approval: { status: 'pending_review' },
    });

  it('POSITIVE CONTROL: an unapproved manifest is blocked for missing human approval', () => {
    const result = evaluateCampaignEvidenceManifest(pendingManifest(), {
      platforms: ['facebook'],
    });

    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain('campaign_human_approval_missing');
  });

  it('records the approving human on the manifest', () => {
    const approved = approveCampaignAuthorityManifest(pendingManifest(), {
      approvedBy: 'founder-test',
      approvedAt: '2026-08-17T00:00:00.000Z',
    });

    expect(approved.approval.status).toBe('approved');
    expect(approved.approval.humanApproved).toBe(true);
    expect(approved.approval.approvedBy).toBe('founder-test');
    expect(approved.approval.approvedAt).toBe('2026-08-17T00:00:00.000Z');
  });

  it('clears the human-approval blocker the control proves can fire', () => {
    const approved = approveCampaignAuthorityManifest(pendingManifest(), {
      approvedBy: 'founder-test',
    });
    const result = evaluateCampaignEvidenceManifest(approved, {
      platforms: ['facebook'],
    });

    expect(result.blockers).not.toContain('campaign_human_approval_missing');
    expect(result.allowed).toBe(true);
  });

  it('does not manufacture an evaluation that never ran', () => {
    // Approving asserts a human signed off. It cannot assert that nine scores were computed, so a
    // manifest with no evaluation stays with none and the gate keeps refusing it.
    const approved = approveCampaignAuthorityManifest(
      buildApprovedCampaignAuthorityManifest({
        approval: { status: 'pending_review' },
        evaluation: undefined,
      }),
      { approvedBy: 'founder-test' }
    );

    expect(approved.evaluation).toBeUndefined();

    const result = evaluateCampaignEvidenceManifest(approved, {
      platforms: ['facebook'],
    });

    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain('campaign_evaluation_missing');
  });
});

// SYN-1166. `Campaign.platform` is 'multi' for any campaign spanning several channels, but no
// manifest declares a `platformOutput` named 'multi' — it is a container value, not a channel.
// The approvals route used to pass `[campaign.platform]` straight through, so approving such a
// campaign refused it with `campaign_platform_output_multi_missing`: a refusal naming a channel
// that does not exist, on the path that turns an approval row into a gate verdict.
//
// The route now passes `undefined` for that case, which re-enables the fallback
// `approveCampaignAuthorityMetadata` already had — derive the channels from the manifest's own
// platformOutputs. The first test below is the POSITIVE CONTROL: it proves the bad blocker really
// fires, so the second test cannot pass by asserting against a check that never runs.
describe('campaign approval platform resolution (SYN-1166)', () => {
  const metadataWithManifest = () => ({
    [CAMPAIGN_AUTHORITY_MANIFEST_KEY]: buildApprovedCampaignAuthorityManifest({
      approval: { status: 'pending_review' },
    }),
  });

  it('POSITIVE CONTROL: asking about the container value blocks the approval', () => {
    const approved = approveCampaignAuthorityMetadata(metadataWithManifest(), {
      approvedBy: 'founder-test',
      platforms: ['multi'],
    });

    const gate = approved.publishGate as {
      allowed: boolean;
      blockers: string[];
    };
    expect(gate.allowed).toBe(false);
    expect(gate.blockers).toContain('campaign_platform_output_multi_missing');
  });

  it('derives the real channels from the manifest when no platforms are supplied', () => {
    const approved = approveCampaignAuthorityMetadata(metadataWithManifest(), {
      approvedBy: 'founder-test',
      platforms: undefined,
    });

    const gate = approved.publishGate as {
      allowed: boolean;
      blockers: string[];
    };
    expect(gate.blockers).not.toContain(
      'campaign_platform_output_multi_missing'
    );
    expect(gate.allowed).toBe(true);
  });

  it('still honours an explicit platform list when one is supplied', () => {
    // The fix must not swallow a caller that genuinely names its channels.
    const approved = approveCampaignAuthorityMetadata(metadataWithManifest(), {
      approvedBy: 'founder-test',
      platforms: ['facebook'],
    });

    const gate = approved.publishGate as {
      allowed: boolean;
      blockers: string[];
    };
    expect(gate.allowed).toBe(true);
    expect(gate.blockers).toEqual([]);
  });
});

// The half of the fix that lives in the approvals route: deciding WHEN to send undefined.
// It is exercised here directly rather than through the route, because the route's own path
// needs a database transaction and the decision itself is pure.
describe('campaignPlatformFallback', () => {
  it('returns undefined for the container value so the manifest decides', () => {
    expect(campaignPlatformFallback('multi')).toBeUndefined();
  });

  it('is not fooled by casing or padding on the container value', () => {
    expect(campaignPlatformFallback('MULTI')).toBeUndefined();
    expect(campaignPlatformFallback(' multi ')).toBeUndefined();
  });

  it('returns undefined when the campaign has no platform at all', () => {
    expect(campaignPlatformFallback(null)).toBeUndefined();
    expect(campaignPlatformFallback('')).toBeUndefined();
  });

  it('CONTROL: a real single channel is passed through unchanged', () => {
    // Without this leg the three assertions above are also satisfied by a function that
    // returns undefined for every input, which would silence the gate entirely.
    expect(campaignPlatformFallback('facebook')).toEqual(['facebook']);
    expect(campaignPlatformFallback('linkedin')).toEqual(['linkedin']);
  });
});
