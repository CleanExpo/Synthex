/**
 * SYN-1316 deterministic decision layer. It drafts; it never publishes.
 * Financial impact is an estimate until outcome measurement validates it.
 */
import {
  businessIntentSchema,
  opportunitySignalSchema,
  type BusinessIntent,
  type OpportunitySignal,
} from './contracts';

export interface ImprovementProposal {
  signalId: string;
  organizationId: string;
  serviceId: string;
  title: string;
  outcomeMetric: string;
  /** Ranking index is not profit nor a causal effect estimate. */
  priorityIndex: number;
  expectedGrossProfitAud: number;
  estimatedInterventionCostAud: number;
  decision: 'draft_for_review' | 'research_more' | 'defer_for_capacity';
  reasons: string[];
  evidenceRefs: string[];
  approvalStatus: 'required';
}

export function rankImprovements(
  intentInput: BusinessIntent,
  rawSignals: OpportunitySignal[]
): ImprovementProposal[] {
  const intent = businessIntentSchema.parse(intentInput);
  const availableCapacity = intent.capacity.availableJobsPerWeek;
  const bookedCapacity = intent.capacity.bookedJobsPerWeek;
  const capacityKnown = availableCapacity !== null && bookedCapacity !== null;
  const noCapacity = capacityKnown && bookedCapacity >= availableCapacity;
  const deduplicated = new Map<string, OpportunitySignal>();
  for (const candidate of rawSignals) {
    const s = opportunitySignalSchema.parse(candidate);
    if (s.organizationId !== intent.organizationId) {
      throw new Error('TENANT_MISMATCH');
    }
    if (!intent.serviceIds.includes(s.serviceId)) {
      throw new Error('UNKNOWN_SERVICE');
    }
    const prior = deduplicated.get(s.id);
    if (prior && JSON.stringify(prior) !== JSON.stringify(s)) {
      throw new Error('CONFLICTING_SIGNAL_ID');
    }
    deduplicated.set(s.id, s);
  }
  const proposals = Array.from(deduplicated.values()).map(s => {
    const reasons: string[] = [];
    const evidenceRefs = s.evidence.map(e => e.id);
    // Any estimated-only contribution needs separate verification before a
    // candidate is promoted; a single owned stub cannot launder estimates.
    const weakEvidence =
      s.confidence < 0.65 || s.evidence.some(e => e.dataClass === 'estimated');
    const highRisk = s.risk >= 0.6;
    const prohibitedClaim = intent.constraints.excludedClaims.some(claim =>
      [s.title, s.outcomeMetric].some(text =>
        text.toLocaleLowerCase().includes(claim.toLocaleLowerCase())
      )
    );
    const netPotential =
      s.expectedGrossProfitAud - s.estimatedInterventionCostAud;
    const exceedsBudget =
      s.estimatedInterventionCostAud >
      intent.constraints.maximumMonthlyAutomationCostAud;
    if (weakEvidence)
      reasons.push(
        'Evidence insufficient for an intervention; verify with owned data.'
      );
    if (highRisk)
      reasons.push('Elevated intervention risk requires additional review.');
    if (prohibitedClaim)
      reasons.push(
        'Opportunity contains an owner-excluded marketing claim; revise before considering a draft.'
      );
    if (exceedsBudget)
      reasons.push('Estimated cost exceeds the client automation allowance.');
    if (netPotential <= 0)
      reasons.push('Estimated gross profit does not exceed intervention cost.');
    if (!capacityKnown)
      reasons.push(
        'Owner capacity is unknown; confirm before demand generation.'
      );
    if (noCapacity && s.expectedAdditionalJobsPerWeek > 0)
      reasons.push(
        'Booked capacity is full; preserve organic visibility and consider future bookings.'
      );
    if (
      intent.constraints.preferredServices.length &&
      !intent.constraints.preferredServices.includes(s.serviceId)
    ) {
      reasons.push('Service is not among the owner’s preferred priorities.');
    }
    const decision: ImprovementProposal['decision'] =
      noCapacity && s.expectedAdditionalJobsPerWeek > 0
        ? 'defer_for_capacity'
        : weakEvidence ||
            highRisk ||
            prohibitedClaim ||
            exceedsBudget ||
            netPotential <= 0 ||
            !capacityKnown
          ? 'research_more'
          : 'draft_for_review';
    const priorityIndex =
      Math.round(
        (netPotential > 0 ? Math.log1p(netPotential) : 0) *
          s.confidence *
          (1 - s.risk) *
          100
      ) / 100;
    return {
      signalId: s.id,
      organizationId: s.organizationId,
      serviceId: s.serviceId,
      title: s.title,
      outcomeMetric: s.outcomeMetric,
      priorityIndex,
      expectedGrossProfitAud: s.expectedGrossProfitAud,
      estimatedInterventionCostAud: s.estimatedInterventionCostAud,
      decision,
      reasons,
      evidenceRefs,
      approvalStatus: 'required' as const,
    };
  });
  return proposals.sort(
    (a, b) =>
      b.priorityIndex - a.priorityIndex || a.signalId.localeCompare(b.signalId)
  );
}
