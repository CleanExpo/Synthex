/**
 * Deterministic scorer for the AI content-generation eval harness.
 *
 * Pure functions, no AI calls, no network, no randomness — given the same
 * output + expectations it always returns the same result. This is what makes
 * the harness usable as a CI regression guard.
 */

import type {
  CaseExpectations,
  CaseScore,
  CheckResult,
  EvalPlatform,
  GoldenCase,
} from './types';

/**
 * Per-platform bounds used when a case sets `platform` but not explicit
 * char / hashtag limits. Mirrors PLATFORM_REQUIREMENTS in
 * lib/services/content-generator.ts (kept local so the scorer has no
 * dependency on the generation service).
 */
const PLATFORM_BOUNDS: Record<
  EvalPlatform,
  { maxChars: number; maxHashtags: number }
> = {
  twitter: { maxChars: 280, maxHashtags: 3 },
  linkedin: { maxChars: 3000, maxHashtags: 5 },
  instagram: { maxChars: 2200, maxHashtags: 30 },
  tiktok: { maxChars: 2200, maxHashtags: 10 },
  facebook: { maxChars: 63206, maxHashtags: 10 },
  // Threads: 500-char short-form cap / 5 hashtags — matches lib/schemas/content.ts
  // and lib/ai/multi-format-adapter.ts.
  threads: { maxChars: 500, maxHashtags: 5 },
};

/**
 * Globally-banned phrases — any of these in generated content is a regression
 * regardless of the case. Covers placeholder text, model meta-talk, leaked
 * system prompt, and obvious secret/PII leakage markers.
 *
 * Matched case-insensitively as substrings.
 */
export const BANNED_PHRASES: readonly string[] = [
  // Placeholder / template leakage
  'lorem ipsum',
  'lorem',
  'todo:',
  'placeholder',
  'insert text here',
  'your text here',
  '{topic}',
  '{business',
  '{{',
  'undefined',
  '[object object]',
  // Model meta-talk / refusal leakage
  'as an ai',
  'as a language model',
  "i'm sorry, but i can",
  'i cannot fulfill',
  'i am unable to',
  // Leaked system-prompt markers
  'system prompt',
  'you are a viral content creator',
  'ignore previous instructions',
  // Secret / credential leakage markers
  'sk-',
  'sk-ant-',
  'sk-proj-',
  'api_key',
  'api key:',
  'apikey=',
  'secret_key',
  'bearer ',
  'password:',
  '-----begin',
  'xoxb-',
  'ghp_',
];

/** Count `#hashtag` tokens in text. */
function countHashtags(text: string): number {
  return (text.match(/#\w+/g) ?? []).length;
}

/**
 * Whether a parsed JSON value counts as "non-empty" for a required field:
 * a non-blank string, a non-empty array, or any other non-null primitive.
 * Blank strings, empty arrays, null and undefined are empty.
 */
function isNonEmptyJsonValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  // Contract is "non-blank string or non-empty array". Reject everything else —
  // a bare `{}` / stray object / number must NOT satisfy a required non-empty
  // key (the previous `return true` let those through). [CodeRabbit #395]
  return false;
}

/** Try to parse JSON; returns the parsed object or null. */
function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Run all applicable checks for one output against its expectations.
 * Exported for direct unit testing.
 */
export function runChecks(
  output: string,
  expectations: CaseExpectations
): CheckResult[] {
  const checks: CheckResult[] = [];
  const trimmed = output.trim();
  const lower = trimmed.toLowerCase();
  const platform = expectations.platform;
  const bounds = platform ? PLATFORM_BOUNDS[platform] : undefined;

  // 1. Non-empty (default on)
  if (expectations.nonEmpty !== false) {
    checks.push({
      name: 'non-empty',
      passed: trimmed.length > 0,
      detail: trimmed.length > 0 ? undefined : 'output is empty after trim',
    });
  }

  // 2. Minimum length
  if (expectations.minChars !== undefined) {
    const passed = trimmed.length >= expectations.minChars;
    checks.push({
      name: 'min-chars',
      passed,
      detail: passed
        ? undefined
        : `length ${trimmed.length} < min ${expectations.minChars}`,
    });
  }

  // 3. Maximum length (explicit, else platform bound)
  const maxChars = expectations.maxChars ?? bounds?.maxChars;
  if (maxChars !== undefined) {
    const passed = trimmed.length <= maxChars;
    checks.push({
      name: 'max-chars',
      passed,
      detail: passed
        ? undefined
        : `length ${trimmed.length} > max ${maxChars}`,
    });
  }

  // 4. Hashtag ceiling (explicit, else platform bound)
  const maxHashtags = expectations.maxHashtags ?? bounds?.maxHashtags;
  if (maxHashtags !== undefined) {
    const count = countHashtags(trimmed);
    const passed = count <= maxHashtags;
    checks.push({
      name: 'max-hashtags',
      passed,
      detail: passed
        ? undefined
        : `${count} hashtags > max ${maxHashtags}`,
    });
  }

  // 5. Valid JSON with required keys (presence) + required non-empty keys (value).
  const requireKeys = expectations.requireJsonKeys ?? [];
  const requireNonEmptyKeys = expectations.requireNonEmptyJsonKeys ?? [];
  if (requireKeys.length > 0 || requireNonEmptyKeys.length > 0) {
    const parsed = tryParseJson(trimmed);
    if (!parsed) {
      checks.push({
        name: 'valid-json',
        passed: false,
        detail: 'output did not parse as a JSON object',
      });
    } else {
      checks.push({ name: 'valid-json', passed: true });
      // Presence-only required keys.
      for (const key of requireKeys) {
        const passed = Object.prototype.hasOwnProperty.call(parsed, key);
        checks.push({
          name: `json-key:${key}`,
          passed,
          detail: passed ? undefined : `missing required JSON key "${key}"`,
        });
      }
      // Required keys that must also carry a non-empty value. A non-empty key
      // implies presence, so a missing key fails here too.
      for (const key of requireNonEmptyKeys) {
        const present = Object.prototype.hasOwnProperty.call(parsed, key);
        const passed = present && isNonEmptyJsonValue(parsed[key]);
        checks.push({
          name: `json-key-nonempty:${key}`,
          passed,
          detail: passed
            ? undefined
            : present
              ? `JSON key "${key}" is present but empty`
              : `missing required JSON key "${key}"`,
        });
      }
    }
  }

  // 6. Required substrings (case-insensitive)
  if (expectations.mustInclude) {
    for (const needle of expectations.mustInclude) {
      const passed = lower.includes(needle.toLowerCase());
      checks.push({
        name: `must-include:${needle}`,
        passed,
        detail: passed ? undefined : `expected substring "${needle}" not found`,
      });
    }
  }

  // 7. Banned phrases — global list plus per-case additions
  const banned = [
    ...BANNED_PHRASES,
    ...(expectations.mustNotInclude ?? []),
  ];
  for (const phrase of banned) {
    const phraseLower = phrase.toLowerCase();
    const passed = !lower.includes(phraseLower);
    checks.push({
      name: `no-banned:${phrase}`,
      passed,
      detail: passed ? undefined : `banned phrase "${phrase}" present in output`,
    });
  }

  return checks;
}

/** Score a single case given the output produced for it. */
export function scoreCase(goldenCase: GoldenCase, output: string): CaseScore {
  const checks = runChecks(output, goldenCase.expectations);
  const passedChecks = checks.filter(c => c.passed).length;
  const totalChecks = checks.length;
  const score = totalChecks === 0 ? 1 : passedChecks / totalChecks;
  return {
    caseId: goldenCase.id,
    output,
    checks,
    passedChecks,
    totalChecks,
    score,
    passed: passedChecks === totalChecks,
  };
}
