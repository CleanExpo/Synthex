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
  /import\s*(?:type\s*)?\{[^}]*\b(?:governedCall(?:ForUser)?|governedRouteCall)\b[^}]*\}\s*from\s*['"]@\/lib\/ai\/governor(?:\/index)?['"]/;
const GOVERNOR_CALL =
  /\b(?:governedCall(?:ForUser)?|governedRouteCall)\s*(?:<[^>]*>)?\s*\(/;

/**
 * Media spend (image, video, voice, avatar) is gated by the fail-closed media
 * quota, not the token-priced text Governor (spec M10, narrow). A media-only
 * route passes when it reaches spend ONLY through a sole media entry point
 * (each holds spend before the provider call) and talks to no provider itself.
 */
const MEDIA_ENTRY_IMPORT =
  /import\s*\{[^}]*\b(generateImage|submitGenerativeVideo|holdMediaSpend|withMediaSpendHold)\b[^}]*\}\s*from\s*['"]@\/lib\/services\/ai\/(?:image-generation|video\/generation-service|media-spend-gate)['"]/;
const DIRECT_PROVIDER =
  /from\s*['"](?:@anthropic-ai\/sdk|openai|@google\/generative-ai|@google\/genai|@fal-ai\/client|elevenlabs)['"]|fetch\(\s*[`'"]https:\/\/(?:api\.anthropic|api\.openai|openrouter\.ai|api\.elevenlabs|api\.heygen|fal\.run|queue\.fal\.run)/;

/** A spending route routes its provider call through the Governor, or (media only) through the media quota. */
export function routeUsesGovernor(source: string): Verdict {
  const imported = GOVERNOR_IMPORT.test(source);
  const called = GOVERNOR_CALL.test(source);
  const entry = MEDIA_ENTRY_IMPORT.exec(source)?.[1] ?? null;
  const entryCalled =
    entry !== null && new RegExp(`\\b${entry}\\s*\\(`).test(source);
  const direct = DIRECT_PROVIDER.test(source);
  const governed = imported && called;
  const mediaGated = entryCalled && !direct;
  return {
    passed: governed || mediaGated,
    observed: `imports governedCall=${imported} calls governedCall=${called} mediaEntry=${entry ?? 'none'} called=${entryCalled} directProvider=${direct}`,
  };
}
