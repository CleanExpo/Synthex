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
  brands: {
    dr: Record<string, TaggedMetric>;
    nrpg: Record<string, TaggedMetric>;
    carsi: Record<string, TaggedMetric>;
    ccw: Record<string, TaggedMetric>;
  };
  verificationStatus: { gate: string; state: string }[];
}

function metric(
  label: string,
  value: number | string | null,
  tag: MetricTag = 'hypothesised'
): TaggedMetric {
  return { label, value, tag };
}

export function buildTier1Snapshot(opts?: {
  weekEnding?: Date;
  claimsProcessed?: number | null;
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
