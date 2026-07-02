/**
 * Tier-1 weekly portfolio report builder (SYN-PM-107).
 * Metrics use verification tags per reporting-templates.md.
 */

export type MetricTag = 'verified' | 'hypothesised' | 'placeholder';

export interface TaggedMetric {
  value: number | string | null;
  tag: MetricTag;
  label: string;
}

export interface Tier1Snapshot {
  templateVersion: string;
  weekEnding: string;
  generatedAt: string;
  headline: {
    claimsProcessed: TaggedMetric;
    status: 'green' | 'amber' | 'red';
    narrative: string;
  };
  /**
   * Agency-loop Gate metrics — how much work the OS drove and how the human
   * Gate decided on it this week. Present only when counts are supplied.
   */
  agencyLoop?: Record<string, TaggedMetric>;
  brands: {
    dr: Record<string, TaggedMetric>;
    nrpg: Record<string, TaggedMetric>;
    carsi: Record<string, TaggedMetric>;
    ccw: Record<string, TaggedMetric>;
  };
  verificationStatus: { gate: string; state: string }[];
}

/**
 * Counts of the agency-loop human Gate outcomes for the week, by
 * WorkflowExecution status. All real counts → tagged 'verified'.
 */
export interface AgencyGateCounts {
  /** status='completed' — approved (human or auto) and ran to completion. */
  completed: number;
  /** status='revision_requested' — CEO sent back for revision (SYN-972). */
  revisionRequested: number;
  /** status='waiting_approval' — currently in the CEO review queue. */
  awaitingApproval: number;
  /** status='failed'. */
  failed: number;
  /** status='cancelled'. */
  cancelled: number;
}

function metric(
  label: string,
  value: number | string | null,
  tag: MetricTag = 'hypothesised'
): TaggedMetric {
  return { label, value, tag };
}

/**
 * Build the agency-loop Gate metric block from real WorkflowExecution counts.
 * Pure; every value is a real count → 'verified'.
 */
export function summarizeAgencyGate(
  counts: AgencyGateCounts
): Record<string, TaggedMetric> {
  const reviewed = counts.completed + counts.revisionRequested;
  return {
    workflowsCompleted: metric('Workflows approved + completed', counts.completed, 'verified'),
    sentForRevision: metric('Sent back for revision', counts.revisionRequested, 'verified'),
    awaitingApproval: metric('Awaiting CEO approval', counts.awaitingApproval, 'verified'),
    failed: metric('Workflows failed', counts.failed, 'verified'),
    cancelled: metric('Workflows cancelled', counts.cancelled, 'verified'),
    approvalRate: metric(
      'Approval rate (completed ÷ reviewed)',
      reviewed > 0 ? Math.round((counts.completed / reviewed) * 100) : null,
      reviewed > 0 ? 'verified' : 'hypothesised'
    ),
  };
}

export function buildTier1Snapshot(opts?: {
  weekEnding?: Date;
  claimsProcessed?: number | null;
  gateCounts?: AgencyGateCounts;
}): Tier1Snapshot {
  const weekEnding = opts?.weekEnding ?? new Date();
  const iso = weekEnding.toISOString().split('T')[0];

  return {
    templateVersion: 'T1-2026.05',
    weekEnding: iso,
    generatedAt: new Date().toISOString(),
    headline: {
      claimsProcessed: metric(
        'Insurance-approved claims processed (DR/NRPG)',
        opts?.claimsProcessed ?? null,
        opts?.claimsProcessed != null ? 'verified' : 'hypothesised'
      ),
      status: 'amber',
      narrative:
        'Portfolio Tier-1 snapshot generated in-product. Wire GA4/GSC for verified claim counts.',
    },
    ...(opts?.gateCounts
      ? { agencyLoop: summarizeAgencyGate(opts.gateCounts) }
      : {}),
    brands: {
      dr: {
        d3Events: metric('D3 events / week', null),
        qualificationRate: metric('D2 → D3 qualification rate', null),
      },
      nrpg: {
        n2Applications: metric('N2 applications', null),
        n3Acceptance: metric('N2 → N3 acceptance rate', null),
      },
      carsi: {
        snapshotCompletion: metric('Snapshot completion rate', null),
        firmActivations: metric('Firm-tier activations', null),
      },
      ccw: {
        hubToCart: metric('Hub article-to-cart-add rate', null),
      },
    },
    verificationStatus: [
      { gate: 'service-area-claims', state: 'verification needed' },
      { gate: 'gbp-compliance', state: 'verification needed' },
      { gate: 'ga4-search-console', state: 'verification needed' },
    ],
  };
}
