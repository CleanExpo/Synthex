/**
 * Flesch-Kincaid grade level — zero-dependency arithmetic implementation.
 *
 * Used by R4 in lib/aeo/brand-voice-enforce.ts. Per spec docs/aeo/brand-voice-enforce-spec-2026-05-16.md
 * R4: "Reading-level ceiling — Flesch-Kincaid grade computed on candidate;
 * reject if grade > BrandConfig.pillars.readingLevel.hardFail."
 *
 * Formula (standard Flesch-Kincaid Grade Level):
 *   0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59
 */

const VOWELS = /[aeiouy]+/g;

/**
 * Estimate syllable count for a single word. Heuristic — undercounts on
 * highly irregular words. Sufficient for gate purposes (the threshold is
 * grade-level not syllable-precise).
 */
export function syllablesIn(word: string): number {
  if (!word) return 0;
  const lowered = word.toLowerCase().replace(/[^a-z]/g, '');
  if (lowered.length === 0) return 0;
  if (lowered.length <= 3) return 1;

  // Drop trailing silent 'e' unless it's preceded by 'le'
  const trimmed = lowered.replace(/(?:[^l]e|ed|es)$/, '');
  const matches = trimmed.match(VOWELS);
  const count = matches ? matches.length : 0;
  return Math.max(1, count);
}

export interface ReadingLevelResult {
  grade: number;
  sentences: number;
  words: number;
  syllables: number;
}

/**
 * Compute Flesch-Kincaid grade level for a candidate string.
 * Returns 0 when the candidate has no sentences or no words (empty/whitespace).
 */
export function fleschKincaidGrade(candidate: string): ReadingLevelResult {
  // Split sentences on . ! ? — handle multiple punctuation, trim, drop empties.
  const sentencesRaw = candidate.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const sentences = sentencesRaw.length;

  if (sentences === 0) {
    return { grade: 0, sentences: 0, words: 0, syllables: 0 };
  }

  const wordsRaw = candidate.match(/\b[\p{L}'-]+\b/gu) ?? [];
  const words = wordsRaw.length;

  if (words === 0) {
    return { grade: 0, sentences, words: 0, syllables: 0 };
  }

  let syllables = 0;
  for (const w of wordsRaw) syllables += syllablesIn(w);

  const grade =
    0.39 * (words / sentences) +
    11.8 * (syllables / Math.max(1, words)) -
    15.59;

  return {
    grade: Math.round(grade * 10) / 10,
    sentences,
    words,
    syllables,
  };
}
