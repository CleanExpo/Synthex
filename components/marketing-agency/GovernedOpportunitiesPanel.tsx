'use client';

import { useApi } from '@/hooks/use-api';
import { cn } from '@/lib/utils';

interface GovernedOpportunity {
  id: string;
  title: string;
  recommendation: string;
  score: number;
  confidence: number;
  risk: number;
  status: string;
  approvalStatus: string;
  blockedReasons: string[];
  warnings: string[];
  nextAction: string;
  outcomeMetric: string;
  signal: {
    sourceKind: string;
    sourceLabel: string;
    riskState: string;
  };
}

interface OpportunitiesResponse {
  opportunities: GovernedOpportunity[];
  total: number;
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function approvalTone(status: string) {
  if (status === 'pass') return 'text-emerald-300 border-emerald-400/20';
  if (status === 'review') return 'text-orange-300 border-orange-400/20';
  return 'text-red-300 border-red-400/20';
}

export function GovernedOpportunitiesPanel() {
  const { data, error, isLoading } = useApi<OpportunitiesResponse>(
    '/api/marketing-agency/opportunities?limit=5',
    { pollingInterval: 60_000 }
  );

  const opportunities = data?.opportunities ?? [];

  return (
    <section className="rounded-sm border border-white/10 bg-white/[0.02] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Governed signal ledger
          </p>
          <h2 className="mt-2 text-lg font-semibold">Ranked Opportunities</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Persisted opportunities from evidence-backed signals. Approval,
            risk, evidence, and outcome hooks stay visible before campaign work.
          </p>
        </div>
        <div className="rounded-sm border border-white/10 px-3 py-2 text-sm text-muted-foreground">
          {isLoading ? 'Loading' : `${data?.total ?? 0} ready`}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-sm border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Governed opportunities could not be loaded.
        </div>
      )}

      {!error && !isLoading && opportunities.length === 0 && (
        <div className="mt-4 rounded-sm border border-white/10 px-4 py-4 text-sm text-muted-foreground">
          No persisted governed opportunities are available for the active
          organisation yet. Run the Apify intelligence command with an explicit
          organisation ID to populate this ledger.
        </div>
      )}

      {opportunities.length > 0 && (
        <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {opportunities.map(opportunity => (
            <article
              key={opportunity.id}
              className="rounded-sm border border-white/10 bg-black/10 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white">
                    {opportunity.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {opportunity.recommendation}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-sm border px-2 py-1 text-xs font-medium uppercase tracking-wide',
                    approvalTone(opportunity.approvalStatus)
                  )}
                >
                  {opportunity.approvalStatus}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-sm border border-white/10 px-3 py-2">
                  <p className="text-muted-foreground">Score</p>
                  <p className="mt-1 font-semibold text-white">
                    {opportunity.score}
                  </p>
                </div>
                <div className="rounded-sm border border-white/10 px-3 py-2">
                  <p className="text-muted-foreground">Confidence</p>
                  <p className="mt-1 font-semibold text-white">
                    {percent(opportunity.confidence)}
                  </p>
                </div>
                <div className="rounded-sm border border-white/10 px-3 py-2">
                  <p className="text-muted-foreground">Risk</p>
                  <p className="mt-1 font-semibold text-white">
                    {percent(opportunity.risk)}
                  </p>
                </div>
              </div>

              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Next Action
                  </dt>
                  <dd className="mt-1 text-white/80">{opportunity.nextAction}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Outcome Metric
                  </dt>
                  <dd className="mt-1 text-white/80">
                    {opportunity.outcomeMetric}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Source
                  </dt>
                  <dd className="mt-1 text-white/70">
                    {opportunity.signal.sourceLabel} -{' '}
                    {opportunity.signal.sourceKind} - risk{' '}
                    {opportunity.signal.riskState}
                  </dd>
                </div>
              </dl>

              {(opportunity.blockedReasons.length > 0 ||
                opportunity.warnings.length > 0) && (
                <div className="mt-4 rounded-sm border border-orange-400/20 bg-orange-500/10 px-3 py-2 text-xs text-orange-100">
                  {[...opportunity.blockedReasons, ...opportunity.warnings].join(
                    ' '
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
