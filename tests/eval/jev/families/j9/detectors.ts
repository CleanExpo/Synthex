/**
 * J9 detectors. Cases and positive controls call the SAME functions, so a
 * detector that cannot catch its planted defect cannot pass a real case either.
 */

export interface Verdict {
  passed: boolean;
  observed: string;
}

/** Fail closed: the spend was refused AND the provider was called zero times. */
export function failClosed(o: {
  providerCalls: number;
  refused: boolean;
  why?: string;
}): Verdict {
  return {
    passed: o.refused && o.providerCalls === 0,
    observed: `refused=${o.refused} providerCalls=${o.providerCalls}${
      o.why ? ` (${o.why})` : ''
    }`,
  };
}

/** A recorded amount equals the reference amount within a declared tolerance. */
export function amountsMatch(
  label: string,
  expected: number | null | undefined,
  actual: number | null | undefined,
  toleranceUsd: number
): Verdict {
  const ok =
    typeof expected === 'number' &&
    typeof actual === 'number' &&
    Number.isFinite(expected) &&
    Number.isFinite(actual) &&
    Math.abs(expected - actual) <= toleranceUsd;
  return {
    passed: ok,
    observed: `${label}: expected=${String(expected)} recorded=${String(
      actual
    )} tolerance=${toleranceUsd}`,
  };
}

/** Every verdict must pass; observations are joined. */
export function all(...verdicts: Verdict[]): Verdict {
  return {
    passed: verdicts.every(v => v.passed),
    observed: verdicts.map(v => v.observed).join('; '),
  };
}

const GOVERNOR_IMPORT =
  /import\s*(?:type\s*)?\{[^}]*\bgovernedCall(?:ForUser)?\b[^}]*\}\s*from\s*['"]@\/lib\/ai\/governor(?:\/index)?['"]/;
const GOVERNOR_CALL = /\bgovernedCall(?:ForUser)?\s*(?:<[^>]*>)?\s*\(/;

/** A spending route routes its provider call through the Governor. */
export function routeUsesGovernor(source: string): Verdict {
  const imported = GOVERNOR_IMPORT.test(source);
  const called = GOVERNOR_CALL.test(source);
  return {
    passed: imported && called,
    observed: `imports governedCall=${imported} calls governedCall=${called}`,
  };
}
