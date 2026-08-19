/**
 * AT-025 — deterministic same-day incident severity classifier.
 *
 * Defaults to the *higher* severity (lower number). Never auto-notifies or
 * pages humans — callers persist the result for review only.
 *
 * Severity (Template 5 / reporting-templates.md):
 *   1 = immediate CEO escalation path (store for review; do not page here)
 *   2 = same-day ops + summary
 *   3 = next weekly batch
 */

export const INCIDENT_TYPES = [
  'privacy-breach',
  'security',
  'data-loss',
  'operational-SLA',
  'customer-trust',
] as const;

export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const CANARY_SIGNALS = ['AMBER', 'RED'] as const;
export type CanarySignal = (typeof CANARY_SIGNALS)[number];

export const INCIDENT_SEVERITIES = [1, 2, 3] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export const INCIDENT_BRANDS = [
  'DR',
  'NRPG',
  'RestoreAssist',
  'CARSI',
  'CCW',
  'portfolio',
] as const;

export type IncidentBrand = (typeof INCIDENT_BRANDS)[number];

export type ClassifyIncidentInput = {
  type: IncidentType;
  canarySignal: CanarySignal;
  /** Optional caller hint — never used to downgrade below the computed floor. */
  proposedSeverity?: IncidentSeverity;
};

export type IncidentClassification = {
  severity: IncidentSeverity;
  severityFloor: IncidentSeverity;
  severityLabel: string;
  defaultedHigher: boolean;
  /** Always false from this classifier — product must not page/notify. */
  notifyExternal: false;
  pageHuman: false;
  storeForReviewOnly: true;
  rationale: string;
};

const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  1: 'immediate CEO escalation path (review only — not auto-paged)',
  2: 'same-day ops + summary',
  3: 'next weekly batch',
};

/** Same-day trust classes always floor at Severity 1. */
const TRUST_FLOOR_TYPES: ReadonlySet<IncidentType> = new Set([
  'privacy-breach',
  'security',
  'data-loss',
  'customer-trust',
]);

function severityFloor(
  type: IncidentType,
  canarySignal: CanarySignal
): IncidentSeverity {
  if (TRUST_FLOOR_TYPES.has(type)) {
    return 1;
  }
  // operational-SLA: RED floors at 1; AMBER at 2 (never 3 on a canary fire)
  return canarySignal === 'RED' ? 1 : 2;
}

/**
 * Classify an incident. Lower numeric severity = higher urgency.
 * `Math.min(floor, proposed)` keeps the more urgent of the two.
 */
export function classifyIncident(
  input: ClassifyIncidentInput
): IncidentClassification {
  const floor = severityFloor(input.type, input.canarySignal);
  const proposed = input.proposedSeverity;
  const severity: IncidentSeverity =
    proposed === undefined
      ? floor
      : (Math.min(floor, proposed) as IncidentSeverity);

  const defaultedHigher = proposed !== undefined && severity < proposed;

  return {
    severity,
    severityFloor: floor,
    severityLabel: SEVERITY_LABELS[severity],
    defaultedHigher,
    notifyExternal: false,
    pageHuman: false,
    storeForReviewOnly: true,
    rationale: [
      `Type ${input.type} + canary ${input.canarySignal} → floor severity ${floor}.`,
      proposed === undefined
        ? 'No proposed severity; floor applied.'
        : defaultedHigher
          ? `Proposed severity ${proposed} downgraded to ${severity} (default-higher gate).`
          : `Proposed severity ${proposed} accepted at or above floor.`,
      'No external notify; no human page — store for review only.',
    ].join(' '),
  };
}

export function formatIncidentReviewContent(args: {
  incidentId: string;
  detectedAt: string;
  type: IncidentType;
  brand: IncidentBrand;
  canarySignal: CanarySignal;
  summary: string;
  classification: IncidentClassification;
  containmentStatus: string;
}): string {
  const { classification: c } = args;
  return [
    `SAME-DAY INCIDENT — ${args.incidentId}`,
    `Severity: ${c.severity}`,
    `Detected: ${args.detectedAt}`,
    '',
    '▸ CLASSIFICATION',
    `   Severity: ${c.severity} — ${c.severityLabel}`,
    `   Type: ${args.type}`,
    `   Brand affected: ${args.brand}`,
    `   Canary: ${args.canarySignal}`,
    `   Rationale: ${c.rationale}`,
    '',
    '▸ SUMMARY',
    `   ${args.summary}`,
    '',
    '▸ CONTAINMENT',
    `   Status: ${args.containmentStatus}`,
    '',
    '▸ NOTIFICATION',
    '   External systems: NOT notified (product gate)',
    '   Human page: NOT sent (store for review only)',
    '   Review state: pending_review',
  ].join('\n');
}
