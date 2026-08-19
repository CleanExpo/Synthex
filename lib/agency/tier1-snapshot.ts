/**
 * Tier-1 weekly portfolio report builder (SYN-PM-107 / AT-005).
 * Metrics use verification tags per reporting-templates.md.
 */

import type { AgencyBrandMetrics } from '@/lib/agency/load-agency-brand-metrics';

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

function counted(label: string, value: number | null): TaggedMetric {
  return metric(label, value, value != null ? 'verified' : 'hypothesised');
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
    workflowsCompleted: metric(
      'Workflows approved + completed',
      counts.completed,
      'verified'
    ),
    sentForRevision: metric(
      'Sent back for revision',
      counts.revisionRequested,
      'verified'
    ),
    awaitingApproval: metric(
      'Awaiting CEO approval',
      counts.awaitingApproval,
      'verified'
    ),
    failed: metric('Workflows failed', counts.failed, 'verified'),
    cancelled: metric('Workflows cancelled', counts.cancelled, 'verified'),
    approvalRate: metric(
      'Approval rate (completed ÷ reviewed)',
      reviewed > 0 ? Math.round((counts.completed / reviewed) * 100) : null,
      reviewed > 0 ? 'verified' : 'hypothesised'
    ),
  };
}

function buildBrandBlock(
  brandMetrics?: AgencyBrandMetrics
): Tier1Snapshot['brands'] {
  return {
    dr: {
      d3Events: counted('D3 events / week', brandMetrics?.dr.d3Events ?? null),
      qualificationRate: counted(
        'D2 → D3 qualification rate',
        brandMetrics?.dr.qualificationRate ?? null
      ),
    },
    nrpg: {
      n2Applications: counted(
        'N2 applications',
        brandMetrics?.nrpg.n2Applications ?? null
      ),
      n3Acceptance: counted(
        'N2 → N3 acceptance rate',
        brandMetrics?.nrpg.n3Acceptance ?? null
      ),
    },
    carsi: {
      snapshotCompletion: counted(
        'Snapshot completion rate',
        brandMetrics?.carsi.snapshotCompletion ?? null
      ),
      firmActivations: counted(
        'Firm-tier activations',
        brandMetrics?.carsi.firmActivations ?? null
      ),
    },
    ccw: {
      hubToCart: counted(
        'Hub article-to-cart-add rate',
        brandMetrics?.ccw.hubToCart ?? null
      ),
    },
  };
}

export function buildTier1Snapshot(opts?: {
  weekEnding?: Date;
  claimsProcessed?: number | null;
  gateCounts?: AgencyGateCounts;
  brandMetrics?: AgencyBrandMetrics;
}): Tier1Snapshot {
  const weekEnding = opts?.weekEnding ?? new Date();
  const iso = weekEnding.toISOString().split('T')[0];
  const brands = buildBrandBlock(opts?.brandMetrics);
  const hasAnyBrandValue = Object.values(brands).some(block =>
    Object.values(block).some(m => m.value != null)
  );

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
      narrative: hasAnyBrandValue
        ? 'Portfolio Tier-1 snapshot from org-scoped Lead canaries (GA4 cart/claim feeds still pending).'
        : 'Portfolio Tier-1 snapshot generated in-product. Wire GA4/GSC for verified claim counts.',
    },
    ...(opts?.gateCounts
      ? { agencyLoop: summarizeAgencyGate(opts.gateCounts) }
      : {}),
    brands,
    verificationStatus: [
      { gate: 'service-area-claims', state: 'verification needed' },
      { gate: 'gbp-compliance', state: 'verification needed' },
      {
        gate: 'ga4-search-console',
        state: hasAnyBrandValue
          ? 'lead-proxy verified; GA4 pending'
          : 'verification needed',
      },
    ],
  };
}
