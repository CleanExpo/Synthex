/**
 * SYN-1157: the minimal manifest self-approved every ordinary post on the live
 * publish path and invented nine evaluation scores.
 *
 * The ruling (founder, 2026-08-16) was to SPLIT THE CLAIM rather than delete the
 * self-approval or leave it:
 *   "a human authored and scheduled this"  -> a distinct `self_authored` status,
 *                                             carrying the REAL scheduling user
 *                                             and the REAL scheduling time.
 *   "a human reviewed this against evidence" -> what `humanApproved` means to the
 *                                             gate. It did not happen, so it is
 *                                             no longer asserted.
 *   fabricated evaluation scores            -> absent. Absent is honest; 80 is not.
 *
 * These tests are the control. Phase 0.1's DONE bar is not "the self-approval is
 * gone", it is "its cause is gone AND CANNOT SILENTLY RETURN". So most of the
 * cases below assert the gate REFUSES a manifest in which the lie has crept back.
 */
import {
  evaluateCampaignEvidenceManifest,
  type CampaignEvidenceManifest,
} from '@/lib/marketing-agency/campaign-authority-manifest';
// The live routes reach the gate through this wrapper, so the cron-path case
// below exercises the same entry point production uses.
import { assertCampaignPublishable } from '@/lib/marketing-agency/publish-gate';
import { buildMinimalCampaignAuthorityManifest } from '@/lib/marketing-agency/minimal-authority-manifest';
import { buildCcwEofyCampaignAuthorityManifest } from '@/lib/marketing-agency/ccw-eofy-authority-manifest';

const SCHEDULED_AT = '2026-08-01T10:00:00.000Z';
const SCHEDULED_BY = 'user-abc-123';

function minimal(): CampaignEvidenceManifest {
  return buildMinimalCampaignAuthorityManifest({
    campaignId: 'org-123',
    platforms: ['facebook'],
    topic: 'New product update',
    idSeed: 'post-abc',
    scheduledBy: SCHEDULED_BY,
    scheduledAt: SCHEDULED_AT,
  });
}

describe('self-authored approval replaces the minimal manifest self-approval', () => {
  describe('what the generator now emits', () => {
    it('records self_authored, never an approval no human gave', () => {
      const m = minimal();
      expect(m.approval.status).toBe('self_authored');
      expect(m.approval.humanApproved).toBeUndefined();
      expect(m.approval.approvedBy).toBeUndefined();
      expect(m.approval.approvedAt).toBeUndefined();
    });

    it('carries the REAL scheduling identity and time, not publish-time now()', () => {
      const m = minimal();
      expect(m.approval.scheduledBy).toBe(SCHEDULED_BY);
      // The bug was approvedAt: now — a timestamp recording a moment when the
      // cron ran and nobody did anything. It must be the scheduling moment.
      expect(m.approval.scheduledAt).toBe(SCHEDULED_AT);
    });

    it('emits NO evaluation block: absent is honest, 80 is fabricated', () => {
      const m = minimal();
      expect(m.evaluation).toBeUndefined();
    });
  });

  describe('the gate still lets ordinary posts through', () => {
    it('allows a self_authored manifest whose claims need no evidence', () => {
      const result = evaluateCampaignEvidenceManifest(minimal(), {
        platforms: ['facebook'],
      });
      expect(result.blockers).toEqual([]);
      expect(result.allowed).toBe(true);
    });

    it('allows it on the cron publish path specifically', () => {
      const result = assertCampaignPublishable({
        manifest: minimal(),
        platforms: ['facebook'],
        requestedAction: 'cron_external_publish',
      });
      expect(result.allowed).toBe(true);
    });
  });

  describe('the lie cannot silently return (Phase 0.1 DONE bar)', () => {
    it('REFUSES a self_authored manifest that also asserts humanApproved', () => {
      const m = minimal();
      m.approval.humanApproved = true;
      m.approval.approvedBy = 'self-publish';
      const result = evaluateCampaignEvidenceManifest(m, {
        platforms: ['facebook'],
      });
      expect(result.allowed).toBe(false);
      expect(result.blockers).toContain(
        'campaign_self_authored_claims_human_approval'
      );
    });

    it('REFUSES a self_authored manifest carrying an evaluation block', () => {
      const m = minimal();
      m.evaluation = {
        evidenceQuality: 80,
        accuracy: 80,
        balance: 80,
        usefulness: 80,
        brandFit: 80,
        seoAeoGeoValue: 80,
        platformFit: 80,
        riskLevel: 10,
        approvalReadiness: 80,
      };
      const result = evaluateCampaignEvidenceManifest(m, {
        platforms: ['facebook'],
      });
      expect(result.allowed).toBe(false);
      expect(result.blockers).toContain(
        'campaign_self_authored_carries_evaluation'
      );
    });

    it('REFUSES a self_authored manifest with no scheduling identity', () => {
      const m = minimal();
      delete m.approval.scheduledBy;
      const result = evaluateCampaignEvidenceManifest(m, {
        platforms: ['facebook'],
      });
      expect(result.allowed).toBe(false);
      expect(result.blockers).toContain(
        'campaign_self_authored_scheduler_missing'
      );
    });

    it('REFUSES a self_authored manifest with no scheduling time', () => {
      const m = minimal();
      delete m.approval.scheduledAt;
      const result = evaluateCampaignEvidenceManifest(m, {
        platforms: ['facebook'],
      });
      expect(result.allowed).toBe(false);
      expect(result.blockers).toContain(
        'campaign_self_authored_scheduler_missing'
      );
    });

    it('REFUSES self_authored the moment a claim requires evidence', () => {
      const m = minimal();
      m.claims = [
        {
          id: 'verifiable-claim',
          statement: 'We remove 99.9% of mould spores.',
          status: 'allowed',
          requiresEvidence: true,
        },
      ];
      const result = evaluateCampaignEvidenceManifest(m, {
        platforms: ['facebook'],
      });
      expect(result.allowed).toBe(false);
      // self_authored is not a licence to publish an evidence-bearing claim.
      expect(result.blockers).toContain(
        'campaign_self_authored_requires_evidence'
      );
    });

    it('REFUSES self_authored the moment a claim demands human approval', () => {
      const m = minimal();
      m.claims = [
        {
          id: 'needs-signoff',
          statement: 'Endorsed by the regulator.',
          status: 'allowed',
          requiresEvidence: false,
          humanApprovalRequired: true,
        },
      ];
      const result = evaluateCampaignEvidenceManifest(m, {
        platforms: ['facebook'],
      });
      expect(result.allowed).toBe(false);
      expect(result.blockers).toContain(
        'campaign_self_authored_requires_evidence'
      );
    });
  });

  describe('the real human-approval control is untouched', () => {
    it('a CCW-style manifest still blocks without real human approval', () => {
      const ccw = buildCcwEofyCampaignAuthorityManifest();
      const result = evaluateCampaignEvidenceManifest(ccw, {
        platforms: ['facebook'],
      });
      expect(result.allowed).toBe(false);
      expect(result.blockers).toContain('campaign_human_approval_missing');
    });

    it('a CCW-style manifest still publishes once really approved', () => {
      const ccw = buildCcwEofyCampaignAuthorityManifest({
        humanApproved: true,
        approvedBy: 'founder',
      });
      const result = evaluateCampaignEvidenceManifest(ccw, {
        platforms: ['facebook'],
      });
      expect(result.allowed).toBe(true);
    });

    it('a manifest claiming self_authored cannot skip evidence for a rich campaign', () => {
      // The escape hatch that would matter most: relabel a CCW campaign as
      // self_authored to dodge its evidence duty. The claims ledger still governs.
      const ccw = buildCcwEofyCampaignAuthorityManifest();
      ccw.approval = {
        status: 'self_authored',
        scheduledBy: SCHEDULED_BY,
        scheduledAt: SCHEDULED_AT,
      };
      const result = evaluateCampaignEvidenceManifest(ccw, {
        platforms: ['facebook'],
      });
      expect(result.allowed).toBe(false);
    });
  });
});
