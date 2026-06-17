/**
 * Unit tests for the agency-loop Gate metrics in the Tier-1 weekly snapshot
 * (SYN-PM-107 + SYN-972 Measure leg).
 */
import {
  summarizeAgencyGate,
  buildTier1Snapshot,
  type AgencyGateCounts,
} from '@/lib/agency/tier1-snapshot';

const counts: AgencyGateCounts = {
  completed: 8,
  revisionRequested: 2,
  awaitingApproval: 3,
  failed: 1,
  cancelled: 0,
};

describe('summarizeAgencyGate', () => {
  it('reports each gate outcome as a verified metric', () => {
    const m = summarizeAgencyGate(counts);
    expect(m.workflowsCompleted.value).toBe(8);
    expect(m.workflowsCompleted.tag).toBe('verified');
    expect(m.sentForRevision.value).toBe(2);
    expect(m.awaitingApproval.value).toBe(3);
    expect(m.failed.value).toBe(1);
  });

  it('computes approval rate over reviewed (completed + revision) workflows', () => {
    // 8 completed of (8 + 2) reviewed = 80%
    expect(summarizeAgencyGate(counts).approvalRate.value).toBe(80);
    expect(summarizeAgencyGate(counts).approvalRate.tag).toBe('verified');
  });

  it('leaves approval rate null/hypothesised when nothing was reviewed', () => {
    const m = summarizeAgencyGate({
      completed: 0,
      revisionRequested: 0,
      awaitingApproval: 5,
      failed: 0,
      cancelled: 0,
    });
    expect(m.approvalRate.value).toBeNull();
    expect(m.approvalRate.tag).toBe('hypothesised');
  });
});

describe('buildTier1Snapshot agencyLoop', () => {
  it('includes the agencyLoop block when gateCounts are supplied', () => {
    const snap = buildTier1Snapshot({ gateCounts: counts });
    expect(snap.agencyLoop?.sentForRevision.value).toBe(2);
    expect(snap.agencyLoop?.approvalRate.value).toBe(80);
  });

  it('omits agencyLoop entirely when no gateCounts are supplied', () => {
    const snap = buildTier1Snapshot({ claimsProcessed: 5 });
    expect(snap.agencyLoop).toBeUndefined();
    // existing headline metric still works
    expect(snap.headline.claimsProcessed.value).toBe(5);
  });
});
