import { evaluateCampaignEvidenceManifest } from '@/lib/marketing-agency/campaign-authority-manifest';
import { approveCampaignAuthorityManifest } from '@/lib/marketing-agency/authority-approval';
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
