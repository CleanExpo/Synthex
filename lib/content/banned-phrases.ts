/**
 * Banned / cliché phrase filter — deterministic and offline (no AI key needed).
 *
 * The deterministic template fallback in `lib/services/content-generator.ts`
 * runs when no AI provider key is configured. It must NEVER emit the banned
 * marketing clichés enforced by the brand skill, because that path is the
 * no-AI-key fallback and cannot rely on a model to rewrite them.
 *
 * Canonical source of the banned list (single source of truth):
 *  - `.claude/skills/brand-campaign-generator/SKILL.md` (Capability Uplift)
 *  - `.claude/skills/synthex-standards/references/content-standards.md`
 *    (Anti-Patterns — "NEVER write these")
 *
 * Each entry maps a banned phrase/pattern to a neutral, non-cliché replacement
 * that preserves the sentence's intent without the banned wording. The filter
 * is a pure string transform — same input always yields the same output — so it
 * keeps the template fallback fully deterministic.
 */

/** One banned phrase and the neutral copy that replaces it. */
interface BannedPhraseRule {
  /** Case-insensitive pattern that detects the banned phrase. */
  readonly pattern: RegExp;
  /** Neutral, non-cliché replacement preserving intent. */
  readonly replacement: string;
}

/**
 * Ordered banned-phrase rules. Multi-word openers are listed before single
 * words so the longer, more specific phrases are rewritten first.
 *
 * NOTE: every `pattern` MUST carry the global flag so `String.replace` rewrites
 * all occurrences, not just the first.
 */
const BANNED_PHRASE_RULES: readonly BannedPhraseRule[] = [
  // --- Opening clichés (multi-word, rewritten first) ---
  {
    pattern: /\bexcited to announce\b/gi,
    replacement: 'Announcing',
  },
  {
    pattern: /\b(?:we'?re|we are)\s+thrilled to share\b/gi,
    replacement: 'Sharing',
  },
  {
    pattern: /\bthrilled to share\b/gi,
    replacement: 'Sharing',
  },
  {
    pattern: /\bin today'?s fast-paced world\b/gi,
    replacement: 'Right now',
  },
  {
    pattern: /\bdisrupting the industry\b/gi,
    replacement: 'changing how this works',
  },
  // --- Single-word / short jargon clichés ---
  {
    pattern: /\bgame-?changing\b/gi,
    replacement: 'important',
  },
  {
    pattern: /\brevolutionary\b/gi,
    replacement: 'new',
  },
  {
    pattern: /\bleverage\b/gi,
    replacement: 'use',
  },
  {
    pattern: /\bseamless(?:ly)?\b/gi,
    replacement: 'simple',
  },
  {
    pattern: /\brobust\b/gi,
    replacement: 'reliable',
  },
  {
    pattern: /\bworld-?class\b/gi,
    replacement: 'proven',
  },
];

/**
 * Rewrites any banned/cliché phrases in `text` to neutral copy.
 *
 * Deterministic and offline: a pure string transform with no randomness and no
 * network/AI dependency. Safe to call on the no-AI-key template fallback path.
 *
 * Capitalisation of the first character of each replaced span is preserved so
 * sentence-initial replacements read naturally (e.g. "Excited to announce" →
 * "Announcing", "we leverage" → "we use").
 */
export function stripBannedPhrases(text: string): string {
  let result = text;
  for (const rule of BANNED_PHRASE_RULES) {
    result = result.replace(rule.pattern, (match) =>
      matchCase(match, rule.replacement)
    );
  }
  return result;
}

/**
 * Returns true if `text` contains any banned/cliché phrase. Useful for tests
 * and guards. Does not mutate input.
 */
export function containsBannedPhrase(text: string): boolean {
  return BANNED_PHRASE_RULES.some((rule) => {
    // Use a fresh, non-stateful test: clone without the global flag so the
    // shared `lastIndex` on the module-level RegExp is never advanced.
    const probe = new RegExp(rule.pattern.source, 'i');
    return probe.test(text);
  });
}

/**
 * Returns the human-readable banned phrases this filter enforces — the literal
 * trigger strings from the brand skill, for test assertions and diagnostics.
 */
export const BANNED_PHRASES: readonly string[] = [
  'excited to announce',
  'thrilled to share',
  "in today's fast-paced world",
  'game-changing',
  'revolutionary',
  'leverage',
  'seamless',
  'robust',
  'world-class',
  'disrupting the industry',
];

/**
 * Copies the leading-character case of `original` onto `replacement` so a
 * sentence-initial capital stays capitalised after a rewrite. Only the first
 * character is adjusted — the replacement's own internal casing is preserved.
 */
function matchCase(original: string, replacement: string): string {
  if (!original || !replacement) return replacement;
  const firstChar = original[0];
  if (firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  if (firstChar === firstChar.toLowerCase() && firstChar !== firstChar.toUpperCase()) {
    return replacement[0].toLowerCase() + replacement.slice(1);
  }
  return replacement;
}
