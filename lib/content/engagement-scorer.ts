/**
 * Engagement Scorer
 *
 * Analyses a piece of social media copy and returns a 0-100 score,
 * a letter grade, and actionable suggestions for improvement.
 *
 * Used by the Industry Mode content pipeline (SYN-408).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface EngagementScore {
  /** Overall quality score from 0 to 100. */
  score: number;
  /** Letter grade derived from the score. */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** Up to three actionable improvement tips. */
  suggestions: string[];
}

export interface ScorerOptions {
  /** Social platform the content is intended for. */
  platform?: string;
  /**
   * Override emoji detection — pass true if the caller knows the text
   * contains emoji characters that a regex might miss.
   */
  hasEmoji?: boolean;
  /**
   * Override CTA detection — pass true if the caller has already
   * verified the text contains a call-to-action phrase.
   */
  hasCTA?: boolean;
  /**
   * Override local keyword detection — pass true if the caller knows
   * the text references a suburb, city, or local marker.
   */
  hasLocalKeyword?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Words and phrases that indicate a call to action.
 * Checked against the lowercased text.
 */
const CTA_WORDS = [
  'book',
  'call',
  'click',
  'buy',
  'visit',
  'learn',
  'get',
  'try',
  'reply',
  'dm',
  'message',
] as const;

/**
 * Words that signal local relevance.
 * "near" and "local" are universal; the others cover typical AU address copy.
 */
const LOCAL_KEYWORDS = [
  'near',
  'local',
  'suburb',
  'city',
  'neighbourhood',
  'area',
  'street',
  'town',
] as const;

/**
 * Platforms that receive a small bonus for short-form, high-engagement formats.
 */
const SHORT_FORM_PLATFORMS: Record<string, number> = {
  instagram: 5,
  tiktok: 5,
  linkedin: 3,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** True when the string contains at least one Unicode emoji character. */
function containsEmoji(text: string): boolean {
  // Unicode emoji ranges — covers most common emoji blocks
  return /\p{Emoji}/u.test(text);
}

/** True when the lowercased text contains at least one CTA word/phrase. */
function containsCTA(lower: string): boolean {
  return CTA_WORDS.some(word => lower.includes(word));
}

/** True when the text references a local keyword. */
function containsLocalKeyword(lower: string): boolean {
  return LOCAL_KEYWORDS.some(kw => lower.includes(kw));
}

/** Derive a letter grade from a numeric score (0–100). */
function toGrade(score: number): EngagementScore['grade'] {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score a piece of social media copy on a 0–100 scale.
 *
 * @param text    The post copy to score.
 * @param options Optional overrides and platform hint.
 * @returns       An {@link EngagementScore} with score, grade, and suggestions.
 */
export function scoreEngagement(
  text: string,
  options: ScorerOptions = {}
): EngagementScore {
  const { platform, hasEmoji, hasCTA, hasLocalKeyword } = options;

  const lower = text.toLowerCase();
  const charCount = text.length;

  let rawScore = 0;
  const suggestions: string[] = [];

  // ── Length scoring ──────────────────────────────────────────────────────────
  if (charCount >= 80 && charCount <= 200) {
    rawScore += 20;
  } else if (charCount >= 201 && charCount <= 400) {
    rawScore += 15;
  } else {
    // <50 or >500 chars earns nothing; 50–79 chars gets a partial 5-pt credit
    if (charCount >= 50 && charCount < 80) {
      rawScore += 5;
    }

    if (charCount < 50) {
      suggestions.push(
        'Your post is very short — aim for at least 80 characters to give your audience something to engage with.'
      );
    } else if (charCount > 500) {
      suggestions.push(
        'Your post is quite long — consider trimming to under 400 characters for better engagement on most platforms.'
      );
    }
  }

  // ── Question mark ──────────────────────────────────────────────────────────
  if (text.includes('?')) {
    rawScore += 10;
  } else {
    suggestions.push(
      'Add a question to invite comments and start a conversation (e.g. "What do you think?" or "Sound familiar?").'
    );
  }

  // ── Emoji ──────────────────────────────────────────────────────────────────
  const emojiPresent = hasEmoji ?? containsEmoji(text);
  if (emojiPresent) {
    rawScore += 10;
  } else {
    suggestions.push(
      'Add 1–2 relevant emojis to make your post more eye-catching in a busy feed.'
    );
  }

  // ── Call to action ─────────────────────────────────────────────────────────
  const ctaPresent = hasCTA ?? containsCTA(lower);
  if (ctaPresent) {
    rawScore += 15;
  } else {
    suggestions.push(
      "Include a call to action such as 'Book now', 'Call us today', or 'DM for more info' to drive conversions."
    );
  }

  // ── Local keyword ──────────────────────────────────────────────────────────
  const localPresent = hasLocalKeyword ?? containsLocalKeyword(lower);
  if (localPresent) {
    rawScore += 10;
  } else {
    suggestions.push(
      'Mention your suburb or city to attract nearby customers and improve local search visibility.'
    );
  }

  // ── Platform bonus ─────────────────────────────────────────────────────────
  if (platform) {
    const bonus = SHORT_FORM_PLATFORMS[platform.toLowerCase()] ?? 0;
    rawScore += bonus;
  }

  // ── Cap at 100 ─────────────────────────────────────────────────────────────
  const score = Math.min(100, rawScore);

  // Limit suggestions to the three most impactful (already ordered by points)
  const topSuggestions = suggestions.slice(0, 3);

  return {
    score,
    grade: toGrade(score),
    suggestions: topSuggestions,
  };
}
