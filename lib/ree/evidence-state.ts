/**
 * REE evidence states — docs/ree/REE-SPEC.md §6.
 *
 * Every collected reading carries exactly one state. Only an OBSERVED reading
 * holds a value; every other state carries `value: null` and a safe reason, so
 * a failed, missing or unsupported read can never render as a measured zero.
 * DIAGNOSTIC (a heuristic score) is a purpose label, not a state.
 *
 * Browser-safe and dependency-free: used by API routes, hooks and components.
 */

export const EVIDENCE_STATES = [
  'OBSERVED',
  'UNAVAILABLE',
  'UNAUTHORISED',
  'UNSUPPORTED',
  'STALE',
  'PARTIAL',
] as const;

export type EvidenceState = (typeof EVIDENCE_STATES)[number];
export type NonObservedState = Exclude<EvidenceState, 'OBSERVED'>;

export type EvidenceReading<T> =
  | { state: 'OBSERVED'; value: T; source: string; capturedAt?: string }
  | {
      state: NonObservedState;
      value: null;
      source: string;
      reason: string;
      capturedAt?: string;
    };

export const EVIDENCE_STATE_LABELS: Record<NonObservedState, string> = {
  UNAVAILABLE: 'Unavailable',
  UNAUTHORISED: 'Not authorised',
  UNSUPPORTED: 'Not supported',
  STALE: 'Out of date',
  PARTIAL: 'Incomplete',
};

export function observed<T>(
  value: T,
  source: string,
  capturedAt?: string
): EvidenceReading<T> {
  return { state: 'OBSERVED', value, source, capturedAt };
}

export function notObserved<T = never>(
  state: NonObservedState,
  source: string,
  reason: string
): EvidenceReading<T> {
  return { state, value: null, source, reason };
}

/** A number is only an observation when the provider returned a finite number. */
export function observedNumber(
  value: unknown,
  source: string,
  capturedAt?: string
): EvidenceReading<number> {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return observed(value, source, capturedAt);
  }
  return notObserved(
    'UNAVAILABLE',
    source,
    'value missing or not a finite number'
  );
}

/** Only OBSERVED readings render numerically; everything else renders its label. */
export function formatReading(
  reading: EvidenceReading<number>,
  format: (value: number) => string = value => value.toLocaleString('en-AU')
): string {
  if (reading.state !== 'OBSERVED') return EVIDENCE_STATE_LABELS[reading.state];
  return Number.isFinite(reading.value)
    ? format(reading.value)
    : EVIDENCE_STATE_LABELS.UNAVAILABLE;
}
